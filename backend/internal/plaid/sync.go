package plaid

import (
	"context"
	"encoding/json"
	"errors"
	"math"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"budget-buddy/backend/internal/budget"
	"budget-buddy/backend/internal/config"
	"budget-buddy/backend/internal/goals"
)

type SyncResult struct {
	ItemID            string `json:"itemId"`
	AddedCount        int    `json:"addedCount"`
	ModifiedCount     int    `json:"modifiedCount"`
	RemovedCount      int    `json:"removedCount"`
	TotalTransactions int    `json:"totalTransactions"`
}

// Read IDs and release the query connection before starting network-backed syncs.
func SyncUserItems(ctx context.Context, db *pgxpool.Pool, cfg config.Config, userID string) ([]SyncResult, error) {
	if !cfg.PlaidConfigured() || !cfg.PlaidTokenEncryptionConfigured() {
		return nil, errors.New("plaid is not configured")
	}
	client, err := NewClient(cfg)
	if err != nil {
		return nil, err
	}
	rows, err := db.Query(ctx, `select id::text, access_token_ciphertext from plaid_items
 where user_id=$1 and archived_at is null order by id`, userID)
	if err != nil {
		return nil, err
	}
	type item struct{ id, token string }
	items := []item{}
	for rows.Next() {
		var v item
		if err := rows.Scan(&v.id, &v.token); err != nil {
			rows.Close()
			return nil, err
		}
		items = append(items, v)
	}
	err = rows.Err()
	rows.Close()
	if err != nil {
		return nil, err
	}
	results := []SyncResult{}
	var failures []error
	for _, v := range items {
		token, err := decryptToken(cfg.PlaidTokenEncryptionKey, v.token)
		if err != nil {
			failures = append(failures, err)
			continue
		}
		result, err := syncItem(ctx, db, client, userID, v.id, token, "")
		if err != nil {
			failures = append(failures, err)
			code := "SYNC_FAILED"
			state := "error"
			var pe apiError
			if errors.As(err, &pe) {
				code = pe.ErrorCode
				if requiresRelink(code) {
					state = "relink_required"
				}
			}
			_, _ = db.Exec(ctx, `update plaid_items set status=$3,error_code=$4,error_message=$5 where id=$1 and user_id=$2`, v.id, userID, state, code, "Bank sync needs attention.")
			continue
		}
		results = append(results, result)
	}
	_ = budget.RefreshRecommendations(ctx, db, userID)
	// Partial success must never be reported as a complete refresh.
	return results, errors.Join(failures...)
}

func requiresRelink(code string) bool {
	switch code {
	case "ITEM_LOGIN_REQUIRED", "ITEM_LOCKED", "INVALID_CREDENTIALS", "INVALID_MFA", "USER_PERMISSION_REVOKED", "ITEM_ACCESS_NOT_GRANTED":
		return true
	}
	return false
}

type transactionSyncer interface {
	SyncTransactions(context.Context, SyncTransactionsRequest) (SyncTransactionsResponse, error)
}

// Buffer a complete update; mutation retries always restart at the committed cursor.
func collectSync(ctx context.Context, client transactionSyncer, token, original string) (SyncTransactionsResponse, error) {
	for attempt := 0; attempt < 3; attempt++ {
		all := SyncTransactionsResponse{}
		cursor := original
		restart := false
		for page := 0; page < 1000; page++ {
			r, err := client.SyncTransactions(ctx, SyncTransactionsRequest{AccessToken: token, Cursor: cursor, Count: 500})
			if err != nil {
				var pe apiError
				if errors.As(err, &pe) && pe.ErrorCode == "TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION" {
					restart = true
					break
				}
				return SyncTransactionsResponse{}, err
			}
			all.Added = append(all.Added, r.Added...)
			all.Modified = append(all.Modified, r.Modified...)
			all.Removed = append(all.Removed, r.Removed...)
			all.NextCursor = r.NextCursor
			if !r.HasMore {
				return all, nil
			}
			if r.NextCursor == cursor {
				return SyncTransactionsResponse{}, errors.New("plaid sync cursor did not advance")
			}
			cursor = r.NextCursor
		}
		if !restart {
			return SyncTransactionsResponse{}, errors.New("plaid sync page limit exceeded")
		}
	}
	return SyncTransactionsResponse{}, errors.New("plaid sync changed repeatedly; retry later")
}

func syncItem(ctx context.Context, db *pgxpool.Pool, client *Client, userID, itemID, accessToken, _ string) (SyncResult, error) {
	result := SyncResult{ItemID: itemID}
	tx, err := db.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return result, err
	}
	defer tx.Rollback(ctx)
	// Cross-process row lock serializes manual, webhook, and background refreshes.
	var cursor string
	err = tx.QueryRow(ctx, `select transactions_cursor from plaid_items where id=$1 and user_id=$2 and archived_at is null for update`, itemID, userID).Scan(&cursor)
	if err != nil {
		return result, err
	}
	response, err := collectSync(ctx, client, accessToken, cursor)
	if err != nil {
		return result, err
	}
	for _, entry := range append(response.Added, response.Modified...) {
		if err = upsertTransaction(ctx, tx, userID, itemID, entry); err != nil {
			return result, err
		}
		if err = goals.ReconcilePlaidTransaction(ctx, tx, userID, entry.TransactionID); err != nil {
			return result, err
		}
	}
	for _, entry := range response.Removed {
		if err = goals.RemovePlaidContribution(ctx, tx, userID, entry.TransactionID); err != nil {
			return result, err
		}
		if _, err = tx.Exec(ctx, `delete from plaid_transactions where user_id=$1 and item_id=$2 and plaid_transaction_id=$3`, userID, itemID, entry.TransactionID); err != nil {
			return result, err
		}
	}
	_, err = tx.Exec(ctx, `update plaid_items set transactions_cursor=$2,last_sync_at=now(),status='active',error_code=null,error_message=null where id=$1`, itemID, response.NextCursor)
	if err != nil {
		return result, err
	}
	if err = tx.QueryRow(ctx, `select count(*) from plaid_transactions where user_id=$1 and item_id=$2`, userID, itemID).Scan(&result.TotalTransactions); err != nil {
		return result, err
	}
	if err = tx.Commit(ctx); err != nil {
		return result, err
	}
	result.AddedCount = len(response.Added)
	result.ModifiedCount = len(response.Modified)
	result.RemovedCount = len(response.Removed)
	// Cached balances are sufficient here; do not charge for a real-time balance pull on each webhook.
	_ = refreshAccountBalances(ctx, db, client, userID, itemID, accessToken)
	return result, nil
}

func upsertTransaction(
	ctx context.Context,
	tx pgx.Tx,
	userID, itemID string,
	transaction SyncedTransaction,
) error {
	accountID, err := lookupAccountID(ctx, tx, userID, transaction.AccountID)
	if err != nil {
		return err
	}

	amountCents := int64(math.Round(math.Abs(transaction.Amount) * 100))
	if transaction.Amount < 0 {
		amountCents = -amountCents
	}

	merchant := firstNonEmpty(transaction.MerchantName, transaction.Name, "Transaction")
	categories := transaction.Category
	if categories == nil {
		categories = []string{}
	}
	pfcPrimary := ""
	pfcDetailed := ""
	if transaction.PersonalFinanceCategory != nil {
		pfcPrimary = transaction.PersonalFinanceCategory.Primary
		pfcDetailed = transaction.PersonalFinanceCategory.Detailed
	}

	raw, err := json.Marshal(transaction)
	if err != nil {
		return err
	}

	authorizedDate := parseOptionalDate(transaction.AuthorizedDate)

	_, err = tx.Exec(
		ctx,
		`insert into plaid_transactions (
		   user_id, item_id, account_id, plaid_transaction_id, amount_cents,
		   iso_currency_code, unofficial_currency_code, date, authorized_date,
		   name, merchant_name, category, personal_finance_category_primary,
		   personal_finance_category_detailed, pending, pending_transaction_id, raw
		 )
		 values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17::jsonb)
		 on conflict (plaid_transaction_id) do update
		       set account_id = excluded.account_id,
		           amount_cents = excluded.amount_cents,
		           iso_currency_code = excluded.iso_currency_code,
		           unofficial_currency_code = excluded.unofficial_currency_code,
		           date = excluded.date,
		           authorized_date = excluded.authorized_date,
		           name = excluded.name,
		           merchant_name = excluded.merchant_name,
		           category = excluded.category,
		           personal_finance_category_primary = excluded.personal_finance_category_primary,
		           personal_finance_category_detailed = excluded.personal_finance_category_detailed,
		           pending = excluded.pending,
           pending_transaction_id = excluded.pending_transaction_id,
		           raw = excluded.raw,
		           updated_at = now()
		     where plaid_transactions.user_id = excluded.user_id`,
		userID,
		itemID,
		accountID,
		transaction.TransactionID,
		amountCents,
		nilIfEmpty(transaction.IsoCurrencyCode),
		nilIfEmpty(transaction.UnofficialCurrencyCode),
		transaction.Date,
		authorizedDate,
		firstNonEmpty(transaction.Name, merchant),
		merchant,
		categories,
		nilIfEmpty(pfcPrimary),
		nilIfEmpty(pfcDetailed),
		transaction.Pending,
		nilIfEmpty(transaction.PendingTransactionID),
		string(raw),
	)
	return err
}

func lookupAccountID(ctx context.Context, tx pgx.Tx, userID, plaidAccountID string) (any, error) {
	var accountID string
	err := tx.QueryRow(
		ctx,
		`select id::text
		   from plaid_accounts
		  where user_id = $1 and plaid_account_id = $2`,
		userID,
		plaidAccountID,
	).Scan(&accountID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return accountID, nil
}

func refreshAccountBalances(
	ctx context.Context,
	db *pgxpool.Pool,
	client *Client,
	userID, itemID, accessToken string,
) error {
	response, err := client.GetAccountsBalance(ctx, accessToken)
	if err != nil {
		return err
	}

	for _, account := range response.Accounts {
		currentCents := balanceToCents(account.Balances.Current)
		availableCents := balanceToCents(account.Balances.Available)

		if _, err := db.Exec(
			ctx,
			`update plaid_accounts
			    set current_balance_cents = $4,
			        available_balance_cents = $5,
			        iso_currency_code = coalesce(nullif($6, ''), iso_currency_code),
			        updated_at = now()
			  where user_id = $1 and item_id = $2 and plaid_account_id = $3`,
			userID,
			itemID,
			account.AccountID,
			currentCents,
			availableCents,
			strings.TrimSpace(account.Balances.IsoCurrencyCode),
		); err != nil {
			return err
		}
	}
	return nil
}

func balanceToCents(value *float64) any {
	if value == nil {
		return nil
	}
	return int64(math.Round(*value * 100))
}

func parseOptionalDate(value string) any {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil
	}
	parsed, err := time.Parse("2006-01-02", value)
	if err != nil {
		return nil
	}
	return parsed.Format("2006-01-02")
}

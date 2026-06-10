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

	"budget-buddy/backend/internal/config"
)

type SyncResult struct {
	ItemID            string `json:"itemId"`
	AddedCount        int    `json:"addedCount"`
	ModifiedCount     int    `json:"modifiedCount"`
	RemovedCount      int    `json:"removedCount"`
	TotalTransactions int    `json:"totalTransactions"`
}

func SyncUserItems(ctx context.Context, db *pgxpool.Pool, cfg config.Config, userID string) ([]SyncResult, error) {
	if !cfg.PlaidConfigured() || !cfg.PlaidTokenEncryptionConfigured() {
		return nil, errors.New("plaid is not configured")
	}

	client, err := NewClient(cfg)
	if err != nil {
		return nil, err
	}

	rows, err := db.Query(
		ctx,
		`select id::text, access_token_ciphertext, coalesce(transactions_cursor, '')
		   from plaid_items
		  where user_id = $1 and status = 'active' and archived_at is null`,
		userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	results := []SyncResult{}
	var syncErrors []error
	for rows.Next() {
		var itemID, ciphertext, cursor string
		if err := rows.Scan(&itemID, &ciphertext, &cursor); err != nil {
			return nil, err
		}

		accessToken, err := decryptToken(cfg.PlaidTokenEncryptionKey, ciphertext)
		if err != nil {
			syncErrors = append(syncErrors, err)
			continue
		}

		result, err := syncItem(ctx, db, client, userID, itemID, accessToken, cursor)
		if err != nil {
			syncErrors = append(syncErrors, err)
			continue
		}
		results = append(results, result)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if len(results) == 0 && len(syncErrors) > 0 {
		return nil, syncErrors[0]
	}

	return results, nil
}

func syncItem(
	ctx context.Context,
	db *pgxpool.Pool,
	client *Client,
	userID, itemID, accessToken, cursor string,
) (SyncResult, error) {
	result := SyncResult{ItemID: itemID}
	hasMore := true

	for hasMore {
		response, err := client.SyncTransactions(ctx, SyncTransactionsRequest{
			AccessToken: accessToken,
			Cursor:      cursor,
			Count:       500,
		})
		if err != nil {
			return result, err
		}

		tx, err := db.BeginTx(ctx, pgx.TxOptions{})
		if err != nil {
			return result, err
		}

		for _, added := range response.Added {
			if err := upsertTransaction(ctx, tx, userID, itemID, added); err != nil {
				_ = tx.Rollback(ctx)
				return result, err
			}
			result.AddedCount++
		}
		for _, modified := range response.Modified {
			if err := upsertTransaction(ctx, tx, userID, itemID, modified); err != nil {
				_ = tx.Rollback(ctx)
				return result, err
			}
			result.ModifiedCount++
		}
		for _, removed := range response.Removed {
			if _, err := tx.Exec(
				ctx,
				`delete from plaid_transactions
				  where user_id = $1 and plaid_transaction_id = $2`,
				userID,
				removed.TransactionID,
			); err != nil {
				_ = tx.Rollback(ctx)
				return result, err
			}
			result.RemovedCount++
		}

		cursor = response.NextCursor
		hasMore = response.HasMore

		if _, err := tx.Exec(
			ctx,
			`update plaid_items
			    set transactions_cursor = $2,
			        last_sync_at = now(),
			        updated_at = now()
			  where id = $1 and user_id = $3`,
			itemID,
			cursor,
			userID,
		); err != nil {
			_ = tx.Rollback(ctx)
			return result, err
		}

		if err := tx.Commit(ctx); err != nil {
			return result, err
		}
	}

	_ = refreshAccountBalances(ctx, db, client, userID, itemID, accessToken)

	if err := db.QueryRow(
		ctx,
		`select count(*) from plaid_transactions where user_id = $1 and item_id = $2`,
		userID,
		itemID,
	).Scan(&result.TotalTransactions); err != nil {
		return result, err
	}

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
		   personal_finance_category_detailed, pending, raw
		 )
		 values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16::jsonb)
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


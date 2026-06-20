package goals

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

type plaidContributionCandidate struct {
	TransactionID string
	AccountID     string
	AmountCents   int64
	Date          time.Time
	Primary       string
	Detailed      string
	Legacy        []string
	Pending       bool
	AccountType   string
	Subtype       string
}

// ReconcilePlaidTransaction makes automatic goal updates idempotent. Replayed
// webhooks and modified transactions update the existing contribution instead
// of incrementing a goal twice.
func ReconcilePlaidTransaction(ctx context.Context, tx pgx.Tx, userID, plaidTransactionID string) error {
	var candidate plaidContributionCandidate
	err := tx.QueryRow(
		ctx,
		`select pt.id::text,
		        coalesce(pt.account_id::text, ''),
		        pt.amount_cents,
		        pt.date,
		        coalesce(pt.personal_finance_category_primary, ''),
		        coalesce(pt.personal_finance_category_detailed, ''),
		        pt.category,
		        pt.pending,
		        coalesce(pa.type, ''),
		        coalesce(pa.subtype, '')
		   from plaid_transactions pt
		   left join plaid_accounts pa on pa.id = pt.account_id
		  where pt.user_id = $1 and pt.plaid_transaction_id = $2`,
		userID,
		plaidTransactionID,
	).Scan(
		&candidate.TransactionID,
		&candidate.AccountID,
		&candidate.AmountCents,
		&candidate.Date,
		&candidate.Primary,
		&candidate.Detailed,
		&candidate.Legacy,
		&candidate.Pending,
		&candidate.AccountType,
		&candidate.Subtype,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil
	}
	if err != nil {
		return err
	}

	if !candidate.isSavingsTransferIn() {
		return removePlaidContribution(ctx, tx, userID, candidate.TransactionID)
	}

	var goalID string
	err = tx.QueryRow(
		ctx,
		`select id::text
		   from goals
		  where user_id = $1
		    and linked_account_id = $2
		    and archived_at is null`,
		userID,
		candidate.AccountID,
	).Scan(&goalID)
	if errors.Is(err, pgx.ErrNoRows) {
		return removePlaidContribution(ctx, tx, userID, candidate.TransactionID)
	}
	if err != nil {
		return err
	}

	amountCents := -candidate.AmountCents
	var existingGoalID string
	var existingAmount int64
	err = tx.QueryRow(
		ctx,
		`select goal_id::text, amount_cents
		   from goal_contributions
		  where user_id = $1 and transaction_id = $2
		  for update`,
		userID,
		candidate.TransactionID,
	).Scan(&existingGoalID, &existingAmount)
	if errors.Is(err, pgx.ErrNoRows) {
		if _, err := tx.Exec(
			ctx,
			`insert into goal_contributions (
			   goal_id, user_id, amount_cents, source, transaction_id, contributed_at
			 ) values ($1, $2, $3, 'plaid', $4, $5)`,
			goalID,
			userID,
			amountCents,
			candidate.TransactionID,
			candidate.Date,
		); err != nil {
			return err
		}
		_, err = tx.Exec(
			ctx,
			`update goals
			    set already_saved_cents = greatest(0, already_saved_cents + $2)
			  where id = $1 and user_id = $3`,
			goalID,
			amountCents,
			userID,
		)
		return err
	}
	if err != nil {
		return err
	}

	if existingGoalID != goalID {
		if _, err := tx.Exec(
			ctx,
			`update goals
			    set already_saved_cents = greatest(0, already_saved_cents - $2)
			  where id = $1 and user_id = $3`,
			existingGoalID,
			existingAmount,
			userID,
		); err != nil {
			return err
		}
		if _, err := tx.Exec(
			ctx,
			`update goals
			    set already_saved_cents = greatest(0, already_saved_cents + $2)
			  where id = $1 and user_id = $3`,
			goalID,
			amountCents,
			userID,
		); err != nil {
			return err
		}
	} else {
		delta := amountCents - existingAmount
		if _, err := tx.Exec(
			ctx,
			`update goals
			    set already_saved_cents = greatest(0, already_saved_cents + $2)
			  where id = $1 and user_id = $3`,
			goalID,
			delta,
			userID,
		); err != nil {
			return err
		}
	}

	_, err = tx.Exec(
		ctx,
		`update goal_contributions
		    set goal_id = $2,
		        amount_cents = $3,
		        source = 'plaid',
		        contributed_at = $4
		  where user_id = $1 and transaction_id = $5`,
		userID,
		goalID,
		amountCents,
		candidate.Date,
		candidate.TransactionID,
	)
	return err
}

func RemovePlaidContribution(ctx context.Context, tx pgx.Tx, userID, plaidTransactionID string) error {
	var transactionID string
	err := tx.QueryRow(
		ctx,
		`select id::text
		   from plaid_transactions
		  where user_id = $1 and plaid_transaction_id = $2`,
		userID,
		plaidTransactionID,
	).Scan(&transactionID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil
	}
	if err != nil {
		return err
	}
	return removePlaidContribution(ctx, tx, userID, transactionID)
}

func removePlaidContribution(ctx context.Context, tx pgx.Tx, userID, transactionID string) error {
	var goalID string
	var amountCents int64
	err := tx.QueryRow(
		ctx,
		`delete from goal_contributions
		  where user_id = $1 and transaction_id = $2
		  returning goal_id::text, amount_cents`,
		userID,
		transactionID,
	).Scan(&goalID, &amountCents)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil
	}
	if err != nil {
		return err
	}
	_, err = tx.Exec(
		ctx,
		`update goals
		    set already_saved_cents = greatest(0, already_saved_cents - $2)
		  where id = $1 and user_id = $3`,
		goalID,
		amountCents,
		userID,
	)
	return err
}

func (candidate plaidContributionCandidate) isSavingsTransferIn() bool {
	if candidate.Pending || candidate.AmountCents >= 0 || candidate.AccountID == "" {
		return false
	}
	account := strings.ToUpper(strings.TrimSpace(candidate.AccountType + " " + candidate.Subtype))
	if !strings.Contains(account, "SAVINGS") &&
		!strings.Contains(account, "MONEY MARKET") &&
		!strings.Contains(account, "CASH MANAGEMENT") {
		return false
	}
	category := strings.ToUpper(strings.TrimSpace(candidate.Primary + " " + candidate.Detailed + " " + strings.Join(candidate.Legacy, " ")))
	return strings.Contains(category, "TRANSFER_IN") || strings.Contains(category, "TRANSFER IN")
}

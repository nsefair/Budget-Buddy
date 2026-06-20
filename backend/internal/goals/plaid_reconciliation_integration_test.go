package goals

import (
	"context"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

func TestReconcilePlaidTransactionIsIdempotent(t *testing.T) {
	databaseURL := os.Getenv("TEST_DATABASE_URL")
	if databaseURL == "" {
		t.Skip("TEST_DATABASE_URL is not set")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Close()

	tx, err := pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	suffix := time.Now().UnixNano()
	var userID string
	if err := tx.QueryRow(
		ctx,
		`insert into users (email, password_hash, first_name, onboarding_complete)
		 values ($1, 'test-hash', 'Test', true)
		 returning id::text`,
		fmt.Sprintf("plaid-goal-%d@example.com", suffix),
	).Scan(&userID); err != nil {
		t.Fatal(err)
	}

	var itemID string
	if err := tx.QueryRow(
		ctx,
		`insert into plaid_items (
		   user_id, plaid_item_id, institution_name, access_token_ciphertext
		 ) values ($1, $2, 'Test Bank', 'ciphertext')
		 returning id::text`,
		userID,
		fmt.Sprintf("item-%d", suffix),
	).Scan(&itemID); err != nil {
		t.Fatal(err)
	}

	var accountID string
	if err := tx.QueryRow(
		ctx,
		`insert into plaid_accounts (
		   item_id, user_id, plaid_account_id, name, type, subtype
		 ) values ($1, $2, $3, 'Savings', 'depository', 'savings')
		 returning id::text`,
		itemID,
		userID,
		fmt.Sprintf("account-%d", suffix),
	).Scan(&accountID); err != nil {
		t.Fatal(err)
	}

	var goalID string
	if err := tx.QueryRow(
		ctx,
		`insert into goals (
		   user_id, name, kind, duration, target_amount_cents,
		   already_saved_cents, deadline, linked_account_id
		 ) values ($1, 'Test Goal', 'savings_target', 'medium', 100000, 0, now() + interval '1 year', $2)
		 returning id::text`,
		userID,
		accountID,
	).Scan(&goalID); err != nil {
		t.Fatal(err)
	}

	plaidTransactionID := fmt.Sprintf("transaction-%d", suffix)
	if _, err := tx.Exec(
		ctx,
		`insert into plaid_transactions (
		   user_id, item_id, account_id, plaid_transaction_id, amount_cents,
		   date, name, category, personal_finance_category_primary,
		   personal_finance_category_detailed, pending
		 ) values ($1, $2, $3, $4, -5000, current_date, 'Transfer',
		           array['Transfer'], 'TRANSFER_IN', 'TRANSFER_IN_ACCOUNT_TRANSFER', false)`,
		userID,
		itemID,
		accountID,
		plaidTransactionID,
	); err != nil {
		t.Fatal(err)
	}

	assertReconciledAmount := func(want int64) {
		t.Helper()
		if err := ReconcilePlaidTransaction(ctx, tx, userID, plaidTransactionID); err != nil {
			t.Fatal(err)
		}
		var savedCents int64
		var contributionCount int
		if err := tx.QueryRow(ctx, `select already_saved_cents from goals where id = $1`, goalID).Scan(&savedCents); err != nil {
			t.Fatal(err)
		}
		if err := tx.QueryRow(
			ctx,
			`select count(*) from goal_contributions where goal_id = $1 and source = 'plaid'`,
			goalID,
		).Scan(&contributionCount); err != nil {
			t.Fatal(err)
		}
		if savedCents != want {
			t.Fatalf("saved cents = %d, want %d", savedCents, want)
		}
		if contributionCount != 1 {
			t.Fatalf("contribution count = %d, want 1", contributionCount)
		}
	}

	assertReconciledAmount(5000)
	assertReconciledAmount(5000)

	if _, err := tx.Exec(
		ctx,
		`update plaid_transactions set amount_cents = -7500 where plaid_transaction_id = $1`,
		plaidTransactionID,
	); err != nil {
		t.Fatal(err)
	}
	assertReconciledAmount(7500)
}

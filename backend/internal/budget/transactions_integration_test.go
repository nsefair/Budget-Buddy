package budget

import (
	"context"
	"fmt"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

func TestBankBudgetReconciliation(t *testing.T) {
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("TEST_DATABASE_URL is not set")
	}
	ctx := context.Background()
	db, err := pgxpool.New(ctx, url)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	var user, item, account string
	if err = db.QueryRow(ctx, `insert into users(email,password_hash,first_name) values($1,'test','Test') returning id::text`, fmt.Sprintf("budget-%d@example.com", time.Now().UnixNano())).Scan(&user); err != nil {
		t.Fatal(err)
	}
	defer db.Exec(ctx, `delete from users where id=$1`, user)
	if err = db.QueryRow(ctx, `insert into plaid_items(user_id,plaid_item_id,access_token_ciphertext) values($1,$2,'test') returning id::text`, user, "item-"+user).Scan(&item); err != nil {
		t.Fatal(err)
	}
	if err = db.QueryRow(ctx, `insert into plaid_accounts(user_id,item_id,plaid_account_id,type,subtype) values($1,$2,$3,'depository','checking') returning id::text`, user, item, "account-"+user).Scan(&account); err != nil {
		t.Fatal(err)
	}
	add := func(id string, cents int64, primary, detailed string, pending bool, currency, day, pendingID string) {
		t.Helper()
		_, err := db.Exec(ctx, `insert into plaid_transactions(user_id,item_id,account_id,plaid_transaction_id,name,amount_cents,personal_finance_category_primary,personal_finance_category_detailed,pending,iso_currency_code,date,pending_transaction_id) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,nullif($12,''))`, user, item, account, id+user, id, cents, primary, detailed, pending, currency, day, pendingID)
		if err != nil {
			t.Fatal(err)
		}
	}
	add("paycheck", 250000*-1, "INCOME", "INCOME_WAGES", false, "USD", "2026-10-02", "")
	add("future-pay", -100000, "INCOME", "INCOME_WAGES", true, "USD", "2026-10-03", "")
	add("old-income", -100000, "INCOME", "INCOME_WAGES", false, "USD", "2026-09-03", "")
	add("food", 10000, "FOOD_AND_DRINK", "", false, "USD", "2026-10-03", "")
	add("refund", -2000, "FOOD_AND_DRINK", "", false, "USD", "2026-10-03", "")
	add("pending", 3000, "FOOD_AND_DRINK", "", true, "USD", "2026-10-03", "")
	add("posted", 3500, "FOOD_AND_DRINK", "", false, "USD", "2026-10-03", "pending"+user)
	add("unposted", 1000, "FOOD_AND_DRINK", "", true, "USD", "2026-10-03", "")
	add("Zelle", 5000, "TRANSFER_OUT", "TRANSFER_OUT_OTHER_TRANSFER_OUT", false, "USD", "2026-10-03", "")
	add("incoming-zelle", -7000, "TRANSFER_IN", "TRANSFER_IN_OTHER_TRANSFER_IN", false, "USD", "2026-10-03", "")
	add("own-transfer", 90000, "TRANSFER_OUT", "TRANSFER_OUT_ACCOUNT_TRANSFER", false, "USD", "2026-10-03", "")
	add("card-payment", 80000, "LOAN_PAYMENTS", "LOAN_PAYMENTS_CREDIT_CARD_PAYMENT", false, "USD", "2026-10-03", "")
	add("foreign", 100000, "FOOD_AND_DRINK", "", false, "EUR", "2026-10-03", "")
	// More than a page of unrelated spending must not hide a category's receipts.
	for i := 0; i < 205; i++ {
		add(fmt.Sprintf("shop-%03d", i), 100, "GENERAL_MERCHANDISE", "", false, "USD", "2026-10-04", "")
	}
	h := Handler{db: db}
	req := httptest.NewRequest("GET", "/budget/overview?month=2026-10", nil)
	overview, err := h.buildOverview(req, user, "2026-10")
	if err != nil {
		t.Fatal(err)
	}
	if overview.Income != 2500 || overview.TotalSpent != 380 {
		t.Fatalf("income=%v spent=%v", overview.Income, overview.TotalSpent)
	}
	for _, c := range overview.Categories {
		if c.ID == "food" && c.Spent != 125 {
			t.Fatal(c)
		}
		if c.ID == "uncategorized" && c.Spent != 50 {
			t.Fatal(c)
		}
	}
	months, err := h.availableMonths(req, user)
	if err != nil {
		t.Fatal(err)
	}
	for _, m := range months {
		if m.ID == "2026-10" && m.TotalSpent != overview.TotalSpent {
			t.Fatal(m)
		}
	}
	req = httptest.NewRequest("GET", "/budget/transactions?category=food", nil)
	receipts, err := h.loadTransactions(req, user, "2026-10", 200, 0)
	if err != nil {
		t.Fatal(err)
	}
	if len(receipts) != 4 {
		t.Fatalf("food receipts=%d", len(receipts))
	}
	var net float64
	for _, tx := range receipts {
		net += tx.Amount
	}
	if net != 125 {
		t.Fatal(net)
	}
	req = httptest.NewRequest("GET", "/budget/transactions", nil)
	all, err := h.loadTransactions(req, user, "2026-10", 500, 0)
	if err != nil {
		t.Fatal(err)
	}
	found := false
	for _, tx := range all {
		if tx.CategoryID == "income" && tx.Amount == -2500 {
			found = true
		}
	}
	if !found {
		t.Fatal("paycheck absent from history")
	}
	other, err := h.loadTransactions(req, "00000000-0000-0000-0000-000000000000", "2026-10", 500, 0)
	if err != nil || len(other) != 0 {
		t.Fatal("cross-user data", err)
	}
	if _, err = db.Exec(ctx, `update plaid_items set archived_at=now() where id=$1`, item); err != nil {
		t.Fatal(err)
	}
	all, err = h.loadTransactions(req, user, "2026-10", 500, 0)
	if err != nil || len(all) != 0 {
		t.Fatal("archived bank counted", err)
	}
}

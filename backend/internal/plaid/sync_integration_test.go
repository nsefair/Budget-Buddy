package plaid

import (
	"context"
	"encoding/json"
	"fmt"
	"github.com/jackc/pgx/v5/pgxpool"
	"net/http"
	"net/http/httptest"
	"os"
	"sync/atomic"
	"testing"
	"time"
)

func TestSyncAtomicRollbackAndRetry(t *testing.T) {
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("TEST_DATABASE_URL is not set")
	}
	ctx := context.Background()
	db, e := pgxpool.New(ctx, url)
	if e != nil {
		t.Fatal(e)
	}
	defer db.Close()
	var user, item string
	e = db.QueryRow(ctx, `insert into users(email,password_hash,first_name) values($1,'test','Test') returning id::text`, fmt.Sprintf("sync-%d@example.com", time.Now().UnixNano())).Scan(&user)
	if e != nil {
		t.Fatal(e)
	}
	defer db.Exec(ctx, `delete from users where id=$1`, user)
	e = db.QueryRow(ctx, `insert into plaid_items(user_id,plaid_item_id,access_token_ciphertext,transactions_cursor) values($1,$2,'test','original') returning id::text`, user, "item-"+user).Scan(&item)
	if e != nil {
		t.Fatal(e)
	}
	var fail atomic.Bool
	fail.Store(true)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/accounts/get" {
			json.NewEncoder(w).Encode(AccountsBalanceResponse{Accounts: []AccountBalance{{AccountID: "account-" + user, Type: "depository", Subtype: "checking", Name: "Test checking", Balances: Balances{IsoCurrencyCode: "USD"}}}})
			return
		}
		var req map[string]any
		json.NewDecoder(r.Body).Decode(&req)
		if req["cursor"] == "original" {
			json.NewEncoder(w).Encode(SyncTransactionsResponse{Added: []SyncedTransaction{{TransactionID: "purchase-" + user, AccountID: "account-" + user, IsoCurrencyCode: "USD", Date: "2026-10-03", Name: "Shop", Amount: 10, Pending: true}}, HasMore: true, NextCursor: "next"})
			return
		}
		if fail.Load() {
			w.WriteHeader(500)
			json.NewEncoder(w).Encode(apiError{ErrorCode: "INTERNAL_SERVER_ERROR"})
			return
		}
		json.NewEncoder(w).Encode(SyncTransactionsResponse{NextCursor: "done"})
	}))
	defer server.Close()
	client := &Client{baseURL: server.URL, httpClient: server.Client()}
	if _, e = syncItem(ctx, db, client, user, item, "token", ""); e == nil {
		t.Fatal("expected failure")
	}
	var count int
	var cursor string
	db.QueryRow(ctx, `select count(*) from plaid_transactions where user_id=$1`, user).Scan(&count)
	db.QueryRow(ctx, `select transactions_cursor from plaid_items where id=$1`, item).Scan(&cursor)
	if count != 0 || cursor != "original" {
		t.Fatalf("partial update committed: %d %s", count, cursor)
	}
	fail.Store(false)
	result, e := syncItem(ctx, db, client, user, item, "token", "")
	if e != nil || result.TotalTransactions != 1 {
		t.Fatal(result, e)
	}
	db.QueryRow(ctx, `select transactions_cursor from plaid_items where id=$1`, item).Scan(&cursor)
	if cursor != "done" {
		t.Fatal(cursor)
	}
	var linked int
	if e = db.QueryRow(ctx, `select count(*) from plaid_transactions pt join plaid_accounts pa on pa.id=pt.account_id where pt.user_id=$1 and pa.is_active and pa.type='depository' and pa.subtype='checking'`, user).Scan(&linked); e != nil || linked != 1 {
		t.Fatal("synced transaction did not link to its account", e, linked)
	}
	// Existing orphaned rows are repaired even when a later sync has no new page.
	_, e = db.Exec(ctx, `update plaid_transactions set account_id=null where user_id=$1`, user)
	if e != nil {
		t.Fatal(e)
	}
	if _, e = syncItem(ctx, db, client, user, item, "token", ""); e != nil {
		t.Fatal(e)
	}
	if e = db.QueryRow(ctx, `select count(*) from plaid_transactions where user_id=$1 and account_id is not null`, user).Scan(&linked); e != nil || linked != 1 {
		t.Fatal("orphan repair failed", e, linked)
	}

}

package money

import (
	"context"
	"encoding/json"
	"fmt"
	"github.com/jackc/pgx/v5/pgxpool"
	"os"
	"strings"
	"testing"
	"time"
)

func TestPersistedBaselineAndMissedPayday(t *testing.T) {
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
	var user string
	e = db.QueryRow(ctx, `insert into users(email,password_hash,first_name) values($1,'test','Test') returning id::text`, fmt.Sprintf("money-%d@example.com", time.Now().UnixNano())).Scan(&user)
	if e != nil {
		t.Fatal(e)
	}
	defer db.Exec(ctx, `delete from users where id=$1`, user)
	p := Profile{Timezone: "America/New_York", StartDate: "2026-10-01", Sources: []IncomeSource{{ID: "job", AmountCents: 140000, PeriodDays: 14, NextArrival: "2026-10-15"}}}
	c, _ := BuildCycle(p)
	_, e = db.Exec(ctx, `insert into money_profiles(user_id,profile,cycle) values($1,$2::jsonb,$3::jsonb)`, user, marshal(p), marshal(c))
	if e != nil {
		t.Fatal(e)
	}
	h := Handler{db: db, now: func() time.Time { return time.Date(2026, 10, 9, 12, 0, 0, 0, time.UTC) }}
	calculate := func() todayResponse {
		t.Helper()
		tx, e := begin(ctx, db, user)
		if e != nil {
			t.Fatal(e)
		}
		defer tx.Rollback(ctx)
		r, e := h.calculate(ctx, tx, user)
		if e != nil {
			t.Fatal(e)
		}
		if e = tx.Commit(ctx); e != nil {
			t.Fatal(e)
		}
		return r
	}
	first := calculate()
	if first.Result.MorningCents != 21000 {
		t.Fatal(first.Result)
	}
	_, e = db.Exec(ctx, `insert into money_manual_entries(user_id,client_id,date,amount_cents) values($1,'expense-1','2026-10-09',1700)`, user)
	if e != nil {
		t.Fatal(e)
	}
	second := calculate()
	if second.Result.MorningCents != first.Result.MorningCents || second.Result.RemainingCents != 19300 {
		t.Fatal(second.Result)
	}
	var count int
	db.QueryRow(ctx, `select count(*) from money_daily_snapshots where user_id=$1`, user).Scan(&count)
	if count != 1 {
		t.Fatal(count)
	}
	// A snapshot stores the exact original inputs as well as the latest recomputation.
	var raw json.RawMessage
	db.QueryRow(ctx, `select morning_inputs from money_daily_snapshots where user_id=$1`, user).Scan(&raw)
	if !strings.Contains(string(raw), `"spentTodayCents": 0`) {
		t.Fatal(string(raw))
	}
	h.now = func() time.Time { return time.Date(2026, 10, 16, 12, 0, 0, 0, time.UTC) }
	calculate()
	calculate()
	db.QueryRow(ctx, `select count(*) from money_events where user_id=$1 and kind='payday_missed'`, user).Scan(&count)
	if count != 1 {
		t.Fatal("duplicate missed payday", count)
	}

}

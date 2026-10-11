package money

import (
	"budget-buddy/backend/internal/auth"
	"budget-buddy/backend/internal/config"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"github.com/jackc/pgx/v5/pgxpool"
	"log/slog"
	"net/http"
	"net/http/httptest"
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
	// Editing income must persist an updated calculation in the same request,
	// while keeping the original morning baseline and today's spending intact.
	cfg := config.Config{JWTAccessSecret: "synthetic-test-secret-only", AccessTokenTTL: time.Hour}
	manager := auth.NewTokenManager(cfg)
	token, _, e := manager.GenerateAccessToken(auth.User{ID: user, Email: "test@example.com"})
	if e != nil {
		t.Fatal(e)
	}
	authHandler := auth.NewHandler(auth.NewService(db, cfg, slog.Default()))
	save := func(amount int64) todayResponse {
		t.Helper()
		p.Sources[0].AmountCents = amount
		req := httptest.NewRequest("PUT", "/money/profile", bytes.NewBufferString(marshal(p)))
		req.Header.Set("Authorization", "Bearer "+token)
		rec := httptest.NewRecorder()
		authHandler.RequireAuth(http.HandlerFunc(h.saveProfile)).ServeHTTP(rec, req)
		if rec.Code != 200 {
			t.Fatalf("save: %d %s", rec.Code, rec.Body.String())
		}
		var payload struct {
			Today todayResponse `json:"today"`
		}
		if e := json.Unmarshal(rec.Body.Bytes(), &payload); e != nil {
			t.Fatal(e)
		}
		return payload.Today
	}
	edited := save(280000)
	if edited.Result.MorningCents != first.Result.MorningCents || edited.Result.RemainingCents != 19300 || edited.Result.Inputs.Cycle.IncomeCents != 280000 {
		t.Fatal(edited.Result)
	}
	decreased := save(1000)
	if decreased.Result.MorningCents != first.Result.MorningCents || decreased.Result.RemainingCents != 0 {
		t.Fatal(decreased.Result)
	}
	save(140000)
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

// Yesterday's result and its movable amount come from stored snapshots, and
// allocate moves exactly the amount Today showed, once.
func TestYesterdayResultMatchesAllocate(t *testing.T) {
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
	var user, goal string
	e = db.QueryRow(ctx, `insert into users(email,password_hash,first_name) values($1,'test','Test') returning id::text`, fmt.Sprintf("money-history-%d@example.com", time.Now().UnixNano())).Scan(&user)
	if e != nil {
		t.Fatal(e)
	}
	defer db.Exec(ctx, `delete from users where id=$1`, user)
	e = db.QueryRow(ctx, `insert into goals(user_id,name,kind,duration,target_amount_cents,deadline) values($1,'Synthetic goal','savings_target','medium',80000,'2027-03-01') returning id::text`, user).Scan(&goal)
	if e != nil {
		t.Fatal(e)
	}
	p := Profile{Timezone: "America/New_York", StartDate: "2026-10-01", Sources: []IncomeSource{{ID: "job", AmountCents: 140000, PeriodDays: 14, NextArrival: "2026-10-15"}}}
	c, _ := BuildCycle(p)
	if _, e = db.Exec(ctx, `insert into money_profiles(user_id,profile,cycle) values($1,$2::jsonb,$3::jsonb)`, user, marshal(p), marshal(c)); e != nil {
		t.Fatal(e)
	}
	h := Handler{db: db, now: func() time.Time { return time.Date(2026, 10, 8, 16, 0, 0, 0, time.UTC) }}
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
	if first.Yesterday != nil || len(first.RecentDays) != 0 {
		t.Fatal("no history before the first stored morning", first.Yesterday, first.RecentDays)
	}
	if _, e = db.Exec(ctx, `insert into money_manual_entries(user_id,client_id,date,amount_cents) values($1,'history-1','2026-10-08',1700)`, user); e != nil {
		t.Fatal(e)
	}
	h.now = func() time.Time { return time.Date(2026, 10, 9, 16, 0, 0, 0, time.UTC) }
	next := calculate()
	y := next.Yesterday
	if y == nil || y.Date != "2026-10-08" || y.MorningCents != first.Result.MorningCents || y.SpentCents != 1700 || y.Status != "under" {
		t.Fatal(y)
	}
	if len(next.RecentDays) != 1 || next.RecentDays[0] != y.DayResult {
		t.Fatal(next.RecentDays)
	}
	if want := MovableCents(y.DayResult, next.Result); y.MovableCents != want || want <= 0 || y.AllocatedCents != 0 {
		t.Fatal(y, want)
	}

	cfg := config.Config{JWTAccessSecret: "synthetic-test-secret-only", AccessTokenTTL: time.Hour}
	token, _, e := auth.NewTokenManager(cfg).GenerateAccessToken(auth.User{ID: user, Email: "test@example.com"})
	if e != nil {
		t.Fatal(e)
	}
	authHandler := auth.NewHandler(auth.NewService(db, cfg, slog.Default()))
	allocate := func() map[string]any {
		t.Helper()
		req := httptest.NewRequest("POST", "/money/yesterday/allocate", bytes.NewBufferString(marshal(map[string]string{"goalId": goal})))
		req.Header.Set("Authorization", "Bearer "+token)
		rec := httptest.NewRecorder()
		authHandler.RequireAuth(http.HandlerFunc(h.allocate)).ServeHTTP(rec, req)
		if rec.Code != 200 {
			t.Fatalf("allocate: %d %s", rec.Code, rec.Body.String())
		}
		var out map[string]any
		if e := json.Unmarshal(rec.Body.Bytes(), &out); e != nil {
			t.Fatal(e)
		}
		return out
	}
	moved := allocate()
	if moved["allocatedCents"] != float64(y.MovableCents) || moved["alreadyAllocated"] != false {
		t.Fatal(moved, y.MovableCents)
	}
	again := allocate()
	if again["allocatedCents"] != float64(y.MovableCents) || again["alreadyAllocated"] != true {
		t.Fatal("second tap must not move money again", again)
	}
	after := calculate()
	if after.Yesterday == nil || after.Yesterday.AllocatedCents != y.MovableCents || after.Yesterday.GoalID != goal || after.Yesterday.MovableCents != 0 {
		t.Fatal(after.Yesterday)
	}
	var saved int64
	db.QueryRow(ctx, `select already_saved_cents from goals where id=$1`, goal).Scan(&saved)
	if saved != y.MovableCents {
		t.Fatal("goal progress", saved)
	}
}

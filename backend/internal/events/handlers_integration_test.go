package events

import (
	"bytes"
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"budget-buddy/backend/internal/auth"
	"budget-buddy/backend/internal/config"
)

func TestRecordAcceptsOnlyBetaEvents(t *testing.T) {
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
	e = db.QueryRow(ctx, `insert into users(email,password_hash,first_name) values($1,'test','Test') returning id::text`, fmt.Sprintf("events-%d@example.com", time.Now().UnixNano())).Scan(&user)
	if e != nil {
		t.Fatal(e)
	}
	defer db.Exec(ctx, `delete from users where id=$1`, user)

	cfg := config.Config{JWTAccessSecret: "synthetic-test-secret-only", AccessTokenTTL: time.Hour}
	token, _, e := auth.NewTokenManager(cfg).GenerateAccessToken(auth.User{ID: user, Email: "test@example.com"})
	if e != nil {
		t.Fatal(e)
	}
	authHandler := auth.NewHandler(auth.NewService(db, cfg, slog.Default()))
	mux := http.NewServeMux()
	RegisterRoutes(mux, "/v1", db, authHandler.RequireAuth)
	post := func(body string) int {
		t.Helper()
		req := httptest.NewRequest("POST", "/v1/events", bytes.NewBufferString(body))
		req.Header.Set("Authorization", "Bearer "+token)
		req.Header.Set("Content-Type", "application/json")
		rec := httptest.NewRecorder()
		mux.ServeHTTP(rec, req)
		return rec.Code
	}

	if code := post(`{"kind":"app_open"}`); code != http.StatusNoContent {
		t.Fatal("app_open", code)
	}
	if code := post(`{"kind":"number_report","detail":{"displayDollars":38}}`); code != http.StatusNoContent {
		t.Fatal("number_report", code)
	}
	if code := post(`{"kind":"anything_else"}`); code != http.StatusBadRequest {
		t.Fatal("unknown kind", code)
	}
	big := `{"kind":"number_tap","detail":{"note":"` + strings.Repeat("x", 3000) + `"}}`
	if code := post(big); code != http.StatusBadRequest {
		t.Fatal("oversized detail", code)
	}
	var count int
	db.QueryRow(ctx, `select count(*) from app_events where user_id=$1`, user).Scan(&count)
	if count != 2 {
		t.Fatal("recorded", count)
	}
	var detail string
	db.QueryRow(ctx, `select detail::text from app_events where user_id=$1 and kind='number_report'`, user).Scan(&detail)
	if !strings.Contains(detail, `"displayDollars": 38`) {
		t.Fatal(detail)
	}
}

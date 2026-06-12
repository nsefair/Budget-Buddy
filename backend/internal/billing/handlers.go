package billing

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"budget-buddy/backend/internal/auth"
	"budget-buddy/backend/internal/config"
	"budget-buddy/backend/internal/respond"
)

const signatureHeader = "X-Budget-Buddy-Signature"

type authMiddleware func(http.Handler) http.Handler

type Handler struct {
	db  *pgxpool.Pool
	cfg config.Config
}

type Plan struct {
	Tier       string            `json:"tier"`
	Name       string            `json:"name"`
	ProductIDs map[string]string `json:"productIds"`
	Available  bool              `json:"available"`
}

type PlansResponse struct {
	Provider string `json:"provider"`
	Plans    []Plan `json:"plans"`
}

type Subscription struct {
	Tier              string     `json:"tier"`
	Status            string     `json:"status"`
	Provider          string     `json:"provider"`
	ProductID         *string    `json:"productId,omitempty"`
	CurrentPeriodEnd  *time.Time `json:"currentPeriodEnd,omitempty"`
	CancelAtPeriodEnd bool       `json:"cancelAtPeriodEnd"`
	Environment       string     `json:"environment"`
}

type EntitlementEvent struct {
	EventID                string  `json:"eventId"`
	EventType              string  `json:"eventType"`
	UserID                 string  `json:"userId"`
	Tier                   string  `json:"tier"`
	Status                 string  `json:"status"`
	Provider               string  `json:"provider"`
	ProductID              *string `json:"productId"`
	ProviderCustomerID     *string `json:"providerCustomerId"`
	ProviderSubscriptionID *string `json:"providerSubscriptionId"`
	CurrentPeriodEnd       *string `json:"currentPeriodEnd"`
	CancelAtPeriodEnd      bool    `json:"cancelAtPeriodEnd"`
	Environment            string  `json:"environment"`
}

func RegisterRoutes(mux *http.ServeMux, basePath string, db *pgxpool.Pool, cfg config.Config, requireAuth authMiddleware) {
	handler := &Handler{db: db, cfg: cfg}
	mux.HandleFunc("GET "+basePath+"/payments/plans", handler.plans)
	mux.Handle("GET "+basePath+"/user/subscription", requireAuth(http.HandlerFunc(handler.subscription)))
	mux.HandleFunc("POST "+basePath+"/payments/webhooks/entitlements", handler.entitlementWebhook)
}

func (h *Handler) plans(w http.ResponseWriter, _ *http.Request) {
	respond.JSON(w, http.StatusOK, PlansResponse{
		Provider: "app_store",
		Plans: []Plan{
			{Tier: "free", Name: "Free", ProductIDs: map[string]string{}, Available: true},
			{
				Tier: "premium", Name: "Premium", Available: false,
				ProductIDs: map[string]string{"monthly": h.cfg.IOSPremiumMonthlyID, "annual": h.cfg.IOSPremiumAnnualID},
			},
			{
				Tier: "elite", Name: "Elite", Available: false,
				ProductIDs: map[string]string{"monthly": h.cfg.IOSEliteMonthlyID, "annual": h.cfg.IOSEliteAnnualID},
			},
		},
	})
}

func (h *Handler) subscription(w http.ResponseWriter, r *http.Request) {
	userID, _ := auth.UserIDFromContext(r.Context())
	if _, err := h.db.Exec(r.Context(), `
		insert into subscription_entitlements (user_id)
		values ($1) on conflict (user_id) do nothing`, userID); err != nil {
		respond.Error(w, http.StatusInternalServerError, "internal_error", "Could not load subscription.")
		return
	}

	var subscription Subscription
	err := h.db.QueryRow(r.Context(), `
		select case when status in ('trialing', 'active', 'grace_period') then tier else 'free' end,
		       status, provider, product_id, current_period_end,
		       cancel_at_period_end, environment
		  from subscription_entitlements where user_id = $1`, userID).Scan(
		&subscription.Tier, &subscription.Status, &subscription.Provider,
		&subscription.ProductID, &subscription.CurrentPeriodEnd,
		&subscription.CancelAtPeriodEnd, &subscription.Environment,
	)
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "internal_error", "Could not load subscription.")
		return
	}
	respond.JSON(w, http.StatusOK, subscription)
}

func (h *Handler) entitlementWebhook(w http.ResponseWriter, r *http.Request) {
	if len(h.cfg.BillingWebhookSecret) < 16 {
		respond.Error(w, http.StatusServiceUnavailable, "billing_not_configured", "Billing webhook is not configured.")
		return
	}
	body, err := readLimitedBody(r, 1<<20)
	if err != nil {
		respond.Error(w, http.StatusBadRequest, "invalid_body", "Request body is too large or unreadable.")
		return
	}
	if !validSignature(body, r.Header.Get(signatureHeader), h.cfg.BillingWebhookSecret) {
		respond.Error(w, http.StatusUnauthorized, "invalid_signature", "Webhook signature is invalid.")
		return
	}

	var event EntitlementEvent
	decoder := json.NewDecoder(strings.NewReader(string(body)))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&event); err != nil {
		respond.Error(w, http.StatusBadRequest, "invalid_json", "Request body must be valid JSON.")
		return
	}
	periodEnd, err := validateEvent(event)
	if err != nil {
		respond.Error(w, http.StatusBadRequest, "validation_error", err.Error())
		return
	}

	duplicate, err := h.applyEvent(r.Context(), event, body, periodEnd)
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "billing_event_failed", "Could not apply billing event.")
		return
	}
	respond.JSON(w, http.StatusOK, map[string]bool{"received": true, "duplicate": duplicate})
}

func (h *Handler) applyEvent(ctx context.Context, event EntitlementEvent, payload []byte, periodEnd *time.Time) (bool, error) {
	tx, err := h.db.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return false, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var billingEventID string
	err = tx.QueryRow(ctx, `
		insert into billing_events (provider, event_id, event_type, payload)
		values ($1, $2, $3, $4::jsonb)
		on conflict (provider, event_id) do nothing
		returning id::text`, event.Provider, event.EventID, event.EventType, string(payload)).Scan(&billingEventID)
	if errors.Is(err, pgx.ErrNoRows) {
		return true, tx.Commit(ctx)
	}
	if err != nil {
		return false, err
	}

	_, err = tx.Exec(ctx, `
		insert into subscription_entitlements (
		  user_id, tier, status, provider, product_id, provider_customer_id,
		  provider_subscription_id, current_period_end, cancel_at_period_end, environment
		) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
		on conflict (user_id) do update set
		  tier = excluded.tier,
		  status = excluded.status,
		  provider = excluded.provider,
		  product_id = excluded.product_id,
		  provider_customer_id = excluded.provider_customer_id,
		  provider_subscription_id = excluded.provider_subscription_id,
		  current_period_end = excluded.current_period_end,
		  cancel_at_period_end = excluded.cancel_at_period_end,
		  environment = excluded.environment`,
		event.UserID, event.Tier, event.Status, event.Provider, event.ProductID,
		event.ProviderCustomerID, event.ProviderSubscriptionID, periodEnd,
		event.CancelAtPeriodEnd, event.Environment,
	)
	if err != nil {
		return false, err
	}

	effectiveTier := "free"
	if event.Status == "trialing" || event.Status == "active" || event.Status == "grace_period" {
		effectiveTier = event.Tier
	}
	if _, err := tx.Exec(ctx, "update users set subscription_tier = $2 where id = $1", event.UserID, effectiveTier); err != nil {
		return false, err
	}
	if _, err := tx.Exec(ctx, "update billing_events set processed_at = now() where id = $1", billingEventID); err != nil {
		return false, err
	}
	return false, tx.Commit(ctx)
}

func validateEvent(event EntitlementEvent) (*time.Time, error) {
	if strings.TrimSpace(event.EventID) == "" || strings.TrimSpace(event.UserID) == "" {
		return nil, errors.New("eventId and userId are required")
	}
	if event.Tier != "free" && event.Tier != "premium" && event.Tier != "elite" {
		return nil, errors.New("tier is invalid")
	}
	if event.Status != "inactive" && event.Status != "trialing" && event.Status != "active" &&
		event.Status != "grace_period" && event.Status != "expired" && event.Status != "revoked" {
		return nil, errors.New("status is invalid")
	}
	if event.Provider != "apple" && event.Provider != "google" && event.Provider != "revenuecat" && event.Provider != "manual" {
		return nil, errors.New("provider is invalid")
	}
	if event.Environment != "sandbox" && event.Environment != "production" {
		return nil, errors.New("environment is invalid")
	}
	if event.CurrentPeriodEnd == nil || strings.TrimSpace(*event.CurrentPeriodEnd) == "" {
		return nil, nil
	}
	parsed, err := time.Parse(time.RFC3339, *event.CurrentPeriodEnd)
	if err != nil {
		return nil, errors.New("currentPeriodEnd must be RFC3339")
	}
	parsed = parsed.UTC()
	return &parsed, nil
}

func validSignature(body []byte, header, secret string) bool {
	provided := strings.TrimSpace(strings.TrimPrefix(header, "sha256="))
	decoded, err := hex.DecodeString(provided)
	if err != nil {
		return false
	}
	mac := hmac.New(sha256.New, []byte(secret))
	_, _ = mac.Write(body)
	return hmac.Equal(decoded, mac.Sum(nil))
}

func readLimitedBody(r *http.Request, limit int64) ([]byte, error) {
	body, err := io.ReadAll(io.LimitReader(r.Body, limit+1))
	if err != nil {
		return nil, err
	}
	if int64(len(body)) > limit {
		return nil, errors.New("body too large")
	}
	return body, nil
}

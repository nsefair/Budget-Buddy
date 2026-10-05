package plaid

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"budget-buddy/backend/internal/auth"
	"budget-buddy/backend/internal/config"
	"budget-buddy/backend/internal/requestjson"
	"budget-buddy/backend/internal/respond"
)

type authMiddleware func(http.Handler) http.Handler

type Handler struct {
	db              *pgxpool.Pool
	cfg             config.Config
	webhookVerifier plaidWebhookVerifier
	webhookEvents   webhookEventRecorder
}

type plaidWebhookVerifier interface {
	Verify(context.Context, string, []byte) (verifiedWebhook, error)
}

type failedWebhookVerifier struct {
	err error
}

func (v failedWebhookVerifier) Verify(context.Context, string, []byte) (verifiedWebhook, error) {
	return verifiedWebhook{}, v.err
}

type webhookEnvelope struct {
	ItemID      string `json:"item_id"`
	WebhookType string `json:"webhook_type"`
	WebhookCode string `json:"webhook_code"`
}

type statusResponse struct {
	Configured           bool                 `json:"configured"`
	EncryptionConfigured bool                 `json:"encryptionConfigured"`
	OAuthConfigured      bool                 `json:"oauthConfigured"`
	Environment          string               `json:"environment"`
	Products             []string             `json:"products"`
	OptionalProducts     []string             `json:"optionalProducts"`
	CountryCodes         []string             `json:"countryCodes"`
	Message              string               `json:"message,omitempty"`
	Connections          []connectionResponse `json:"connections"`
}

type connectionResponse struct {
	ID              string            `json:"id"`
	InstitutionID   string            `json:"institutionId,omitempty"`
	InstitutionName string            `json:"institutionName"`
	Status          string            `json:"status"`
	AccountCount    int               `json:"accountCount"`
	LastSyncAt      *string           `json:"lastSyncAt,omitempty"`
	ErrorCode       string            `json:"errorCode,omitempty"`
	CreatedAt       string            `json:"createdAt"`
	Accounts        []accountResponse `json:"accounts"`
}

type accountResponse struct {
	ID             string `json:"id"`
	PlaidAccountID string `json:"plaidAccountId"`
	Name           string `json:"name"`
	Mask           string `json:"mask,omitempty"`
	Type           string `json:"type"`
	Subtype        string `json:"subtype"`
	Active         bool   `json:"active"`
}

type linkTokenRouteResponse struct {
	Configured bool   `json:"configured"`
	LinkToken  string `json:"linkToken,omitempty"`
	Expiration string `json:"expiration,omitempty"`
	RequestID  string `json:"requestId,omitempty"`
	Message    string `json:"message,omitempty"`
}

type exchangeRequest struct {
	PublicToken string           `json:"publicToken"`
	Metadata    exchangeMetadata `json:"metadata"`
}

type exchangeMetadata struct {
	Institution   institutionMetadata `json:"institution"`
	Accounts      []accountMetadata   `json:"accounts"`
	LinkSessionID string              `json:"linkSessionId"`
}

type institutionMetadata struct {
	ID            string `json:"id"`
	InstitutionID string `json:"institution_id"`
	Name          string `json:"name"`
}

type accountMetadata struct {
	ID                 string `json:"id"`
	AccountID          string `json:"account_id"`
	Name               string `json:"name"`
	Mask               string `json:"mask"`
	Type               string `json:"type"`
	Subtype            string `json:"subtype"`
	VerificationStatus string `json:"verification_status"`
}

type exchangeResponse struct {
	ItemID       string `json:"itemId"`
	RequestID    string `json:"requestId"`
	AccountCount int    `json:"accountCount"`
}

func RegisterRoutes(mux *http.ServeMux, basePath string, db *pgxpool.Pool, cfg config.Config, requireAuth authMiddleware) {
	verifier, err := newWebhookVerifier(cfg)
	var webhookVerifier plaidWebhookVerifier = verifier
	if err != nil {
		webhookVerifier = failedWebhookVerifier{err: errInvalidWebhookVerification}
	}
	handler := &Handler{
		db:              db,
		cfg:             cfg,
		webhookVerifier: webhookVerifier,
		webhookEvents:   postgresWebhookEventRecorder{db: db},
	}
	mux.Handle("GET "+basePath+"/plaid/status", requireAuth(http.HandlerFunc(handler.status)))
	mux.Handle("POST "+basePath+"/plaid/link-token", requireAuth(http.HandlerFunc(handler.createLinkToken)))
	mux.Handle("POST "+basePath+"/plaid/update-complete", requireAuth(http.HandlerFunc(handler.completeUpdate)))
	mux.Handle("POST "+basePath+"/plaid/exchange", requireAuth(http.HandlerFunc(handler.exchange)))
	mux.Handle("GET "+basePath+"/plaid/accounts", requireAuth(http.HandlerFunc(handler.status)))
	mux.Handle("POST "+basePath+"/plaid/sync", requireAuth(http.HandlerFunc(handler.sync)))
	mux.Handle("POST "+basePath+"/plaid/webhook", http.HandlerFunc(handler.webhook))
}

func (h *Handler) status(w http.ResponseWriter, r *http.Request) {
	userID, _ := auth.UserIDFromContext(r.Context())

	connections, err := h.loadConnections(r, userID)
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "plaid_status_failed", "Could not load bank connections.")
		return
	}

	oauthConfigured := strings.TrimSpace(h.cfg.PlaidRedirectURI) != ""
	body := statusResponse{
		Configured:           h.cfg.PlaidConfigured(),
		EncryptionConfigured: h.cfg.PlaidTokenEncryptionConfigured(),
		OAuthConfigured:      oauthConfigured,
		Environment:          firstNonEmpty(h.cfg.PlaidEnvironment, "sandbox"),
		Products:             h.cfg.PlaidProducts,
		OptionalProducts:     h.cfg.PlaidOptionalProducts,
		CountryCodes:         h.cfg.PlaidCountryCodes,
		Connections:          connections,
	}
	if !body.Configured {
		body.Message = "Add PLAID_CLIENT_ID and PLAID_SECRET to the backend environment to enable Plaid Link."
	} else if !body.EncryptionConfigured {
		body.Message = "Add PLAID_TOKEN_ENCRYPTION_KEY before opening Plaid Link."
	}

	respond.JSON(w, http.StatusOK, body)
}

func (h *Handler) createLinkToken(w http.ResponseWriter, r *http.Request) {
	userID, _ := auth.UserIDFromContext(r.Context())

	if !h.cfg.PlaidConfigured() {
		respond.JSON(w, http.StatusOK, linkTokenRouteResponse{
			Configured: false,
			Message:    "Plaid credentials are not configured on the backend yet.",
		})
		return
	}
	if !h.cfg.PlaidTokenEncryptionConfigured() {
		respond.Error(w, http.StatusServiceUnavailable, "plaid_encryption_key_missing", "Plaid token encryption must be configured before linking accounts.")
		return
	}

	client, err := NewClient(h.cfg)
	if err != nil {
		respond.Error(w, http.StatusServiceUnavailable, "plaid_config_invalid", "Plaid environment is not configured correctly.")
		return
	}

	var request struct {
		ItemID string `json:"itemId"`
	}
	if r.ContentLength != 0 {
		if err := decodeJSON(w, r, &request); err != nil {
			respond.JSONBodyError(w, err)
			return
		}
	}
	accessToken := ""
	if request.ItemID != "" {
		var ciphertext string
		err := h.db.QueryRow(r.Context(), `select access_token_ciphertext from plaid_items where id::text=$1 and user_id=$2 and archived_at is null`, request.ItemID, userID).Scan(&ciphertext)
		if err != nil {
			respond.Error(w, 404, "bank_not_found", "Bank connection not found.")
			return
		}
		accessToken, err = decryptToken(h.cfg.PlaidTokenEncryptionKey, ciphertext)
		if err != nil {
			respond.Error(w, 500, "bank_unavailable", "Could not open this bank connection.")
			return
		}
	}
	if request.ItemID == "" && h.cfg.PlaidEnvironment == "production" {
		if err := h.reserveTrialSlot(r.Context(), userID); err != nil {
			respond.Error(w, 409, "plaid_trial_limit", err.Error())
			return
		}
	}
	linkToken, err := client.CreateLinkToken(r.Context(), LinkTokenRequest{
		AccessToken:        accessToken,
		ClientName:         h.cfg.PlaidClientName,
		ClientUserID:       userID,
		Products:           h.cfg.PlaidProducts,
		OptionalProducts:   h.cfg.PlaidOptionalProducts,
		CountryCodes:       h.cfg.PlaidCountryCodes,
		Language:           "en",
		WebhookURL:         h.cfg.PlaidWebhookURL,
		RedirectURI:        h.cfg.PlaidRedirectURI,
		AndroidPackageName: h.cfg.PlaidAndroidPackageName,
		TransactionDays:    h.cfg.PlaidTransactionDays,
	})
	if err != nil {
		respond.Error(w, http.StatusBadGateway, "plaid_link_token_failed", safePlaidMessage(err, "Could not create a Plaid Link token."))
		return
	}

	respond.JSON(w, http.StatusOK, linkTokenRouteResponse{
		Configured: true,
		LinkToken:  linkToken.LinkToken,
		Expiration: linkToken.Expiration,
		RequestID:  linkToken.RequestID,
	})
}

func (h *Handler) exchange(w http.ResponseWriter, r *http.Request) {
	userID, _ := auth.UserIDFromContext(r.Context())

	if !h.cfg.PlaidConfigured() {
		respond.Error(w, http.StatusServiceUnavailable, "plaid_not_configured", "Plaid credentials are not configured on the backend yet.")
		return
	}
	if !h.cfg.PlaidTokenEncryptionConfigured() {
		respond.Error(w, http.StatusServiceUnavailable, "plaid_encryption_key_missing", "Plaid token encryption must be configured before linking accounts.")
		return
	}

	var req exchangeRequest
	if err := decodeJSON(w, r, &req); err != nil {
		respond.JSONBodyError(w, err)
		return
	}
	publicToken := strings.TrimSpace(req.PublicToken)
	if publicToken == "" {
		respond.Error(w, http.StatusBadRequest, "validation_error", "A Plaid public token is required.")
		return
	}

	client, err := NewClient(h.cfg)
	if err != nil {
		respond.Error(w, http.StatusServiceUnavailable, "plaid_config_invalid", "Plaid environment is not configured correctly.")
		return
	}

	exchanged, err := client.ExchangePublicToken(r.Context(), publicToken)
	if err != nil {
		respond.Error(w, http.StatusBadGateway, "plaid_exchange_failed", safePlaidMessage(err, "Could not exchange the Plaid public token."))
		return
	}

	// Trust account types and IDs returned by Plaid, not mobile Link metadata.
	accounts, err := client.GetAccountsBalance(r.Context(), exchanged.AccessToken)
	if err != nil {
		respond.Error(w, 502, "plaid_accounts_failed", "Could not verify bank accounts.")
		return
	}
	req.Metadata.Accounts = nil
	for _, a := range accounts.Accounts {
		req.Metadata.Accounts = append(req.Metadata.Accounts, accountMetadata{ID: a.AccountID, Name: a.Name, Mask: a.Mask, Type: a.Type, Subtype: a.Subtype})
	}
	encryptedToken, err := encryptToken(h.cfg.PlaidTokenEncryptionKey, exchanged.AccessToken)
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "plaid_token_encrypt_failed", "Could not secure the Plaid access token.")
		return
	}

	tx, err := h.db.BeginTx(r.Context(), pgx.TxOptions{})
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "plaid_exchange_failed", "Could not save the bank connection.")
		return
	}
	defer func() {
		_ = tx.Rollback(r.Context())
	}()

	itemID, err := h.upsertItem(r, tx, userID, exchanged.ItemID, encryptedToken, req.Metadata)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			respond.Error(w, http.StatusConflict, "plaid_item_conflict", "This bank item is already connected to another account.")
			return
		}
		respond.Error(w, http.StatusInternalServerError, "plaid_exchange_failed", "Could not save the bank connection.")
		return
	}

	accountCount, err := h.upsertAccounts(r, tx, itemID, userID, req.Metadata.Accounts)
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "plaid_exchange_failed", "Could not save linked accounts.")
		return
	}

	if err := tx.Commit(r.Context()); err != nil {
		respond.Error(w, http.StatusInternalServerError, "plaid_exchange_failed", "Could not finish saving the bank connection.")
		return
	}

	// The client requests the initial sync; signed transaction webhooks also retry it.

	respond.JSON(w, http.StatusCreated, exchangeResponse{
		ItemID:       itemID,
		RequestID:    exchanged.RequestID,
		AccountCount: accountCount,
	})
}

func (h *Handler) sync(w http.ResponseWriter, r *http.Request) {
	userID, _ := auth.UserIDFromContext(r.Context())

	if !h.cfg.PlaidConfigured() {
		respond.Error(w, http.StatusServiceUnavailable, "plaid_not_configured", "Plaid credentials are not configured on the backend yet.")
		return
	}

	var itemCount int
	if err := h.db.QueryRow(
		r.Context(),
		`select count(*) from plaid_items
		  where user_id = $1 and archived_at is null`,
		userID,
	).Scan(&itemCount); err != nil {
		respond.Error(w, http.StatusInternalServerError, "plaid_sync_failed", "Could not inspect linked bank connections.")
		return
	}

	if itemCount == 0 {
		respond.JSON(w, http.StatusOK, map[string]any{
			"synced":  false,
			"message": "No linked bank accounts yet.",
			"items":   []SyncResult{},
		})
		return
	}

	results, err := SyncUserItems(r.Context(), h.db, h.cfg, userID)
	if err != nil {
		respond.Error(w, http.StatusBadGateway, "plaid_sync_failed", safePlaidMessage(err, "Could not sync transactions from Plaid."))
		return
	}

	respond.JSON(w, http.StatusOK, map[string]any{
		"synced": true,
		"items":  results,
	})
}

func (h *Handler) webhook(w http.ResponseWriter, r *http.Request) {
	signedJWT := strings.TrimSpace(r.Header.Get("Plaid-Verification"))
	if signedJWT == "" {
		respond.Error(w, http.StatusUnauthorized, "invalid_plaid_verification", "Plaid webhook verification failed.")
		return
	}

	rawBody, err := requestjson.ReadRaw(w, r, requestjson.DefaultMaxBytes)
	if err != nil {
		respond.JSONBodyError(w, err)
		return
	}
	verified, err := h.webhookVerifier.Verify(r.Context(), signedJWT, rawBody)
	if err != nil {
		respond.Error(w, http.StatusUnauthorized, "invalid_plaid_verification", "Plaid webhook verification failed.")
		return
	}

	var payload webhookEnvelope
	if err := json.Unmarshal(rawBody, &payload); err != nil {
		respond.Error(w, http.StatusBadRequest, "invalid_json", "Webhook payload must be valid JSON.")
		return
	}
	payload.ItemID = strings.TrimSpace(payload.ItemID)
	payload.WebhookType = strings.TrimSpace(payload.WebhookType)
	payload.WebhookCode = strings.TrimSpace(payload.WebhookCode)
	if payload.WebhookType == "" || payload.WebhookCode == "" {
		respond.Error(w, http.StatusBadRequest, "invalid_webhook", "Webhook type and code are required.")
		return
	}

	_, err = h.webhookEvents.RecordWebhook(r.Context(), webhookEvent{
		PlaidItemID:      payload.ItemID,
		WebhookType:      payload.WebhookType,
		WebhookCode:      payload.WebhookCode,
		Payload:          append(json.RawMessage(nil), rawBody...),
		VerificationHash: verified.BodySHA256,
		PlaidIssuedAt:    verified.IssuedAt,
	})
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "plaid_webhook_failed", "Could not record Plaid webhook.")
		return
	}

	w.WriteHeader(http.StatusAccepted)
}

func (h *Handler) loadConnections(r *http.Request, userID string) ([]connectionResponse, error) {
	rows, err := h.db.Query(
		r.Context(),
		`select pi.id::text, coalesce(pi.institution_id, ''), pi.institution_name,
		        pi.status, pi.created_at, count(pa.id)::int, pi.last_sync_at, coalesce(pi.error_code,'')
		   from plaid_items pi
		   left join plaid_accounts pa on pa.item_id = pi.id and pa.is_active
		  where pi.user_id = $1 and pi.archived_at is null
		  group by pi.id
		  order by pi.created_at desc`,
		userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	connections := []connectionResponse{}
	for rows.Next() {
		var connection connectionResponse
		var createdAt time.Time
		var lastSyncAt *time.Time
		if err := rows.Scan(
			&connection.ID,
			&connection.InstitutionID,
			&connection.InstitutionName,
			&connection.Status,
			&createdAt,
			&connection.AccountCount,
			&lastSyncAt, &connection.ErrorCode,
		); err != nil {
			return nil, err
		}
		connection.CreatedAt = createdAt.UTC().Format(time.RFC3339)
		if lastSyncAt != nil {
			v := lastSyncAt.UTC().Format(time.RFC3339)
			connection.LastSyncAt = &v
		}
		accounts, err := h.loadAccounts(r, userID, connection.ID)
		if err != nil {
			return nil, err
		}
		connection.Accounts = accounts
		connections = append(connections, connection)
	}
	return connections, rows.Err()
}

func (h *Handler) loadAccounts(r *http.Request, userID, itemID string) ([]accountResponse, error) {
	rows, err := h.db.Query(
		r.Context(),
		`select id::text, plaid_account_id, name, coalesce(mask, ''), type, subtype, is_active
		   from plaid_accounts
		  where user_id = $1 and item_id = $2
		  order by created_at asc`,
		userID,
		itemID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	accounts := []accountResponse{}
	for rows.Next() {
		var account accountResponse
		if err := rows.Scan(
			&account.ID,
			&account.PlaidAccountID,
			&account.Name,
			&account.Mask,
			&account.Type,
			&account.Subtype,
			&account.Active,
		); err != nil {
			return nil, err
		}
		accounts = append(accounts, account)
	}
	return accounts, rows.Err()
}

func (h *Handler) upsertItem(r *http.Request, tx pgx.Tx, userID, plaidItemID, encryptedToken string, metadata exchangeMetadata) (string, error) {
	var itemID string
	err := tx.QueryRow(
		r.Context(),
		`insert into plaid_items (
		   user_id, plaid_item_id, institution_id, institution_name,
		   access_token_ciphertext, products, consented_products, status, archived_at
		 )
		 values ($1, $2, $3, $4, $5, $6, $7, 'active', null)
		 on conflict (plaid_item_id) do update
		       set institution_id = excluded.institution_id,
		           institution_name = excluded.institution_name,
		           access_token_ciphertext = excluded.access_token_ciphertext,
		           products = excluded.products,
		           consented_products = excluded.consented_products,
		           status = 'active',
		           error_code = null,
		           error_message = null,
		           archived_at = null,
		           updated_at = now()
		     where plaid_items.user_id = excluded.user_id
		 returning id::text`,
		userID,
		plaidItemID,
		nilIfEmpty(metadata.Institution.normalizedID()),
		firstNonEmpty(metadata.Institution.Name, "Linked institution"),
		encryptedToken,
		h.cfg.PlaidProducts,
		h.cfg.PlaidProducts,
	).Scan(&itemID)
	return itemID, err
}

func (h *Handler) upsertAccounts(r *http.Request, tx pgx.Tx, itemID, userID string, accounts []accountMetadata) (int, error) {
	for _, account := range accounts {
		accountID := account.normalizedID()
		if accountID == "" {
			continue
		}

		raw, err := json.Marshal(account)
		if err != nil {
			return 0, err
		}

		if _, err := tx.Exec(
			r.Context(),
			`insert into plaid_accounts (
			   item_id, user_id, plaid_account_id, name, mask, type, subtype,
			   verification_status, is_active, raw
			 )
			 values ($1, $2, $3, $4, $5, $6, $7, $8, true, $9::jsonb)
			 on conflict (plaid_account_id) do update
			       set name = excluded.name,
			           mask = excluded.mask,
			           type = excluded.type,
			           subtype = excluded.subtype,
			           verification_status = excluded.verification_status,
			           is_active = true,
			           raw = excluded.raw,
			           updated_at = now()
			     where plaid_accounts.user_id = excluded.user_id`,
			itemID,
			userID,
			accountID,
			firstNonEmpty(account.Name, "Linked account"),
			nilIfEmpty(account.Mask),
			account.Type,
			account.Subtype,
			nilIfEmpty(account.VerificationStatus),
			string(raw),
		); err != nil {
			return 0, err
		}
	}
	return len(accounts), nil
}

func decodeJSON(w http.ResponseWriter, r *http.Request, out any) error {
	return requestjson.Decode(w, r, out, 64<<10)
}

func safePlaidMessage(err error, fallback string) string {
	var plaidErr apiError
	if errors.As(err, &plaidErr) && strings.TrimSpace(plaidErr.ErrorMessage) != "" {
		return plaidErr.ErrorMessage
	}
	return fallback
}

func (m institutionMetadata) normalizedID() string {
	return firstNonEmpty(m.ID, m.InstitutionID)
}

func (m accountMetadata) normalizedID() string {
	return firstNonEmpty(m.ID, m.AccountID)
}

func nilIfEmpty(value string) any {
	if strings.TrimSpace(value) == "" {
		return nil
	}
	return strings.TrimSpace(value)
}

// Update mode keeps the same Item and access token; it must not exchange a new token.
func (h *Handler) completeUpdate(w http.ResponseWriter, r *http.Request) {
	userID, _ := auth.UserIDFromContext(r.Context())
	var req struct {
		ItemID string `json:"itemId"`
	}
	if err := decodeJSON(w, r, &req); err != nil {
		respond.JSONBodyError(w, err)
		return
	}
	var exists bool
	err := h.db.QueryRow(r.Context(), `select exists(select 1 from plaid_items where id::text=$1 and user_id=$2 and archived_at is null)`, req.ItemID, userID).Scan(&exists)
	if err != nil || !exists {
		respond.Error(w, 404, "bank_not_found", "Bank connection not found.")
		return
	}
	// Only successful server-side sync can clear the error status.
	h.sync(w, r)
}

func (h *Handler) reserveTrialSlot(ctx context.Context, userID string) error {
	tx, err := h.db.Begin(ctx)
	if err != nil {
		return errors.New("Bank linking is temporarily unavailable.")
	}
	defer tx.Rollback(ctx)
	if _, err = tx.Exec(ctx, `select pg_advisory_xact_lock(6214701)`); err != nil {
		return err
	}
	var items int
	err = tx.QueryRow(ctx, `select count(*) from plaid_items where user_id=$1`, userID).Scan(&items)
	if err != nil {
		return err
	}
	if items > 0 {
		return errors.New("This beta supports one bank connection per user. Reconnect the existing bank instead.")
	}
	var reserved bool
	err = tx.QueryRow(ctx, `select exists(select 1 from plaid_trial_reservations where user_id=$1)`, userID).Scan(&reserved)
	if err != nil {
		return err
	}
	if !reserved {
		var count int
		err = tx.QueryRow(ctx, `select count(*) from (select user_id from plaid_trial_reservations union select user_id from plaid_items) s`).Scan(&count)
		if err != nil {
			return err
		}
		limit := h.cfg.PlaidMaxItems
		if limit <= 0 {
			limit = 10
		}
		if count >= limit {
			return errors.New("All bank connection places in this beta are reserved.")
		}
		if _, err = tx.Exec(ctx, `insert into plaid_trial_reservations(user_id) values($1)`, userID); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

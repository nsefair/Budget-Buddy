package notifications

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"budget-buddy/backend/internal/auth"
	"budget-buddy/backend/internal/config"
	"budget-buddy/backend/internal/requestjson"
	"budget-buddy/backend/internal/respond"
)

type authMiddleware func(http.Handler) http.Handler

type Handler struct {
	db  *pgxpool.Pool
	cfg config.Config
}

type Preferences struct {
	StreakEnabled   bool    `json:"streakEnabled"`
	QuestsEnabled   bool    `json:"questsEnabled"`
	WeeklyEnabled   bool    `json:"weeklyEnabled"`
	BudsEnabled     bool    `json:"budsEnabled"`
	BillsEnabled    bool    `json:"billsEnabled"`
	SmartEnabled    bool    `json:"smartEnabled"`
	PushEnabled     bool    `json:"pushEnabled"`
	EmailEnabled    bool    `json:"emailEnabled"`
	Timezone        string  `json:"timezone"`
	QuietHoursStart *string `json:"quietHoursStart"`
	QuietHoursEnd   *string `json:"quietHoursEnd"`
}

type Notification struct {
	ID        string         `json:"id"`
	Kind      string         `json:"kind"`
	Title     string         `json:"title"`
	Body      string         `json:"body"`
	Data      map[string]any `json:"data"`
	Read      bool           `json:"read"`
	CreatedAt time.Time      `json:"createdAt"`
}

type InboxResponse struct {
	Notifications []Notification `json:"notifications"`
	UnreadCount   int            `json:"unreadCount"`
}

type DeviceRequest struct {
	Provider   string `json:"provider"`
	Token      string `json:"token"`
	Platform   string `json:"platform"`
	AppVersion string `json:"appVersion"`
}

type DeviceResponse struct {
	ID       string `json:"id"`
	Provider string `json:"provider"`
	Platform string `json:"platform"`
	Enabled  bool   `json:"enabled"`
}

type TestNotificationRequest struct {
	Title string `json:"title"`
	Body  string `json:"body"`
}

func RegisterRoutes(mux *http.ServeMux, basePath string, db *pgxpool.Pool, cfg config.Config, requireAuth authMiddleware) {
	handler := &Handler{db: db, cfg: cfg}
	mux.Handle("GET "+basePath+"/notifications/preferences", requireAuth(http.HandlerFunc(handler.getPreferences)))
	mux.Handle("PUT "+basePath+"/notifications/preferences", requireAuth(http.HandlerFunc(handler.updatePreferences)))
	mux.Handle("GET "+basePath+"/notifications", requireAuth(http.HandlerFunc(handler.inbox)))
	mux.Handle("POST "+basePath+"/notifications/read-all", requireAuth(http.HandlerFunc(handler.readAll)))
	mux.Handle("POST "+basePath+"/notifications/{id}/read", requireAuth(http.HandlerFunc(handler.readOne)))
	mux.Handle("POST "+basePath+"/notifications/devices", requireAuth(http.HandlerFunc(handler.registerDevice)))
	mux.Handle("DELETE "+basePath+"/notifications/devices/{id}", requireAuth(http.HandlerFunc(handler.removeDevice)))
	mux.Handle("POST "+basePath+"/notifications/test", requireAuth(http.HandlerFunc(handler.createTestNotification)))
}

func (h *Handler) getPreferences(w http.ResponseWriter, r *http.Request) {
	userID, _ := auth.UserIDFromContext(r.Context())
	prefs, err := h.preferences(r.Context(), userID)
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "internal_error", "Could not load notification preferences.")
		return
	}
	respond.JSON(w, http.StatusOK, prefs)
}

func (h *Handler) updatePreferences(w http.ResponseWriter, r *http.Request) {
	var req Preferences
	if err := decodeJSON(w, r, &req); err != nil {
		respond.JSONBodyError(w, err)
		return
	}
	if err := validatePreferences(req); err != nil {
		respond.Error(w, http.StatusBadRequest, "validation_error", err.Error())
		return
	}
	userID, _ := auth.UserIDFromContext(r.Context())
	_, err := h.db.Exec(r.Context(), `
		insert into notification_preferences (
		  user_id, streak_enabled, quests_enabled, weekly_enabled, buds_enabled,
		  bills_enabled, smart_enabled, push_enabled, email_enabled, timezone,
		  quiet_hours_start, quiet_hours_end
		) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::time,$12::time)
		on conflict (user_id) do update set
		  streak_enabled = excluded.streak_enabled,
		  quests_enabled = excluded.quests_enabled,
		  weekly_enabled = excluded.weekly_enabled,
		  buds_enabled = excluded.buds_enabled,
		  bills_enabled = excluded.bills_enabled,
		  smart_enabled = excluded.smart_enabled,
		  push_enabled = excluded.push_enabled,
		  email_enabled = excluded.email_enabled,
		  timezone = excluded.timezone,
		  quiet_hours_start = excluded.quiet_hours_start,
		  quiet_hours_end = excluded.quiet_hours_end`,
		userID, req.StreakEnabled, req.QuestsEnabled, req.WeeklyEnabled,
		req.BudsEnabled, req.BillsEnabled, req.SmartEnabled, req.PushEnabled,
		req.EmailEnabled, req.Timezone, req.QuietHoursStart, req.QuietHoursEnd,
	)
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "internal_error", "Could not save notification preferences.")
		return
	}
	respond.JSON(w, http.StatusOK, req)
}

func (h *Handler) inbox(w http.ResponseWriter, r *http.Request) {
	userID, _ := auth.UserIDFromContext(r.Context())
	limit := 30
	if raw := r.URL.Query().Get("limit"); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil && parsed > 0 && parsed <= 100 {
			limit = parsed
		}
	}
	rows, err := h.db.Query(r.Context(), `
		select id::text, kind, title, body, data, (read_at is not null), created_at
		  from notifications
		 where user_id = $1 and (expires_at is null or expires_at > now())
		 order by created_at desc
		 limit $2`, userID, limit)
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "internal_error", "Could not load notifications.")
		return
	}
	defer rows.Close()

	items := make([]Notification, 0)
	for rows.Next() {
		var item Notification
		var data []byte
		if err := rows.Scan(&item.ID, &item.Kind, &item.Title, &item.Body, &data, &item.Read, &item.CreatedAt); err != nil {
			respond.Error(w, http.StatusInternalServerError, "internal_error", "Could not load notifications.")
			return
		}
		if err := json.Unmarshal(data, &item.Data); err != nil {
			item.Data = map[string]any{}
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		respond.Error(w, http.StatusInternalServerError, "internal_error", "Could not load notifications.")
		return
	}
	var unread int
	if err := h.db.QueryRow(r.Context(), "select count(*) from notifications where user_id = $1 and read_at is null and (expires_at is null or expires_at > now())", userID).Scan(&unread); err != nil {
		respond.Error(w, http.StatusInternalServerError, "internal_error", "Could not load notifications.")
		return
	}
	respond.JSON(w, http.StatusOK, InboxResponse{Notifications: items, UnreadCount: unread})
}

func (h *Handler) readOne(w http.ResponseWriter, r *http.Request) {
	userID, _ := auth.UserIDFromContext(r.Context())
	result, err := h.db.Exec(r.Context(), "update notifications set read_at = coalesce(read_at, now()) where id = $1 and user_id = $2", r.PathValue("id"), userID)
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "internal_error", "Could not update notification.")
		return
	}
	if result.RowsAffected() == 0 {
		respond.Error(w, http.StatusNotFound, "notification_not_found", "Notification not found.")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) readAll(w http.ResponseWriter, r *http.Request) {
	userID, _ := auth.UserIDFromContext(r.Context())
	if _, err := h.db.Exec(r.Context(), "update notifications set read_at = now() where user_id = $1 and read_at is null", userID); err != nil {
		respond.Error(w, http.StatusInternalServerError, "internal_error", "Could not update notifications.")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) registerDevice(w http.ResponseWriter, r *http.Request) {
	var req DeviceRequest
	if err := decodeJSON(w, r, &req); err != nil {
		respond.JSONBodyError(w, err)
		return
	}
	req.Provider = strings.ToLower(strings.TrimSpace(req.Provider))
	req.Platform = strings.ToLower(strings.TrimSpace(req.Platform))
	req.Token = strings.TrimSpace(req.Token)
	if (req.Provider != "expo" && req.Provider != "apns" && req.Provider != "fcm") ||
		(req.Platform != "ios" && req.Platform != "android") || len(req.Token) < 16 || len(req.Token) > 4096 {
		respond.Error(w, http.StatusBadRequest, "validation_error", "Device provider, platform, or token is invalid.")
		return
	}
	userID, _ := auth.UserIDFromContext(r.Context())
	var response DeviceResponse
	err := h.db.QueryRow(r.Context(), `
		insert into notification_devices (user_id, provider, token, platform, app_version)
		values ($1, $2, $3, $4, $5)
		on conflict (token) do update set
		  user_id = excluded.user_id,
		  provider = excluded.provider,
		  platform = excluded.platform,
		  app_version = excluded.app_version,
		  enabled = true,
		  last_seen_at = now()
		returning id::text, provider, platform, enabled`,
		userID, req.Provider, req.Token, req.Platform, strings.TrimSpace(req.AppVersion),
	).Scan(&response.ID, &response.Provider, &response.Platform, &response.Enabled)
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "internal_error", "Could not register notification device.")
		return
	}
	respond.JSON(w, http.StatusOK, response)
}

func (h *Handler) removeDevice(w http.ResponseWriter, r *http.Request) {
	userID, _ := auth.UserIDFromContext(r.Context())
	result, err := h.db.Exec(r.Context(), "update notification_devices set enabled = false where id = $1 and user_id = $2", r.PathValue("id"), userID)
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "internal_error", "Could not remove notification device.")
		return
	}
	if result.RowsAffected() == 0 {
		respond.Error(w, http.StatusNotFound, "device_not_found", "Notification device not found.")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) createTestNotification(w http.ResponseWriter, r *http.Request) {
	if h.cfg.Env == "production" {
		respond.Error(w, http.StatusNotFound, "not_found", "Route not found.")
		return
	}
	var req TestNotificationRequest
	if err := decodeJSON(w, r, &req); err != nil {
		respond.JSONBodyError(w, err)
		return
	}
	title := strings.TrimSpace(req.Title)
	body := strings.TrimSpace(req.Body)
	if title == "" {
		title = "Budget Buddy test"
	}
	if body == "" {
		body = "Your notification foundation is connected."
	}
	userID, _ := auth.UserIDFromContext(r.Context())
	var id string
	if err := h.db.QueryRow(r.Context(), `
		insert into notifications (user_id, kind, title, body)
		values ($1, 'system_test', $2, $3)
		returning id::text`, userID, title, body).Scan(&id); err != nil {
		respond.Error(w, http.StatusInternalServerError, "internal_error", "Could not create test notification.")
		return
	}
	respond.JSON(w, http.StatusCreated, map[string]string{"id": id})
}

func (h *Handler) preferences(ctx context.Context, userID string) (Preferences, error) {
	if _, err := h.db.Exec(ctx, "insert into notification_preferences (user_id) values ($1) on conflict (user_id) do nothing", userID); err != nil {
		return Preferences{}, err
	}
	var prefs Preferences
	var start, end *string
	err := h.db.QueryRow(ctx, `
		select streak_enabled, quests_enabled, weekly_enabled, buds_enabled, bills_enabled,
		       smart_enabled, push_enabled, email_enabled, timezone,
		       to_char(quiet_hours_start, 'HH24:MI'), to_char(quiet_hours_end, 'HH24:MI')
		  from notification_preferences where user_id = $1`, userID).Scan(
		&prefs.StreakEnabled, &prefs.QuestsEnabled, &prefs.WeeklyEnabled, &prefs.BudsEnabled,
		&prefs.BillsEnabled, &prefs.SmartEnabled, &prefs.PushEnabled, &prefs.EmailEnabled,
		&prefs.Timezone, &start, &end,
	)
	if err != nil {
		return Preferences{}, err
	}
	prefs.QuietHoursStart = start
	prefs.QuietHoursEnd = end
	return prefs, nil
}

func validatePreferences(prefs Preferences) error {
	if len(strings.TrimSpace(prefs.Timezone)) > 100 {
		return errors.New("timezone is too long")
	}
	if _, err := time.LoadLocation(prefs.Timezone); err != nil {
		return errors.New("timezone must be a valid IANA timezone")
	}
	if !validOptionalTime(prefs.QuietHoursStart) || !validOptionalTime(prefs.QuietHoursEnd) {
		return errors.New("quiet hours must use HH:MM format")
	}
	return nil
}

func validOptionalTime(value *string) bool {
	if value == nil || strings.TrimSpace(*value) == "" {
		return true
	}
	_, err := time.Parse("15:04", *value)
	return err == nil
}

func decodeJSON(w http.ResponseWriter, r *http.Request, target any) error {
	return requestjson.Decode(w, r, target, 64<<10)
}

// Package events records the beta's five measured interactions: app opens,
// taps on the number, move-to-goal taps, score taps, and "this number looks
// wrong" reports. Rows are only written here; reading them stays a fixed,
// read-only admin query.
package events

import (
	"encoding/json"
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"

	"budget-buddy/backend/internal/auth"
	"budget-buddy/backend/internal/requestjson"
	"budget-buddy/backend/internal/respond"
)

var kinds = map[string]bool{
	"app_open":      true,
	"number_tap":    true,
	"goal_move_tap": true,
	"score_tap":     true,
	"number_report": true,
}

// A detail object is small context such as the number on screen, never a dump.
const maxDetailBytes = 2048

type Handler struct {
	db *pgxpool.Pool
}

func RegisterRoutes(mux *http.ServeMux, basePath string, db *pgxpool.Pool, requireAuth func(http.Handler) http.Handler) {
	h := &Handler{db: db}
	mux.Handle("POST "+basePath+"/events", requireAuth(http.HandlerFunc(h.record)))
}

func (h *Handler) record(w http.ResponseWriter, r *http.Request) {
	user, _ := auth.UserIDFromContext(r.Context())
	var req struct {
		Kind   string         `json:"kind"`
		Detail map[string]any `json:"detail"`
	}
	if e := requestjson.Decode(w, r, &req, 4096); e != nil {
		respond.JSONBodyError(w, e)
		return
	}
	if !kinds[req.Kind] {
		respond.Error(w, http.StatusBadRequest, "invalid_event", "Unknown event kind.")
		return
	}
	if req.Detail == nil {
		req.Detail = map[string]any{}
	}
	detail, e := json.Marshal(req.Detail)
	if e != nil || len(detail) > maxDetailBytes {
		respond.Error(w, http.StatusBadRequest, "invalid_event", "Event detail is too large.")
		return
	}
	if _, e = h.db.Exec(r.Context(), `insert into app_events(user_id,kind,detail) values($1,$2,$3::jsonb)`, user, req.Kind, string(detail)); e != nil {
		respond.Error(w, http.StatusInternalServerError, "event_unavailable", "Could not record the event.")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

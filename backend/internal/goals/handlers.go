package goals

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"budget-buddy/backend/internal/auth"
	"budget-buddy/backend/internal/respond"
)

type authMiddleware func(http.Handler) http.Handler

type Handler struct {
	db *pgxpool.Pool
}

type Goal struct {
	ID              string  `json:"id"`
	Name            string  `json:"name"`
	Kind            string  `json:"kind"`
	Duration        string  `json:"duration"`
	Reason          string  `json:"reason"`
	TargetAmount    float64 `json:"targetAmount"`
	AlreadySaved    float64 `json:"alreadySaved"`
	MonthlyCommit   float64 `json:"monthlyCommit"`
	Deadline        string  `json:"deadline"`
	LinkedAccountID string  `json:"linkedAccountId,omitempty"`
	CreatedAt       string  `json:"createdAt"`
}

type createGoalRequest struct {
	Name          string  `json:"name"`
	Kind          string  `json:"kind"`
	Duration      string  `json:"duration"`
	Reason        string  `json:"reason"`
	TargetAmount  float64 `json:"targetAmount"`
	AlreadySaved  float64 `json:"alreadySaved"`
	MonthlyCommit float64 `json:"monthlyCommit"`
	Deadline      string  `json:"deadline"`
}

type contributeRequest struct {
	Amount float64 `json:"amount"`
}

func RegisterRoutes(mux *http.ServeMux, basePath string, db *pgxpool.Pool, requireAuth authMiddleware) {
	handler := &Handler{db: db}
	mux.Handle("GET "+basePath+"/goals", requireAuth(http.HandlerFunc(handler.list)))
	mux.Handle("POST "+basePath+"/goals", requireAuth(http.HandlerFunc(handler.create)))
	mux.Handle("GET "+basePath+"/goals/{id}", requireAuth(http.HandlerFunc(handler.detail)))
	mux.Handle("POST "+basePath+"/goals/{id}/contribute", requireAuth(http.HandlerFunc(handler.contribute)))
}

func (h *Handler) list(w http.ResponseWriter, r *http.Request) {
	userID, _ := auth.UserIDFromContext(r.Context())
	rows, err := h.db.Query(
		r.Context(),
		`select id::text, name, kind, duration, reason, target_amount_cents,
		        already_saved_cents, monthly_commit_cents, deadline, created_at
		   from goals
		  where user_id = $1 and archived_at is null
		  order by created_at desc`,
		userID,
	)
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "goals_list_failed", "Could not load goals.")
		return
	}
	defer rows.Close()

	goals := []Goal{}
	for rows.Next() {
		goal, err := scanGoal(rows)
		if err != nil {
			respond.Error(w, http.StatusInternalServerError, "goals_list_failed", "Could not load goals.")
			return
		}
		goals = append(goals, goal)
	}

	respond.JSON(w, http.StatusOK, goals)
}

func (h *Handler) create(w http.ResponseWriter, r *http.Request) {
	userID, _ := auth.UserIDFromContext(r.Context())

	var req createGoalRequest
	if err := decodeJSON(r, &req); err != nil {
		respond.Error(w, http.StatusBadRequest, "invalid_json", "Request body must be valid JSON.")
		return
	}

	name := strings.TrimSpace(req.Name)
	if name == "" {
		respond.Error(w, http.StatusBadRequest, "validation_error", "Goal name is required.")
		return
	}
	if req.TargetAmount <= 0 {
		respond.Error(w, http.StatusBadRequest, "validation_error", "Target amount must be greater than zero.")
		return
	}

	deadline, err := parseDeadline(req.Deadline)
	if err != nil {
		respond.Error(w, http.StatusBadRequest, "validation_error", "Deadline must be a valid date.")
		return
	}

	goal, err := scanGoal(
		h.db.QueryRow(
			r.Context(),
			`insert into goals (
			   user_id, name, kind, duration, reason, target_amount_cents,
			   already_saved_cents, monthly_commit_cents, deadline
			 )
			 values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
			 returning id::text, name, kind, duration, reason, target_amount_cents,
			           already_saved_cents, monthly_commit_cents, deadline, created_at`,
			userID,
			name,
			normalizeGoalKind(req.Kind),
			normalizeDuration(req.Duration),
			strings.TrimSpace(req.Reason),
			dollarsToCents(req.TargetAmount),
			dollarsToCents(req.AlreadySaved),
			dollarsToCents(req.MonthlyCommit),
			deadline,
		),
	)
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "goal_create_failed", "Could not create goal.")
		return
	}

	respond.JSON(w, http.StatusCreated, goal)
}

func (h *Handler) detail(w http.ResponseWriter, r *http.Request) {
	userID, _ := auth.UserIDFromContext(r.Context())
	id := r.PathValue("id")

	goal, err := h.findGoal(r, userID, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			respond.Error(w, http.StatusNotFound, "goal_not_found", "Goal not found.")
			return
		}
		respond.Error(w, http.StatusInternalServerError, "goal_load_failed", "Could not load goal.")
		return
	}

	respond.JSON(w, http.StatusOK, goal)
}

func (h *Handler) contribute(w http.ResponseWriter, r *http.Request) {
	userID, _ := auth.UserIDFromContext(r.Context())
	id := r.PathValue("id")

	var req contributeRequest
	if err := decodeJSON(r, &req); err != nil {
		respond.Error(w, http.StatusBadRequest, "invalid_json", "Request body must be valid JSON.")
		return
	}
	if req.Amount == 0 {
		respond.Error(w, http.StatusBadRequest, "validation_error", "Contribution amount cannot be zero.")
		return
	}

	tx, err := h.db.BeginTx(r.Context(), pgx.TxOptions{})
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "goal_contribution_failed", "Could not save contribution.")
		return
	}
	defer func() {
		_ = tx.Rollback(r.Context())
	}()

	result, err := tx.Exec(
		r.Context(),
		`update goals
		    set already_saved_cents = greatest(0, already_saved_cents + $3)
		  where id = $1 and user_id = $2 and archived_at is null`,
		id,
		userID,
		dollarsToCents(req.Amount),
	)
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "goal_contribution_failed", "Could not save contribution.")
		return
	}
	if result.RowsAffected() == 0 {
		respond.Error(w, http.StatusNotFound, "goal_not_found", "Goal not found.")
		return
	}

	_, err = tx.Exec(
		r.Context(),
		`insert into goal_contributions (goal_id, user_id, amount_cents)
		 values ($1, $2, $3)`,
		id,
		userID,
		dollarsToCents(req.Amount),
	)
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "goal_contribution_failed", "Could not save contribution.")
		return
	}

	goal, err := scanGoal(
		tx.QueryRow(
			r.Context(),
			goalSelectSQL+` where id = $1 and user_id = $2 and archived_at is null`,
			id,
			userID,
		),
	)
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "goal_load_failed", "Could not load goal.")
		return
	}

	if err := tx.Commit(r.Context()); err != nil {
		respond.Error(w, http.StatusInternalServerError, "goal_contribution_failed", "Could not save contribution.")
		return
	}

	respond.JSON(w, http.StatusOK, goal)
}

func (h *Handler) findGoal(r *http.Request, userID, id string) (Goal, error) {
	return scanGoal(
		h.db.QueryRow(
			r.Context(),
			goalSelectSQL+` where id = $1 and user_id = $2 and archived_at is null`,
			id,
			userID,
		),
	)
}

const goalSelectSQL = `select id::text, name, kind, duration, reason,
       target_amount_cents, already_saved_cents, monthly_commit_cents,
       deadline, created_at
  from goals`

type goalRow interface {
	Scan(dest ...any) error
}

func scanGoal(row goalRow) (Goal, error) {
	var goal Goal
	var targetCents int64
	var savedCents int64
	var monthlyCents int64
	var deadline time.Time
	var createdAt time.Time

	err := row.Scan(
		&goal.ID,
		&goal.Name,
		&goal.Kind,
		&goal.Duration,
		&goal.Reason,
		&targetCents,
		&savedCents,
		&monthlyCents,
		&deadline,
		&createdAt,
	)
	if err != nil {
		return Goal{}, err
	}

	goal.TargetAmount = centsToDollars(targetCents)
	goal.AlreadySaved = centsToDollars(savedCents)
	goal.MonthlyCommit = centsToDollars(monthlyCents)
	goal.Deadline = deadline.UTC().Format(time.RFC3339)
	goal.CreatedAt = createdAt.UTC().Format(time.RFC3339)

	return goal, nil
}

func decodeJSON(r *http.Request, target any) error {
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	return decoder.Decode(target)
}

func normalizeGoalKind(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "emergency_fund", "debt_payoff", "savings_target", "invest", "income_growth", "stop_overspending", "custom":
		return strings.ToLower(strings.TrimSpace(value))
	default:
		return "custom"
	}
}

func normalizeDuration(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "short", "long":
		return strings.ToLower(strings.TrimSpace(value))
	default:
		return "medium"
	}
}

func parseDeadline(value string) (time.Time, error) {
	value = strings.TrimSpace(value)
	if parsed, err := time.Parse(time.RFC3339, value); err == nil {
		return parsed.UTC(), nil
	}
	if parsed, err := time.Parse("2006-01-02", value); err == nil {
		return parsed.UTC(), nil
	}
	return time.Time{}, errors.New("invalid deadline")
}

func dollarsToCents(value float64) int64 {
	return int64(value*100 + 0.5)
}

func centsToDollars(value int64) float64 {
	return float64(value) / 100
}

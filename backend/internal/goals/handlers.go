package goals

import (
	"encoding/json"
	"errors"
	"math"
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

var (
	errLinkedAccountNotOwned = errors.New("linked account must belong to the signed-in user")
	errLinkedAccountInUse    = errors.New("linked account is already assigned to another active goal")
)

type Goal struct {
	ID                        string  `json:"id"`
	Name                      string  `json:"name"`
	Kind                      string  `json:"kind"`
	Duration                  string  `json:"duration"`
	Reason                    string  `json:"reason"`
	TargetAmount              float64 `json:"targetAmount"`
	AlreadySaved              float64 `json:"alreadySaved"`
	CurrentAmount             float64 `json:"currentAmount"`
	MonthlyCommit             float64 `json:"monthlyCommit"`
	Deadline                  string  `json:"deadline"`
	LinkedAccountID           string  `json:"linkedAccountId,omitempty"`
	Trailing30DayContribution float64 `json:"trailing30DayContribution"`
	ProjectedCompletionDate   *string `json:"projectedCompletionDate"`
	CreatedAt                 string  `json:"createdAt"`
}

type createGoalRequest struct {
	Name            string  `json:"name"`
	Kind            string  `json:"kind"`
	Duration        string  `json:"duration"`
	Reason          string  `json:"reason"`
	TargetAmount    float64 `json:"targetAmount"`
	AlreadySaved    float64 `json:"alreadySaved"`
	MonthlyCommit   float64 `json:"monthlyCommit"`
	Deadline        string  `json:"deadline"`
	LinkedAccountID string  `json:"linkedAccountId"`
}

type contributeRequest struct {
	Amount float64 `json:"amount"`
	Date   string  `json:"date"`
}

type updateGoalRequest struct {
	Name            *string  `json:"name"`
	Kind            *string  `json:"kind"`
	Duration        *string  `json:"duration"`
	Reason          *string  `json:"reason"`
	TargetAmount    *float64 `json:"targetAmount"`
	MonthlyCommit   *float64 `json:"monthlyCommit"`
	Deadline        *string  `json:"deadline"`
	LinkedAccountID *string  `json:"linkedAccountId"`
}

func RegisterRoutes(mux *http.ServeMux, basePath string, db *pgxpool.Pool, requireAuth authMiddleware) {
	handler := &Handler{db: db}
	mux.Handle("GET "+basePath+"/goals", requireAuth(http.HandlerFunc(handler.list)))
	mux.Handle("POST "+basePath+"/goals", requireAuth(http.HandlerFunc(handler.create)))
	mux.Handle("GET "+basePath+"/goals/{id}", requireAuth(http.HandlerFunc(handler.detail)))
	mux.Handle("PATCH "+basePath+"/goals/{id}", requireAuth(http.HandlerFunc(handler.update)))
	mux.Handle("POST "+basePath+"/goals/{id}/contribute", requireAuth(http.HandlerFunc(handler.contribute)))
	mux.Handle("POST "+basePath+"/goals/{id}/contribution", requireAuth(http.HandlerFunc(handler.contribute)))
}

func (h *Handler) list(w http.ResponseWriter, r *http.Request) {
	userID, _ := auth.UserIDFromContext(r.Context())
	rows, err := h.db.Query(
		r.Context(),
		goalSelectSQL+`
		  where g.user_id = $1 and g.archived_at is null
		  order by g.created_at desc`,
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
	if err := rows.Err(); err != nil {
		respond.Error(w, http.StatusInternalServerError, "goals_list_failed", "Could not load goals.")
		return
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
	if req.AlreadySaved < 0 || req.MonthlyCommit < 0 {
		respond.Error(w, http.StatusBadRequest, "validation_error", "Saved and monthly amounts cannot be negative.")
		return
	}

	deadline, err := parseDeadline(req.Deadline)
	if err != nil {
		respond.Error(w, http.StatusBadRequest, "validation_error", "Deadline must be a valid date.")
		return
	}
	linkedAccountID := strings.TrimSpace(req.LinkedAccountID)
	if linkedAccountID != "" {
		if err := h.validateLinkedAccount(r, userID, "", linkedAccountID); err != nil {
			if errors.Is(err, errLinkedAccountNotOwned) || errors.Is(err, errLinkedAccountInUse) {
				respond.Error(w, http.StatusBadRequest, "validation_error", err.Error())
				return
			}
			respond.Error(w, http.StatusInternalServerError, "goal_create_failed", "Could not validate the linked account.")
			return
		}
	}

	goal, err := scanGoal(
		h.db.QueryRow(
			r.Context(),
			`insert into goals (
			   user_id, name, kind, duration, reason, target_amount_cents,
			   already_saved_cents, monthly_commit_cents, deadline, linked_account_id
			 )
			 values ($1, $2, $3, $4, $5, $6, $7, $8, $9, nullif($10, '')::uuid)
			 returning id::text, name, kind, duration, reason, target_amount_cents,
			           already_saved_cents, monthly_commit_cents, deadline,
			           coalesce(linked_account_id::text, ''), 0::bigint, created_at`,
			userID,
			name,
			normalizeGoalKind(req.Kind),
			normalizeDuration(req.Duration),
			strings.TrimSpace(req.Reason),
			dollarsToCents(req.TargetAmount),
			dollarsToCents(req.AlreadySaved),
			dollarsToCents(req.MonthlyCommit),
			deadline,
			linkedAccountID,
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

func (h *Handler) update(w http.ResponseWriter, r *http.Request) {
	userID, _ := auth.UserIDFromContext(r.Context())
	id := r.PathValue("id")
	existing, err := h.findGoal(r, userID, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			respond.Error(w, http.StatusNotFound, "goal_not_found", "Goal not found.")
			return
		}
		respond.Error(w, http.StatusInternalServerError, "goal_load_failed", "Could not load goal.")
		return
	}

	var req updateGoalRequest
	if err := decodeJSON(r, &req); err != nil {
		respond.Error(w, http.StatusBadRequest, "invalid_json", "Request body must be valid JSON.")
		return
	}

	name := existing.Name
	if req.Name != nil {
		name = strings.TrimSpace(*req.Name)
		if name == "" {
			respond.Error(w, http.StatusBadRequest, "validation_error", "Goal name is required.")
			return
		}
	}
	kind := existing.Kind
	if req.Kind != nil {
		kind = normalizeGoalKind(*req.Kind)
	}
	duration := existing.Duration
	if req.Duration != nil {
		duration = normalizeDuration(*req.Duration)
	}
	reason := existing.Reason
	if req.Reason != nil {
		reason = strings.TrimSpace(*req.Reason)
	}
	targetAmount := existing.TargetAmount
	if req.TargetAmount != nil {
		targetAmount = *req.TargetAmount
		if targetAmount <= 0 {
			respond.Error(w, http.StatusBadRequest, "validation_error", "Target amount must be greater than zero.")
			return
		}
	}
	monthlyCommit := existing.MonthlyCommit
	if req.MonthlyCommit != nil {
		monthlyCommit = *req.MonthlyCommit
		if monthlyCommit < 0 {
			respond.Error(w, http.StatusBadRequest, "validation_error", "Monthly amount cannot be negative.")
			return
		}
	}
	deadline, err := parseDeadline(existing.Deadline)
	if req.Deadline != nil {
		deadline, err = parseDeadline(*req.Deadline)
	}
	if err != nil {
		respond.Error(w, http.StatusBadRequest, "validation_error", "Deadline must be a valid date.")
		return
	}
	linkedAccountID := existing.LinkedAccountID
	if req.LinkedAccountID != nil {
		linkedAccountID = strings.TrimSpace(*req.LinkedAccountID)
		if linkedAccountID != "" {
			if err := h.validateLinkedAccount(r, userID, id, linkedAccountID); err != nil {
				if errors.Is(err, errLinkedAccountNotOwned) || errors.Is(err, errLinkedAccountInUse) {
					respond.Error(w, http.StatusBadRequest, "validation_error", err.Error())
					return
				}
				respond.Error(w, http.StatusInternalServerError, "goal_update_failed", "Could not validate the linked account.")
				return
			}
		}
	}

	result, err := h.db.Exec(
		r.Context(),
		`update goals
		    set name = $3,
		        kind = $4,
		        duration = $5,
		        reason = $6,
		        target_amount_cents = $7,
		        monthly_commit_cents = $8,
		        deadline = $9,
		        linked_account_id = nullif($10, '')::uuid
		  where id = $1 and user_id = $2 and archived_at is null`,
		id,
		userID,
		name,
		kind,
		duration,
		reason,
		dollarsToCents(targetAmount),
		dollarsToCents(monthlyCommit),
		deadline,
		linkedAccountID,
	)
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "goal_update_failed", "Could not update goal.")
		return
	}
	if result.RowsAffected() == 0 {
		respond.Error(w, http.StatusNotFound, "goal_not_found", "Goal not found.")
		return
	}

	goal, err := h.findGoal(r, userID, id)
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "goal_load_failed", "Goal was updated but could not be reloaded.")
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
	if req.Amount <= 0 {
		respond.Error(w, http.StatusBadRequest, "validation_error", "Contribution amount must be greater than zero.")
		return
	}
	contributedAt, err := parseContributionDate(req.Date)
	if err != nil {
		respond.Error(w, http.StatusBadRequest, "validation_error", "Contribution date must be a valid ISO date.")
		return
	}
	if contributedAt.After(time.Now().UTC().Add(5 * time.Minute)) {
		respond.Error(w, http.StatusBadRequest, "validation_error", "Contribution date cannot be in the future.")
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
		`insert into goal_contributions (goal_id, user_id, amount_cents, source, contributed_at)
		 values ($1, $2, $3, 'manual', $4)`,
		id,
		userID,
		dollarsToCents(req.Amount),
		contributedAt,
	)
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "goal_contribution_failed", "Could not save contribution.")
		return
	}

	goal, err := scanGoal(
		tx.QueryRow(
			r.Context(),
			goalSelectSQL+` where g.id = $1 and g.user_id = $2 and g.archived_at is null`,
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
			goalSelectSQL+` where g.id = $1 and g.user_id = $2 and g.archived_at is null`,
			id,
			userID,
		),
	)
}

func (h *Handler) validateLinkedAccount(r *http.Request, userID, goalID, accountID string) error {
	var owned bool
	if err := h.db.QueryRow(
		r.Context(),
		`select exists(
		   select 1 from plaid_accounts
		    where id = $1 and user_id = $2 and is_active
		 )`,
		accountID,
		userID,
	).Scan(&owned); err != nil {
		return err
	}
	if !owned {
		return errLinkedAccountNotOwned
	}

	var alreadyLinked bool
	if err := h.db.QueryRow(
		r.Context(),
		`select exists(
		   select 1 from goals
		    where user_id = $1
		      and linked_account_id = $2
		      and archived_at is null
		      and ($3 = '' or id::text <> $3)
		 )`,
		userID,
		accountID,
		goalID,
	).Scan(&alreadyLinked); err != nil {
		return err
	}
	if alreadyLinked {
		return errLinkedAccountInUse
	}
	return nil
}

const goalSelectSQL = `select g.id::text, g.name, g.kind, g.duration, g.reason,
       g.target_amount_cents, g.already_saved_cents, g.monthly_commit_cents,
       g.deadline, coalesce(g.linked_account_id::text, ''),
       coalesce((
         select sum(gc.amount_cents)
           from goal_contributions gc
          where gc.goal_id = g.id
            and gc.amount_cents > 0
            and gc.contributed_at >= now() - interval '30 days'
       ), 0)::bigint,
       g.created_at
  from goals g`

type goalRow interface {
	Scan(dest ...any) error
}

func scanGoal(row goalRow) (Goal, error) {
	var goal Goal
	var targetCents int64
	var savedCents int64
	var monthlyCents int64
	var trailing30DayCents int64
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
		&goal.LinkedAccountID,
		&trailing30DayCents,
		&createdAt,
	)
	if err != nil {
		return Goal{}, err
	}

	goal.TargetAmount = centsToDollars(targetCents)
	goal.AlreadySaved = centsToDollars(savedCents)
	goal.CurrentAmount = goal.AlreadySaved
	goal.MonthlyCommit = centsToDollars(monthlyCents)
	goal.Trailing30DayContribution = centsToDollars(trailing30DayCents)
	goal.Deadline = deadline.UTC().Format(time.RFC3339)
	goal.CreatedAt = createdAt.UTC().Format(time.RFC3339)
	goal.ProjectedCompletionDate = projectedCompletionDate(time.Now().UTC(), targetCents, savedCents, trailing30DayCents)

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

func parseContributionDate(value string) (time.Time, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return time.Now().UTC(), nil
	}
	if parsed, err := time.Parse(time.RFC3339, value); err == nil {
		return parsed.UTC(), nil
	}
	if parsed, err := time.Parse("2006-01-02", value); err == nil {
		return parsed.UTC(), nil
	}
	return time.Time{}, errors.New("invalid contribution date")
}

func projectedCompletionDate(now time.Time, targetCents, savedCents, trailing30DayCents int64) *string {
	remaining := targetCents - savedCents
	if remaining <= 0 {
		value := now.UTC().Format(time.RFC3339)
		return &value
	}
	if trailing30DayCents <= 0 {
		return nil
	}

	days := int(math.Ceil(float64(remaining) * 30 / float64(trailing30DayCents)))
	value := now.UTC().AddDate(0, 0, days).Format(time.RFC3339)
	return &value
}

func dollarsToCents(value float64) int64 {
	return int64(value*100 + 0.5)
}

func centsToDollars(value int64) float64 {
	return float64(value) / 100
}

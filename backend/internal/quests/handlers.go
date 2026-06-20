package quests

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"budget-buddy/backend/internal/auth"
	"budget-buddy/backend/internal/respond"
)

const weeklyQuestCount = 3

type authMiddleware func(http.Handler) http.Handler

type Handler struct {
	db *pgxpool.Pool
}

type queryer interface {
	Query(context.Context, string, ...any) (pgx.Rows, error)
	QueryRow(context.Context, string, ...any) pgx.Row
}

func RegisterRoutes(mux *http.ServeMux, basePath string, db *pgxpool.Pool, requireAuth authMiddleware) {
	handler := &Handler{db: db}

	// Onboarding uses this public, goal-specific suggestion before a session exists.
	mux.HandleFunc("GET "+basePath+"/quests/active", firstQuestSuggestion)
	mux.Handle("GET "+basePath+"/quests/dashboard", requireAuth(http.HandlerFunc(handler.dashboard)))
	mux.Handle("GET "+basePath+"/quests/weekly", requireAuth(http.HandlerFunc(handler.weekly)))
	mux.Handle("GET "+basePath+"/quests/score", requireAuth(http.HandlerFunc(handler.score)))
	mux.Handle("GET "+basePath+"/quests/league", requireAuth(http.HandlerFunc(handler.league)))
	mux.Handle("POST "+basePath+"/quests/{id}/check-in", requireAuth(http.HandlerFunc(handler.checkIn)))
	mux.Handle("POST "+basePath+"/quests/{id}/complete", requireAuth(http.HandlerFunc(handler.checkIn)))
}

func (h *Handler) dashboard(w http.ResponseWriter, r *http.Request) {
	userID, _ := auth.UserIDFromContext(r.Context())
	window, today, err := h.userWeek(r.Context(), userID, time.Now())
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "quests_timezone_failed", "Could not prepare this week's quests.")
		return
	}

	tx, err := h.db.BeginTx(r.Context(), pgx.TxOptions{})
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "quests_load_failed", "Could not load this week's quests.")
		return
	}
	defer func() { _ = tx.Rollback(r.Context()) }()

	if _, err := tx.Exec(r.Context(), "select pg_advisory_xact_lock(hashtext($1))", userID+":"+window.StartDate); err != nil {
		respond.Error(w, http.StatusInternalServerError, "quests_load_failed", "Could not load this week's quests.")
		return
	}
	if _, err := tx.Exec(r.Context(), `
		update user_weekly_quests
		   set status = 'expired'
		 where user_id = $1 and status = 'active' and week_start < $2::date`, userID, window.StartDate); err != nil {
		respond.Error(w, http.StatusInternalServerError, "quests_load_failed", "Could not load this week's quests.")
		return
	}
	if err := ensureFinancialProfile(r.Context(), tx, userID); err != nil {
		respond.Error(w, http.StatusInternalServerError, "score_load_failed", "Could not load your financial score.")
		return
	}
	if err := h.ensureWeeklyQuests(r.Context(), tx, userID, window); err != nil {
		respond.Error(w, http.StatusInternalServerError, "quests_assign_failed", "Could not prepare this week's quests.")
		return
	}

	score, err := recomputeScore(r.Context(), tx, userID, window.StartDate, "dashboard_refresh", "")
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "score_refresh_failed", "Could not refresh your financial score.")
		return
	}
	quests, err := queryWeeklyQuests(r.Context(), tx, userID, window.StartDate, today)
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "quests_load_failed", "Could not load this week's quests.")
		return
	}
	if err := tx.Commit(r.Context()); err != nil {
		respond.Error(w, http.StatusInternalServerError, "quests_load_failed", "Could not load this week's quests.")
		return
	}

	league, err := h.loadLeague(r.Context(), userID, score.Value, window.Reset)
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "league_load_failed", "Could not load your league.")
		return
	}

	respond.JSON(w, http.StatusOK, Dashboard{
		WeekStart: window.StartDate,
		ResetDate: window.Reset.UTC().Format(time.RFC3339),
		Quests:    quests,
		Score:     score,
		League:    league,
	})
}

func (h *Handler) weekly(w http.ResponseWriter, r *http.Request) {
	userID, _ := auth.UserIDFromContext(r.Context())
	window, today, err := h.userWeek(r.Context(), userID, time.Now())
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "quests_timezone_failed", "Could not load this week's quests.")
		return
	}
	quests, err := queryWeeklyQuests(r.Context(), h.db, userID, window.StartDate, today)
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "quests_load_failed", "Could not load this week's quests.")
		return
	}
	respond.JSON(w, http.StatusOK, quests)
}

func (h *Handler) score(w http.ResponseWriter, r *http.Request) {
	userID, _ := auth.UserIDFromContext(r.Context())
	window, _, err := h.userWeek(r.Context(), userID, time.Now())
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "score_load_failed", "Could not load your financial score.")
		return
	}
	tx, err := h.db.BeginTx(r.Context(), pgx.TxOptions{})
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "score_load_failed", "Could not load your financial score.")
		return
	}
	defer func() { _ = tx.Rollback(r.Context()) }()
	if err := ensureFinancialProfile(r.Context(), tx, userID); err != nil {
		respond.Error(w, http.StatusInternalServerError, "score_load_failed", "Could not load your financial score.")
		return
	}
	score, err := recomputeScore(r.Context(), tx, userID, window.StartDate, "score_refresh", "")
	if err != nil || tx.Commit(r.Context()) != nil {
		respond.Error(w, http.StatusInternalServerError, "score_load_failed", "Could not load your financial score.")
		return
	}
	respond.JSON(w, http.StatusOK, score)
}

func (h *Handler) league(w http.ResponseWriter, r *http.Request) {
	userID, _ := auth.UserIDFromContext(r.Context())
	window, _, err := h.userWeek(r.Context(), userID, time.Now())
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "league_load_failed", "Could not load your league.")
		return
	}
	var score int
	if err := h.db.QueryRow(r.Context(), `select financial_health_score from users where id = $1`, userID).Scan(&score); err != nil {
		respond.Error(w, http.StatusInternalServerError, "league_load_failed", "Could not load your league.")
		return
	}
	league, err := h.loadLeague(r.Context(), userID, clampScore(score), window.Reset)
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "league_load_failed", "Could not load your league.")
		return
	}
	respond.JSON(w, http.StatusOK, league)
}

func (h *Handler) checkIn(w http.ResponseWriter, r *http.Request) {
	userID, _ := auth.UserIDFromContext(r.Context())
	questID := strings.TrimSpace(r.PathValue("id"))
	window, today, err := h.userWeek(r.Context(), userID, time.Now())
	if err != nil || questID == "" {
		respond.Error(w, http.StatusBadRequest, "invalid_quest", "That quest could not be found.")
		return
	}

	tx, err := h.db.BeginTx(r.Context(), pgx.TxOptions{})
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "quest_check_in_failed", "Your check-in did not save. Try once more.")
		return
	}
	defer func() { _ = tx.Rollback(r.Context()) }()

	var progress, target, xpReward int
	var status, weekStart, verificationType string
	err = tx.QueryRow(r.Context(), `
		select progress, target_value, xp_reward, status, week_start::text, verification_type
		  from user_weekly_quests
		 where id = $1 and user_id = $2
		 for update`, questID, userID).Scan(&progress, &target, &xpReward, &status, &weekStart, &verificationType)
	if errors.Is(err, pgx.ErrNoRows) {
		respond.Error(w, http.StatusNotFound, "quest_not_found", "That quest could not be found.")
		return
	}
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "quest_check_in_failed", "Your check-in did not save. Try once more.")
		return
	}
	if weekStart != window.StartDate || status == "expired" {
		respond.Error(w, http.StatusConflict, "quest_week_ended", "That quest's week has ended. Your new set is ready.")
		return
	}
	if status == "completed" {
		result, err := h.checkInResult(r.Context(), tx, userID, questID, window, today, 0, true)
		if err != nil || tx.Commit(r.Context()) != nil {
			respond.Error(w, http.StatusInternalServerError, "quest_check_in_failed", "Could not load that completed quest.")
			return
		}
		respond.JSON(w, http.StatusOK, result)
		return
	}
	evidenceDate, verificationErr := verifyQuestEvidence(
		r.Context(), tx, userID, verificationType, window.StartDate,
		today, window.Timezone, progress,
	)
	if verificationErr != nil {
		var evidenceErr questVerificationError
		if errors.As(verificationErr, &evidenceErr) {
			respond.Error(w, http.StatusConflict, evidenceErr.Code, evidenceErr.Message)
			return
		}
		respond.Error(w, http.StatusInternalServerError, "quest_verification_failed", "Bud could not verify that quest yet. Try once more.")
		return
	}

	command, err := tx.Exec(r.Context(), `
		insert into quest_check_ins (quest_id, user_id, check_in_date)
		values ($1, $2, $3::date)
		on conflict (quest_id, check_in_date) do nothing`, questID, userID, evidenceDate)
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "quest_check_in_failed", "Your check-in did not save. Try once more.")
		return
	}
	alreadyCheckedIn := command.RowsAffected() == 0
	xpEarned := 0
	if !alreadyCheckedIn {
		progress++
		completed := progress >= target
		if completed {
			progress = target
			xpEarned = xpReward
		}
		if _, err := tx.Exec(r.Context(), `
			update user_weekly_quests
			   set progress = $2,
			       status = case when $3 then 'completed' else 'active' end,
			       completed_at = case when $3 then now() else null end
			 where id = $1`, questID, progress, completed); err != nil {
			respond.Error(w, http.StatusInternalServerError, "quest_check_in_failed", "Your check-in did not save. Try once more.")
			return
		}
		if completed {
			if _, err := tx.Exec(r.Context(), `update users set xp = xp + $2 where id = $1`, userID, xpReward); err != nil {
				respond.Error(w, http.StatusInternalServerError, "quest_reward_failed", "The quest saved, but its reward did not. Try once more.")
				return
			}
			_, _ = tx.Exec(r.Context(), `
				insert into notifications (user_id, kind, title, body, data)
				values ($1, 'quest_completion', 'Quest complete', $2, jsonb_build_object('questId', $3, 'xpEarned', $4))`,
				userID, fmt.Sprintf("Nice work — %d XP is now yours.", xpReward), questID, xpReward)
		}
	}

	result, err := h.checkInResult(r.Context(), tx, userID, questID, window, today, xpEarned, alreadyCheckedIn)
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "quest_check_in_failed", "Your check-in saved, but the update could not load.")
		return
	}
	if err := tx.Commit(r.Context()); err != nil {
		respond.Error(w, http.StatusInternalServerError, "quest_check_in_failed", "Your check-in did not save. Try once more.")
		return
	}
	respond.JSON(w, http.StatusOK, result)
}

func (h *Handler) checkInResult(ctx context.Context, tx pgx.Tx, userID, questID string, window weeklyWindow, today string, xpEarned int, already bool) (CheckInResult, error) {
	score, err := recomputeScore(ctx, tx, userID, window.StartDate, "weekly_quest", questID)
	if err != nil {
		return CheckInResult{}, err
	}
	quest, err := queryWeeklyQuest(ctx, tx, userID, questID, today)
	if err != nil {
		return CheckInResult{}, err
	}
	var totalXP int
	if err := tx.QueryRow(ctx, `select xp from users where id = $1`, userID).Scan(&totalXP); err != nil {
		return CheckInResult{}, err
	}
	return CheckInResult{
		Quest:            quest,
		Score:            score,
		XPEarned:         xpEarned,
		TotalXP:          totalXP,
		AlreadyCheckedIn: already,
	}, nil
}

type questVerificationError struct {
	Code    string
	Message string
}

func (e questVerificationError) Error() string {
	return e.Message
}

func verifyQuestEvidence(
	ctx context.Context,
	tx pgx.Tx,
	userID, verificationType, weekStart, today, timezone string,
	currentProgress int,
) (string, error) {
	if verificationType == "self_report" {
		return today, nil
	}

	todayDate, err := time.Parse("2006-01-02", today)
	if err != nil {
		return "", err
	}

	switch verificationType {
	case "bank_no_spend", "bank_no_delivery":
		evidenceDate := todayDate.AddDate(0, 0, -1).Format("2006-01-02")
		if evidenceDate < weekStart {
			return "", questVerificationError{
				Code:    "full_day_not_ready",
				Message: "The first full day of this quest will be ready to verify tomorrow.",
			}
		}

		var connected, fresh bool
		if err := tx.QueryRow(ctx, `
			select exists(
			         select 1 from plaid_items i
			          where i.user_id = $1 and i.status = 'active' and i.archived_at is null
			       ),
			       exists(
			         select 1 from plaid_items i
			          where i.user_id = $1 and i.status = 'active' and i.archived_at is null
			            and i.last_sync_at >= (($2::date + 1)::timestamp at time zone $3)
			       )`, userID, evidenceDate, timezone).Scan(&connected, &fresh); err != nil {
			return "", err
		}
		if !connected {
			return "", questVerificationError{
				Code:    "bank_connection_required",
				Message: "Connect an account in Budget before checking a bank-verified quest.",
			}
		}
		if !fresh {
			return "", questVerificationError{
				Code:    "bank_sync_required",
				Message: "Open Budget and refresh your transactions first, then Bud can verify yesterday.",
			}
		}

		if verificationType == "bank_no_spend" {
			var outgoing int
			if err := tx.QueryRow(ctx, `
				select count(*)
				  from plaid_transactions
				 where user_id = $1 and date = $2::date and pending = false
				   and amount_cents > 0
				   and coalesce(personal_finance_category_primary, '') not in ('INCOME', 'TRANSFER_IN', 'TRANSFER_OUT')`,
				userID, evidenceDate).Scan(&outgoing); err != nil {
				return "", err
			}
			if outgoing > 0 {
				return "", questVerificationError{
					Code:    "outgoing_transactions_found",
					Message: fmt.Sprintf("Bud found %d outgoing %s yesterday, so that day cannot count as no-buy.", outgoing, plural(outgoing, "transaction", "transactions")),
				}
			}
		}

		if verificationType == "bank_no_delivery" {
			var deliveries int
			if err := tx.QueryRow(ctx, `
				select count(*)
				  from plaid_transactions
				 where user_id = $1 and date = $2::date and pending = false and amount_cents > 0
				   and (
				     coalesce(personal_finance_category_detailed, '') ilike '%DELIVERY%'
				     or lower(coalesce(merchant_name, name)) ~ '(doordash|uber[[:space:]]*eats|grubhub|postmates|seamless|delivery)'
				   )`, userID, evidenceDate).Scan(&deliveries); err != nil {
				return "", err
			}
			if deliveries > 0 {
				return "", questVerificationError{
					Code:    "delivery_transactions_found",
					Message: "Bud found a delivery purchase yesterday, so that day cannot count yet.",
				}
			}
		}
		return evidenceDate, nil

	case "goal_contribution":
		var contributions int
		if err := tx.QueryRow(ctx, `
			select count(*)
			  from goal_contributions
			 where user_id = $1 and amount_cents > 0
			   and (contributed_at at time zone $3)::date >= $2::date`,
			userID, weekStart, timezone).Scan(&contributions); err != nil {
			return "", err
		}
		if contributions <= currentProgress {
			return "", questVerificationError{
				Code:    "goal_contribution_missing",
				Message: "Add a new contribution to one of your goals, then Bud can verify this move.",
			}
		}
		return today, nil

	case "budget_limit":
		var saved bool
		if err := tx.QueryRow(ctx, `
			select exists(
			  select 1 from budget_category_limits
			   where user_id = $1 and (updated_at at time zone $3)::date >= $2::date
			)`, userID, weekStart, timezone).Scan(&saved); err != nil {
			return "", err
		}
		if !saved {
			return "", questVerificationError{
				Code:    "budget_limit_missing",
				Message: "Save a category limit in Budget first, then Bud can verify this quest.",
			}
		}
		return today, nil
	default:
		return "", fmt.Errorf("unsupported quest verification type %q", verificationType)
	}
}

func plural(count int, singular, pluralValue string) string {
	if count == 1 {
		return singular
	}
	return pluralValue
}

func (h *Handler) ensureWeeklyQuests(ctx context.Context, tx pgx.Tx, userID string, window weeklyWindow) error {
	var assigned int
	if err := tx.QueryRow(ctx, `select count(*) from user_weekly_quests where user_id = $1 and week_start = $2::date`, userID, window.StartDate).Scan(&assigned); err != nil {
		return err
	}
	if assigned >= weeklyQuestCount {
		return nil
	}

	facts, err := loadPersonalizationFacts(ctx, tx, userID)
	if err != nil {
		return err
	}
	rows, err := tx.Query(ctx, `
		select qt.id, qt.category, qt.title, qt.instructions, qt.check_in_label,
		       qt.icon_name, qt.verification_type, qt.verification_description,
		       qt.target_value, qt.unit, qt.xp_reward, qt.score_impact
		  from quest_templates qt
		 where qt.is_active = true
		   and $2 between qt.minimum_score and qt.maximum_score
		   and (
		     qt.verification_type not in ('bank_no_spend', 'bank_no_delivery')
		     or exists (
		       select 1 from plaid_items i
		        where i.user_id = $1 and i.status = 'active' and i.archived_at is null
		     )
		   )
		   and (
		     qt.verification_type <> 'goal_contribution'
		     or exists (select 1 from goals g where g.user_id = $1 and g.archived_at is null)
		   )
		   and not exists (
		     select 1 from user_weekly_quests current_week
		      where current_week.user_id = $1
		        and current_week.week_start = $3::date
		        and current_week.template_id = qt.id
		   )
		   and not exists (
		     select 1 from user_weekly_quests recent
		      where recent.user_id = $1
		        and recent.template_id = qt.id
		        and recent.week_start >= $3::date - 28
		   )
		 order by random()
		 limit $4`, userID, facts.Score, window.StartDate, weeklyQuestCount-assigned)
	if err != nil {
		return err
	}
	templates := make([]questTemplate, 0, weeklyQuestCount-assigned)
	for rows.Next() {
		var template questTemplate
		if err := rows.Scan(
			&template.ID, &template.Category, &template.Title, &template.Instructions,
			&template.CheckInLabel, &template.IconName, &template.VerificationType,
			&template.VerificationDescription, &template.TargetValue,
			&template.Unit, &template.XPReward, &template.ScoreImpact,
		); err != nil {
			rows.Close()
			return err
		}
		templates = append(templates, template)
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return err
	}
	rows.Close()

	for _, template := range templates {
		if _, err := tx.Exec(ctx, `
			insert into user_weekly_quests (
			  user_id, template_id, week_start, title, why_it_matters, instructions,
			  check_in_label, icon_name, verification_type, verification_description,
			  category, target_value, unit, xp_reward, score_impact, expires_at
			) values ($1, $2, $3::date, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
			on conflict (user_id, week_start, template_id) do nothing`,
			userID, template.ID, window.StartDate, template.Title,
			personalizedWhy(template.Category, facts), template.Instructions,
			template.CheckInLabel, template.IconName, template.VerificationType,
			template.VerificationDescription, template.Category,
			template.TargetValue, template.Unit, template.XPReward,
			template.ScoreImpact, window.Reset.UTC(),
		); err != nil {
			return err
		}
	}
	return nil
}

func ensureFinancialProfile(ctx context.Context, tx pgx.Tx, userID string) error {
	_, err := tx.Exec(ctx, `
		insert into financial_health_profiles (user_id, score, previous_score, score_band)
		select id,
		       greatest(300, least(850, financial_health_score)),
		       greatest(300, least(850, financial_health_score)),
		       $2
		  from users where id = $1
		on conflict (user_id) do nothing`, userID, scoreBand(500))
	return err
}

func recomputeScore(ctx context.Context, tx pgx.Tx, userID, weekStart, sourceType, sourceID string) (FinancialScore, error) {
	var previous int
	if err := tx.QueryRow(ctx, `select score from financial_health_profiles where user_id = $1 for update`, userID).Scan(&previous); err != nil {
		return FinancialScore{}, err
	}

	components := ScoreComponents{}
	if err := tx.QueryRow(ctx, `
		with history as (
		  select count(*)::float8 as assigned,
		         count(*) filter (where status = 'completed')::float8 as completed
		    from user_weekly_quests
		   where user_id = $1 and week_start < $2::date and week_start >= $2::date - 56
		), current_week as (
		  select count(*) filter (where status = 'completed')::float8 as completed
		    from user_weekly_quests
		   where user_id = $1 and week_start = $2::date
		)
		select least(100, ((history.completed + 1.5) / (history.assigned + 3.0)) * 100 + current_week.completed * 6.5)
		  from history, current_week`, userID, weekStart).Scan(&components.Quests); err != nil {
		return FinancialScore{}, err
	}
	if err := tx.QueryRow(ctx, `
		with monthly_spend as (
		  select case
		           when personal_finance_category_primary = 'FOOD_AND_DRINK' then 'food'
		           when personal_finance_category_primary = 'TRANSPORTATION' then 'transport'
		           when personal_finance_category_primary = 'GENERAL_MERCHANDISE' then 'shopping'
		           when personal_finance_category_primary in ('RENT_AND_UTILITIES', 'HOME_IMPROVEMENT') then 'housing'
		           when personal_finance_category_primary = 'ENTERTAINMENT' then 'entertainment'
		           when personal_finance_category_primary = 'MEDICAL' then 'health'
		           else 'other'
		         end as category_id,
		         sum(greatest(amount_cents, 0)) as spent_cents
		    from plaid_transactions
		   where user_id = $1 and pending = false
		     and date >= date_trunc('month', current_date)::date
		   group by 1
		), scored as (
		  select case when coalesce(ms.spent_cents, 0) <= l.limit_cents then 1.0 else 0.0 end as on_track
		    from budget_category_limits l
		    left join monthly_spend ms using (category_id)
		   where l.user_id = $1
		)
		select coalesce(avg(on_track) * 100, 50) from scored`, userID).Scan(&components.Budgeting); err != nil {
		return FinancialScore{}, err
	}
	if err := tx.QueryRow(ctx, `
		with pace as (
		  select coalesce(sum(greatest(gc.amount_cents, 0)), 0)::float8 as contributed,
		         coalesce((select sum(monthly_commit_cents) from goals where user_id = $1 and archived_at is null), 0)::float8 as planned
		    from goal_contributions gc
		   where gc.user_id = $1 and gc.contributed_at >= now() - interval '30 days'
		)
		select case when planned <= 0 then 50 else least(100, contributed / planned * 100) end from pace`, userID).Scan(&components.Saving); err != nil {
		return FinancialScore{}, err
	}
	if err := tx.QueryRow(ctx, `
		select coalesce(avg(least(1.0, already_saved_cents::numeric / nullif(target_amount_cents, 0))) * 100, 50)
		  from goals where user_id = $1 and archived_at is null`, userID).Scan(&components.Goals); err != nil {
		return FinancialScore{}, err
	}
	if err := tx.QueryRow(ctx, `select least(100, streak::float8 / 21.0 * 100) from users where id = $1`, userID).Scan(&components.Consistency); err != nil {
		return FinancialScore{}, err
	}

	value := calculateFinancialScore(components)
	band := scoreBand(value)
	if _, err := tx.Exec(ctx, `
		update financial_health_profiles
		   set previous_score = score,
		       score = $2,
		       score_band = $3,
		       quest_consistency = $4,
		       budget_consistency = $5,
		       savings_momentum = $6,
		       goal_progress = $7,
		       engagement_consistency = $8,
		       recalculated_at = now()
		 where user_id = $1`, userID, value, band, components.Quests,
		components.Budgeting, components.Saving, components.Goals, components.Consistency); err != nil {
		return FinancialScore{}, err
	}
	if value != previous {
		if _, err := tx.Exec(ctx, `
			insert into financial_score_events (user_id, source_type, source_id, previous_score, new_score)
			values ($1, $2, nullif($3, ''), $4, $5)`, userID, sourceType, sourceID, previous, value); err != nil {
			return FinancialScore{}, err
		}
	}

	nextTier, points := nextLeague(value)
	return FinancialScore{
		Value:            value,
		PreviousValue:    previous,
		Change:           value - previous,
		Band:             band,
		LeagueTier:       leagueTier(value),
		NextLeagueTier:   nextTier,
		PointsToNextTier: points,
		Components:       components,
		UpdatedAt:        time.Now().UTC().Format(time.RFC3339),
	}, nil
}

func queryWeeklyQuests(ctx context.Context, db queryer, userID, weekStart, today string) ([]WeeklyQuest, error) {
	rows, err := db.Query(ctx, weeklyQuestSelect+`
		 where q.user_id = $1 and q.week_start = $2::date
		 order by q.status = 'completed', q.created_at`, userID, weekStart, today)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	quests := []WeeklyQuest{}
	for rows.Next() {
		quest, err := scanWeeklyQuest(rows)
		if err != nil {
			return nil, err
		}
		quests = append(quests, quest)
	}
	return quests, rows.Err()
}

func queryWeeklyQuest(ctx context.Context, db queryer, userID, questID, today string) (WeeklyQuest, error) {
	return scanWeeklyQuest(db.QueryRow(ctx, weeklyQuestSelect+`
		 where q.user_id = $1 and q.id = $2`, userID, questID, today))
}

const weeklyQuestSelect = `
	select q.id::text, q.template_id, q.category, q.title, q.why_it_matters,
	       q.instructions, q.check_in_label, q.icon_name, q.verification_type,
	       q.verification_description, q.xp_reward,
	       q.score_impact, q.progress, q.target_value, q.unit, q.expires_at,
	       q.status, q.completed_at,
	       exists(
	         select 1 from quest_check_ins c
	          where c.quest_id = q.id
	            and c.check_in_date = case
	              when q.verification_type in ('bank_no_spend', 'bank_no_delivery') then $3::date - 1
	              else $3::date
	            end
	       )
	  from user_weekly_quests q`

func scanWeeklyQuest(row pgx.Row) (WeeklyQuest, error) {
	var quest WeeklyQuest
	var deadline time.Time
	var completedAt *time.Time
	err := row.Scan(
		&quest.ID, &quest.TemplateID, &quest.Category, &quest.Title, &quest.WhyItMatters,
		&quest.Instructions, &quest.CheckInLabel, &quest.IconName,
		&quest.VerificationType, &quest.VerificationDescription, &quest.XPReward,
		&quest.ScoreImpact, &quest.Progress, &quest.Total, &quest.Unit, &deadline,
		&quest.Status, &completedAt, &quest.CheckedInToday,
	)
	if err != nil {
		return WeeklyQuest{}, err
	}
	quest.Type = "short"
	quest.Deadline = deadline.UTC().Format(time.RFC3339)
	if completedAt != nil {
		quest.CompletedAt = completedAt.UTC().Format(time.RFC3339)
	}
	return quest, nil
}

func loadPersonalizationFacts(ctx context.Context, tx pgx.Tx, userID string) (personalizationFacts, error) {
	var facts personalizationFacts
	err := tx.QueryRow(ctx, `
		select greatest(300, least(850, u.financial_health_score)), u.streak,
		       coalesce((select name from goals where user_id = u.id and archived_at is null order by deadline limit 1), ''),
		       coalesce((select greatest(target_amount_cents - already_saved_cents, 0) from goals where user_id = u.id and archived_at is null order by deadline limit 1), 0),
		       (select count(*) from plaid_transactions where user_id = u.id and pending = false and date >= current_date - 30),
		       coalesce((select sum(greatest(amount_cents, 0)) from plaid_transactions where user_id = u.id and pending = false and date >= current_date - 30 and personal_finance_category_primary = 'FOOD_AND_DRINK'), 0)
		  from users u where u.id = $1`, userID).Scan(
		&facts.Score, &facts.Streak, &facts.GoalName, &facts.GoalRemainingCents,
		&facts.RecentTransactionCount, &facts.DiningSpendCents,
	)
	return facts, err
}

func personalizedWhy(category string, facts personalizationFacts) string {
	switch category {
	case "spending":
		if facts.DiningSpendCents > 0 {
			return fmt.Sprintf("Food and delivery totaled %s in the last 30 days — a few home-first choices can leave more room for what matters.", dollars(facts.DiningSpendCents))
		}
		return fmt.Sprintf("Your score is %d — a small spending pattern this week can turn awareness into momentum.", facts.Score)
	case "saving", "goals":
		if facts.GoalName != "" {
			return fmt.Sprintf("%s is %s from its finish line — one small move keeps it real and visible.", facts.GoalName, dollars(facts.GoalRemainingCents))
		}
		return "One deliberate saving choice gives the rest of the week a little more breathing room."
	case "awareness":
		if facts.RecentTransactionCount > 0 {
			return fmt.Sprintf("You have %d purchases from the last 30 days — a quick review turns them into useful signals.", facts.RecentTransactionCount)
		}
		return "A quick look now makes the next purchase feel more intentional, without adding a pile of work."
	case "consistency":
		if facts.Streak > 0 {
			return fmt.Sprintf("Your %d-day streak already has momentum — a few one-minute check-ins help it stick.", facts.Streak)
		}
		return "Short check-ins make money awareness easier to repeat, even on busy days."
	default:
		return fmt.Sprintf("Your score is %d — planning a few choices before they happen is the clearest path to the next range.", facts.Score)
	}
}

func dollars(cents int64) string {
	return fmt.Sprintf("$%.0f", float64(cents)/100)
}

func (h *Handler) userWeek(ctx context.Context, userID string, now time.Time) (weeklyWindow, string, error) {
	var timezone string
	if err := h.db.QueryRow(ctx, `
		select coalesce((select timezone from notification_preferences where user_id = $1), 'America/New_York')`, userID).Scan(&timezone); err != nil {
		return weeklyWindow{}, "", err
	}
	location, err := time.LoadLocation(timezone)
	if err != nil {
		location = time.UTC
	}
	local := now.In(location)
	daysFromMonday := (int(local.Weekday()) + 6) % 7
	start := time.Date(local.Year(), local.Month(), local.Day()-daysFromMonday, 0, 0, 0, 0, location)
	window := weeklyWindow{
		Start:     start,
		Reset:     start.AddDate(0, 0, 7),
		StartDate: start.Format("2006-01-02"),
		Timezone:  timezone,
	}
	return window, local.Format("2006-01-02"), nil
}

func (h *Handler) loadLeague(ctx context.Context, userID string, score int, reset time.Time) (League, error) {
	minimum, maximum := leagueBounds(score)
	rows, err := h.db.Query(ctx, `
		with ranked as (
		  select u.id::text, u.first_name, u.last_name, u.level, u.xp, u.streak,
		         u.financial_health_score,
		         row_number() over (order by u.financial_health_score desc, u.xp desc, u.streak desc, u.joined_at)::integer as rank
		    from users u
		   where u.onboarding_complete = true
		     and u.financial_health_score between $2 and $3
		)
		select id, first_name, last_name, level, xp, streak, financial_health_score, rank,
		       id = $1::text
		  from ranked
		 where rank <= 30 or id = $1::text
		 order by rank`, userID, minimum, maximum)
	if err != nil {
		return League{}, err
	}
	defer rows.Close()

	users := []LeagueUser{}
	currentRank := 0
	for rows.Next() {
		var user LeagueUser
		var firstName, lastName string
		if err := rows.Scan(
			&user.ID, &firstName, &lastName, &user.Level, &user.XP, &user.Streak,
			&user.FinancialScore, &user.Rank, &user.IsCurrentUser,
		); err != nil {
			return League{}, err
		}
		user.Name = publicName(firstName, lastName)
		if user.IsCurrentUser {
			currentRank = user.Rank
		}
		users = append(users, user)
	}
	if err := rows.Err(); err != nil {
		return League{}, err
	}
	return League{
		Tier:            leagueTier(score),
		ResetDate:       reset.UTC().Format(time.RFC3339),
		Users:           users,
		CurrentUserRank: currentRank,
	}, nil
}

func leagueBounds(score int) (int, int) {
	switch leagueTier(score) {
	case "Champion":
		return 770, 850
	case "Diamond":
		return 690, 769
	case "Platinum":
		return 610, 689
	case "Gold":
		return 530, 609
	case "Silver":
		return 450, 529
	default:
		return 300, 449
	}
}

func publicName(firstName, lastName string) string {
	firstName = strings.TrimSpace(firstName)
	lastName = strings.TrimSpace(lastName)
	if lastName == "" {
		return firstName
	}
	initial := string([]rune(lastName)[0])
	return fmt.Sprintf("%s %s.", firstName, strings.ToUpper(initial))
}

func firstQuestSuggestion(w http.ResponseWriter, r *http.Request) {
	goalKind := normalizeGoalKind(r.URL.Query().Get("goalKind"))
	respond.JSON(w, http.StatusOK, firstQuestByGoal[goalKind])
}

func normalizeGoalKind(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "emergency_fund", "debt_payoff", "stop_overspending", "savings_target", "invest", "income_growth":
		return strings.ToLower(strings.TrimSpace(value))
	default:
		return "custom"
	}
}

var firstQuestByGoal = map[string]FirstQuest{
	"emergency_fund":    {ID: "q_first_emergency", Name: "Move $25 to savings this week", WhyItMatters: "$25 is small enough to feel doable and big enough to start a habit.", XPReward: 80, DurationLabel: "this week", GoalKind: "emergency_fund"},
	"debt_payoff":       {ID: "q_first_debt", Name: "Make one extra $20 payment this week", WhyItMatters: "One extra payment creates visible momentum without wrecking your week.", XPReward: 80, DurationLabel: "this week", GoalKind: "debt_payoff"},
	"stop_overspending": {ID: "q_first_awareness", Name: "Log every coffee + takeout for 7 days", WhyItMatters: "Awareness comes before discipline. Once you see the pattern, the change gets easier.", XPReward: 75, DurationLabel: "next 7 days", GoalKind: "stop_overspending"},
	"savings_target":    {ID: "q_first_save", Name: "Set up one auto-transfer to your goal", WhyItMatters: "Automating one transfer means the goal grows even on the days you forget.", XPReward: 100, DurationLabel: "this week", GoalKind: "savings_target"},
	"invest":            {ID: "q_first_invest", Name: "Open or fund an investment account this week", WhyItMatters: "Compound growth needs years, not drama. The first dollar matters because it starts the clock.", XPReward: 120, DurationLabel: "this week", GoalKind: "invest"},
	"income_growth":     {ID: "q_first_income", Name: "Track all income sources for the next 7 days", WhyItMatters: "Knowing the real number is the first step to growing it.", XPReward: 70, DurationLabel: "next 7 days", GoalKind: "income_growth"},
	"custom":            {ID: "q_first_custom", Name: "Write a 1-line plan for your goal", WhyItMatters: "A goal without a first move stays a wish. One sentence is enough to begin.", XPReward: 60, DurationLabel: "this week", GoalKind: "custom"},
}

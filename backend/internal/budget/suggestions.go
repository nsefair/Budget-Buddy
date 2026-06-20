package budget

import (
	"context"
	"math"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const recommendationLookbackMonths = 3

type Recommendation struct {
	CategoryID     string  `json:"categoryId"`
	Name           string  `json:"name"`
	Bucket         string  `json:"bucket"`
	AverageSpend   float64 `json:"averageSpend"`
	SuggestedLimit float64 `json:"suggestedLimit"`
	Source         string  `json:"source"`
	Icon           string  `json:"icon"`
	Color          string  `json:"color"`
}

type RecommendationSet struct {
	Ready                 bool             `json:"ready"`
	Source                string           `json:"source"`
	LookbackStart         string           `json:"lookbackStart,omitempty"`
	LookbackEnd           string           `json:"lookbackEnd,omitempty"`
	DetectedMonthlyIncome float64          `json:"detectedMonthlyIncome"`
	NeedsTarget           float64          `json:"needsTarget"`
	WantsTarget           float64          `json:"wantsTarget"`
	SavingsTarget         float64          `json:"savingsTarget"`
	GeneratedAt           string           `json:"generatedAt,omitempty"`
	Categories            []Recommendation `json:"categories"`
	Message               string           `json:"message,omitempty"`
}

type recommendationAmounts struct {
	AverageSpendCents int64
	SuggestedCents    int64
}

// RefreshRecommendations rebuilds suggestions after transaction sync. It is
// intentionally best-effort: incomplete onboarding or missing detected income
// leaves the recommendation set unready without breaking Plaid sync.
func RefreshRecommendations(ctx context.Context, db *pgxpool.Pool, userID string) error {
	var onboardingComplete bool
	if err := db.QueryRow(ctx, `select onboarding_complete from users where id = $1`, userID).Scan(&onboardingComplete); err != nil {
		return err
	}
	if !onboardingComplete {
		return nil
	}

	lookbackEnd := time.Now().UTC()
	lookbackStart := lookbackEnd.AddDate(0, -recommendationLookbackMonths, 0)
	rows, err := db.Query(
		ctx,
		`select amount_cents,
		        coalesce(personal_finance_category_primary, ''),
		        coalesce(personal_finance_category_detailed, ''),
		        category
		   from plaid_transactions
		  where user_id = $1
		    and pending = false
		    and date >= $2::date
		    and date <= $3::date`,
		userID,
		lookbackStart.Format("2006-01-02"),
		lookbackEnd.Format("2006-01-02"),
	)
	if err != nil {
		return err
	}
	defer rows.Close()

	spendByCategory := map[string]int64{}
	var incomeCents int64
	for rows.Next() {
		var amountCents int64
		var primary, detailed string
		var legacy []string
		if err := rows.Scan(&amountCents, &primary, &detailed, &legacy); err != nil {
			return err
		}

		if isDetectedIncome(amountCents, primary, detailed, legacy) {
			incomeCents += -amountCents
			continue
		}
		if amountCents <= 0 || isTransferCategory(primary, detailed, legacy) {
			continue
		}
		spendByCategory[categoryForTransaction(primary, legacy)] += amountCents
	}
	if err := rows.Err(); err != nil {
		return err
	}

	monthlyIncomeCents := int64(math.Round(float64(incomeCents) / recommendationLookbackMonths))
	if monthlyIncomeCents <= 0 {
		_, err := db.Exec(ctx, `delete from budget_recommendations where user_id = $1`, userID)
		return err
	}

	averages := map[string]int64{}
	for _, category := range defaultCategories {
		averages[category.ID] = int64(math.Round(float64(spendByCategory[category.ID]) / recommendationLookbackMonths))
	}

	needsTarget := int64(math.Round(float64(monthlyIncomeCents) * 0.50))
	wantsTarget := int64(math.Round(float64(monthlyIncomeCents) * 0.30))
	suggested := allocateRecommendations(averages, needsTarget, wantsTarget)
	generatedAt := time.Now().UTC()

	tx, err := db.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	for _, category := range defaultCategories {
		amounts := suggested[category.ID]
		if _, err := tx.Exec(
			ctx,
			`insert into budget_recommendations (
			   user_id, category_id, bucket, average_spend_cents,
			   suggested_limit_cents, detected_monthly_income_cents,
			   lookback_start, lookback_end, source, generated_at
			 )
			 values ($1, $2, $3, $4, $5, $6, $7, $8, 'bud_recommended', $9)
			 on conflict (user_id, category_id) do update set
			   bucket = excluded.bucket,
			   average_spend_cents = excluded.average_spend_cents,
			   suggested_limit_cents = excluded.suggested_limit_cents,
			   detected_monthly_income_cents = excluded.detected_monthly_income_cents,
			   lookback_start = excluded.lookback_start,
			   lookback_end = excluded.lookback_end,
			   source = excluded.source,
			   generated_at = excluded.generated_at`,
			userID,
			category.ID,
			budgetBucket(category.ID),
			amounts.AverageSpendCents,
			amounts.SuggestedCents,
			monthlyIncomeCents,
			lookbackStart.Format("2006-01-02"),
			lookbackEnd.Format("2006-01-02"),
			generatedAt,
		); err != nil {
			return err
		}
	}

	return tx.Commit(ctx)
}

func LoadRecommendations(ctx context.Context, db *pgxpool.Pool, userID string) (RecommendationSet, error) {
	rows, err := db.Query(
		ctx,
		`select category_id, bucket, average_spend_cents, suggested_limit_cents,
		        detected_monthly_income_cents, lookback_start, lookback_end,
		        source, generated_at
		   from budget_recommendations
		  where user_id = $1
		  order by array_position(
		    array['food', 'transport', 'shopping', 'housing', 'entertainment', 'health', 'personal', 'education'],
		    category_id
		  )`,
		userID,
	)
	if err != nil {
		return RecommendationSet{}, err
	}
	defer rows.Close()

	set := RecommendationSet{
		Source:     "bud_recommended",
		Categories: []Recommendation{},
	}
	var incomeCents int64
	var lookbackStart, lookbackEnd time.Time
	var generatedAt time.Time
	for rows.Next() {
		var categoryID, bucket, source string
		var averageCents, suggestedCents, rowIncomeCents int64
		var rowStart, rowEnd, rowGenerated time.Time
		if err := rows.Scan(
			&categoryID,
			&bucket,
			&averageCents,
			&suggestedCents,
			&rowIncomeCents,
			&rowStart,
			&rowEnd,
			&source,
			&rowGenerated,
		); err != nil {
			return RecommendationSet{}, err
		}

		meta := categoryMetaByID(categoryID)
		set.Categories = append(set.Categories, Recommendation{
			CategoryID:     categoryID,
			Name:           meta.Name,
			Bucket:         bucket,
			AverageSpend:   centsToDollars(averageCents),
			SuggestedLimit: centsToDollars(suggestedCents),
			Source:         source,
			Icon:           meta.Icon,
			Color:          meta.Color,
		})
		incomeCents = rowIncomeCents
		lookbackStart = rowStart
		lookbackEnd = rowEnd
		generatedAt = rowGenerated
	}
	if err := rows.Err(); err != nil {
		return RecommendationSet{}, err
	}

	if len(set.Categories) == 0 {
		set.Message = "Budget suggestions will be ready after onboarding and enough income history has synced."
		return set, nil
	}

	set.Ready = true
	set.DetectedMonthlyIncome = centsToDollars(incomeCents)
	set.NeedsTarget = centsToDollars(int64(math.Round(float64(incomeCents) * 0.50)))
	set.WantsTarget = centsToDollars(int64(math.Round(float64(incomeCents) * 0.30)))
	set.SavingsTarget = centsToDollars(incomeCents - int64(math.Round(float64(incomeCents)*0.80)))
	set.LookbackStart = lookbackStart.Format("2006-01-02")
	set.LookbackEnd = lookbackEnd.Format("2006-01-02")
	set.GeneratedAt = generatedAt.Format(time.RFC3339)
	return set, nil
}

func allocateRecommendations(averages map[string]int64, needsTarget, wantsTarget int64) map[string]recommendationAmounts {
	result := map[string]recommendationAmounts{}
	for _, bucket := range []struct {
		name   string
		target int64
	}{{"needs", needsTarget}, {"wants", wantsTarget}} {
		ids := []string{}
		var observedTotal int64
		var fallbackTotal float64
		for _, category := range defaultCategories {
			if budgetBucket(category.ID) != bucket.name {
				continue
			}
			ids = append(ids, category.ID)
			observedTotal += averages[category.ID]
			fallbackTotal += category.BudgetLimit
		}

		var allocated int64
		for index, id := range ids {
			average := averages[id]
			var suggestion int64
			if index == len(ids)-1 {
				suggestion = bucket.target - allocated
			} else if observedTotal > 0 {
				suggestion = int64(math.Floor(float64(bucket.target) * float64(average) / float64(observedTotal)))
			} else {
				meta := categoryMetaByID(id)
				suggestion = int64(math.Floor(float64(bucket.target) * meta.BudgetLimit / fallbackTotal))
			}
			if suggestion < 0 {
				suggestion = 0
			}
			allocated += suggestion
			result[id] = recommendationAmounts{AverageSpendCents: average, SuggestedCents: suggestion}
		}
	}
	return result
}

func budgetBucket(categoryID string) string {
	switch categoryID {
	case "housing", "food", "transport", "health", "education":
		return "needs"
	default:
		return "wants"
	}
}

func isDetectedIncome(amountCents int64, primary, detailed string, legacy []string) bool {
	if amountCents >= 0 || isTransferCategory(primary, detailed, legacy) {
		return false
	}
	combined := strings.ToUpper(strings.TrimSpace(primary + " " + detailed + " " + strings.Join(legacy, " ")))
	return strings.Contains(combined, "INCOME") ||
		strings.Contains(combined, "PAYROLL") ||
		strings.Contains(combined, "DIRECT DEPOSIT")
}

func isTransferCategory(primary, detailed string, legacy []string) bool {
	combined := strings.ToUpper(strings.TrimSpace(primary + " " + detailed + " " + strings.Join(legacy, " ")))
	return strings.Contains(combined, "TRANSFER")
}

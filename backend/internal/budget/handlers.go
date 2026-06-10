package budget

import (
	"fmt"
	"math"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"budget-buddy/backend/internal/auth"
	"budget-buddy/backend/internal/respond"
)

type authMiddleware func(http.Handler) http.Handler

type Handler struct {
	db *pgxpool.Pool
}

type Category struct {
	ID          string  `json:"id"`
	Name        string  `json:"name"`
	Icon        string  `json:"icon"`
	BudgetLimit float64 `json:"budgetLimit"`
	Spent       float64 `json:"spent"`
	Color       string  `json:"color"`
}

type Overview struct {
	MonthID       string     `json:"monthId"`
	Month         string     `json:"month"`
	TotalBudget   float64    `json:"totalBudget"`
	TotalSpent    float64    `json:"totalSpent"`
	Income        float64    `json:"income"`
	SavingsRate   float64    `json:"savingsRate"`
	AvgDailySpend float64    `json:"avgDailySpend"`
	Categories    []Category `json:"categories"`
}

type MonthOption struct {
	ID          string  `json:"id"`
	Label       string  `json:"label"`
	ShortLabel  string  `json:"shortLabel"`
	TotalSpent  float64 `json:"totalSpent"`
	TotalBudget float64 `json:"totalBudget"`
	IsCurrent   bool    `json:"isCurrent"`
}

type Transaction struct {
	ID          string  `json:"id"`
	Merchant    string  `json:"merchant"`
	Category    string  `json:"category"`
	CategoryID  string  `json:"categoryId"`
	Amount      float64 `json:"amount"`
	Date        string  `json:"date"`
	IsRecurring bool    `json:"isRecurring"`
	IsManual    bool    `json:"isManual"`
	IsFlagged   bool    `json:"isFlagged"`
}

type Account struct {
	ID          string  `json:"id"`
	Name        string  `json:"name"`
	Kind        string  `json:"kind"`
	Balance     float64 `json:"balance"`
	Institution string  `json:"institution,omitempty"`
}

func RegisterRoutes(mux *http.ServeMux, basePath string, db *pgxpool.Pool, requireAuth authMiddleware) {
	handler := &Handler{db: db}
	mux.Handle("GET "+basePath+"/budget/months", requireAuth(http.HandlerFunc(handler.months)))
	mux.Handle("GET "+basePath+"/budget/overview", requireAuth(http.HandlerFunc(handler.overview)))
	mux.Handle("GET "+basePath+"/budget/categories", requireAuth(http.HandlerFunc(handler.categories)))
	mux.Handle("GET "+basePath+"/budget/transactions", requireAuth(http.HandlerFunc(handler.transactions)))
	mux.Handle("GET "+basePath+"/budget/accounts", requireAuth(http.HandlerFunc(handler.accounts)))
	mux.Handle("GET "+basePath+"/today/summary", requireAuth(http.HandlerFunc(handler.todaySummary)))
	mux.Handle("GET "+basePath+"/today/transactions/recent", requireAuth(http.HandlerFunc(handler.recentTransactions)))
}

func (h *Handler) months(w http.ResponseWriter, r *http.Request) {
	userID, _ := auth.UserIDFromContext(r.Context())
	months, err := h.availableMonths(r, userID)
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "budget_months_failed", "Could not load budget months.")
		return
	}
	if len(months) == 0 {
		months = []MonthOption{currentMonthOption(0, 0)}
	}
	respond.JSON(w, http.StatusOK, months)
}

func (h *Handler) overview(w http.ResponseWriter, r *http.Request) {
	userID, _ := auth.UserIDFromContext(r.Context())
	month := monthParam(r)
	overview, err := h.buildOverview(r, userID, month)
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "budget_overview_failed", "Could not load budget overview.")
		return
	}
	respond.JSON(w, http.StatusOK, overview)
}

func (h *Handler) categories(w http.ResponseWriter, r *http.Request) {
	userID, _ := auth.UserIDFromContext(r.Context())
	month := monthParam(r)
	overview, err := h.buildOverview(r, userID, month)
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "budget_categories_failed", "Could not load budget categories.")
		return
	}
	respond.JSON(w, http.StatusOK, overview.Categories)
}

func (h *Handler) transactions(w http.ResponseWriter, r *http.Request) {
	userID, _ := auth.UserIDFromContext(r.Context())
	month := monthParam(r)
	limit := queryInt(r, "limit", 20)
	page := queryInt(r, "page", 1)
	if page < 1 {
		page = 1
	}
	offset := (page - 1) * limit

	transactions, err := h.loadTransactions(r, userID, month, limit, offset)
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "budget_transactions_failed", "Could not load transactions.")
		return
	}
	respond.JSON(w, http.StatusOK, transactions)
}

func (h *Handler) accounts(w http.ResponseWriter, r *http.Request) {
	userID, _ := auth.UserIDFromContext(r.Context())
	accounts, err := h.loadAccounts(r, userID)
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "budget_accounts_failed", "Could not load linked accounts.")
		return
	}
	respond.JSON(w, http.StatusOK, accounts)
}

func (h *Handler) todaySummary(w http.ResponseWriter, r *http.Request) {
	userID, _ := auth.UserIDFromContext(r.Context())
	now := time.Now().UTC()
	month := now.Format("2006-01")
	overview, err := h.buildOverview(r, userID, month)
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "today_summary_failed", "Could not load today summary.")
		return
	}

	spentToday, topName, topAmount, err := h.spendingToday(r, userID, now)
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "today_summary_failed", "Could not load today summary.")
		return
	}

	dailyBudget := overview.TotalBudget / 30
	if dailyBudget <= 0 {
		dailyBudget = 80
	}
	topCategory := overview.Categories[0]
	for _, category := range overview.Categories {
		if category.Spent > topCategory.Spent {
			topCategory = category
		}
	}

	respond.JSON(w, http.StatusOK, map[string]any{
		"totalSpent":        spentToday,
		"dailyBudget":       math.Round(dailyBudget),
		"topCategoryName":   firstNonEmpty(topName, topCategory.Name),
		"topCategoryAmount": firstNonZero(topAmount, topCategory.Spent),
	})
}

func (h *Handler) recentTransactions(w http.ResponseWriter, r *http.Request) {
	userID, _ := auth.UserIDFromContext(r.Context())
	transactions, err := h.loadTransactions(r, userID, "", 5, 0)
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "today_transactions_failed", "Could not load recent transactions.")
		return
	}
	respond.JSON(w, http.StatusOK, transactions)
}

func (h *Handler) availableMonths(r *http.Request, userID string) ([]MonthOption, error) {
	rows, err := h.db.Query(
		r.Context(),
		`select to_char(date_trunc('month', date), 'YYYY-MM') as month_id,
		        sum(case when amount_cents > 0 then amount_cents else 0 end)::bigint as spent_cents
		   from plaid_transactions
		  where user_id = $1 and pending = false
		  group by 1
		  order by 1 asc`,
		userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	currentMonth := time.Now().UTC().Format("2006-01")
	months := []MonthOption{}
	seenCurrent := false

	for rows.Next() {
		var monthID string
		var spentCents int64
		if err := rows.Scan(&monthID, &spentCents); err != nil {
			return nil, err
		}
		totalBudget := totalBudgetLimit()
		months = append(months, MonthOption{
			ID:          monthID,
			Label:       monthLabel(monthID),
			ShortLabel:  shortMonthLabel(monthID),
			TotalSpent:  centsToDollars(spentCents),
			TotalBudget: totalBudget,
			IsCurrent:   monthID == currentMonth,
		})
		if monthID == currentMonth {
			seenCurrent = true
		}
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if !seenCurrent {
		months = append(months, currentMonthOption(0, totalBudgetLimit()))
	}
	return months, nil
}

func (h *Handler) buildOverview(r *http.Request, userID, month string) (Overview, error) {
	spendByCategory, incomeCents, err := h.categorySpend(r, userID, month)
	if err != nil {
		return Overview{}, err
	}

	categories := make([]Category, 0, len(defaultCategories))
	totalSpent := 0.0
	totalBudget := 0.0
	for _, def := range defaultCategories {
		spent := centsToDollars(spendByCategory[def.ID])
		categories = append(categories, Category{
			ID:          def.ID,
			Name:        def.Name,
			Icon:        def.Icon,
			BudgetLimit: def.BudgetLimit,
			Spent:       spent,
			Color:       def.Color,
		})
		totalSpent += spent
		totalBudget += def.BudgetLimit
	}

	income := centsToDollars(incomeCents)
	if income <= 0 {
		income = 3800
	}
	savingsRate := 0.0
	if income > 0 {
		savingsRate = math.Max(0, ((income-totalSpent)/income)*100)
	}

	daysInMonth := daysInMonthCount(month)
	avgDaily := 0.0
	if daysInMonth > 0 {
		avgDaily = totalSpent / float64(daysInMonth)
	}

	return Overview{
		MonthID:       month,
		Month:         monthLabel(month),
		TotalBudget:   totalBudget,
		TotalSpent:    totalSpent,
		Income:        income,
		SavingsRate:   savingsRate,
		AvgDailySpend: avgDaily,
		Categories:    categories,
	}, nil
}

func (h *Handler) categorySpend(r *http.Request, userID, month string) (map[string]int64, int64, error) {
	rows, err := h.db.Query(
		r.Context(),
		`select amount_cents,
		        coalesce(personal_finance_category_primary, ''),
		        category
		   from plaid_transactions
		  where user_id = $1
		    and pending = false
		    and ($2 = '' or to_char(date, 'YYYY-MM') = $2)`,
		userID,
		month,
	)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	spendByCategory := map[string]int64{}
	var incomeCents int64
	for rows.Next() {
		var amountCents int64
		var pfcPrimary string
		var legacyCategory []string
		if err := rows.Scan(&amountCents, &pfcPrimary, &legacyCategory); err != nil {
			return nil, 0, err
		}
		if amountCents < 0 {
			incomeCents += -amountCents
			continue
		}
		categoryID := categoryForTransaction(pfcPrimary, legacyCategory)
		spendByCategory[categoryID] += amountCents
	}
	return spendByCategory, incomeCents, rows.Err()
}

func (h *Handler) loadTransactions(r *http.Request, userID, month string, limit, offset int) ([]Transaction, error) {
	rows, err := h.db.Query(
		r.Context(),
		`select id::text,
		        coalesce(nullif(merchant_name, ''), name) as merchant,
		        coalesce(personal_finance_category_primary, ''),
		        category,
		        amount_cents,
		        date::text
		   from plaid_transactions
		  where user_id = $1
		    and pending = false
		    and amount_cents > 0
		    and ($2 = '' or to_char(date, 'YYYY-MM') = $2)
		  order by date desc, created_at desc
		  limit $3 offset $4`,
		userID,
		month,
		limit,
		offset,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	transactions := []Transaction{}
	for rows.Next() {
		var tx Transaction
		var pfcPrimary string
		var legacyCategory []string
		var amountCents int64
		var date string
		if err := rows.Scan(&tx.ID, &tx.Merchant, &pfcPrimary, &legacyCategory, &amountCents, &date); err != nil {
			return nil, err
		}
		tx.CategoryID = categoryForTransaction(pfcPrimary, legacyCategory)
		tx.Category = categoryNameByID(tx.CategoryID)
		tx.Amount = centsToDollars(amountCents)
		tx.Date = fmt.Sprintf("%sT12:00:00Z", strings.TrimSpace(date))
		transactions = append(transactions, tx)
	}
	return transactions, rows.Err()
}

func (h *Handler) loadAccounts(r *http.Request, userID string) ([]Account, error) {
	rows, err := h.db.Query(
		r.Context(),
		`select pa.id::text,
		        pa.name,
		        pa.subtype,
		        pa.type,
		        coalesce(pa.current_balance_cents, 0),
		        coalesce(pi.institution_name, '')
		   from plaid_accounts pa
		   join plaid_items pi on pi.id = pa.item_id
		  where pa.user_id = $1 and pa.is_active and pi.archived_at is null
		  order by pa.created_at asc`,
		userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	accounts := []Account{}
	for rows.Next() {
		var account Account
		var subtype, accountType string
		var balanceCents int64
		if err := rows.Scan(&account.ID, &account.Name, &subtype, &accountType, &balanceCents, &account.Institution); err != nil {
			return nil, err
		}
		account.Kind = accountKind(subtype, accountType)
		account.Balance = centsToDollars(balanceCents)
		if account.Kind == "credit" && account.Balance > 0 {
			account.Balance = -account.Balance
		}
		accounts = append(accounts, account)
	}
	return accounts, rows.Err()
}

func (h *Handler) spendingToday(r *http.Request, userID string, now time.Time) (float64, string, float64, error) {
	today := now.Format("2006-01-02")
	rows, err := h.db.Query(
		r.Context(),
		`select coalesce(nullif(merchant_name, ''), name) as merchant,
		        amount_cents
		   from plaid_transactions
		  where user_id = $1
		    and pending = false
		    and amount_cents > 0
		    and date = $2::date`,
		userID,
		today,
	)
	if err != nil {
		return 0, "", 0, err
	}
	defer rows.Close()

	var totalCents int64
	topMerchant := ""
	var topAmount int64
	for rows.Next() {
		var merchant string
		var amountCents int64
		if err := rows.Scan(&merchant, &amountCents); err != nil {
			return 0, "", 0, err
		}
		totalCents += amountCents
		if amountCents >= topAmount {
			topAmount = amountCents
			topMerchant = merchant
		}
	}
	return centsToDollars(totalCents), topMerchant, centsToDollars(topAmount), rows.Err()
}

func monthParam(r *http.Request) string {
	month := strings.TrimSpace(r.URL.Query().Get("month"))
	if month == "" {
		return time.Now().UTC().Format("2006-01")
	}
	return month
}

func queryInt(r *http.Request, key string, fallback int) int {
	raw := strings.TrimSpace(r.URL.Query().Get(key))
	if raw == "" {
		return fallback
	}
	value, err := strconv.Atoi(raw)
	if err != nil {
		return fallback
	}
	return value
}

func currentMonthOption(spent, budget float64) MonthOption {
	monthID := time.Now().UTC().Format("2006-01")
	if budget <= 0 {
		budget = totalBudgetLimit()
	}
	return MonthOption{
		ID:          monthID,
		Label:       monthLabel(monthID),
		ShortLabel:  shortMonthLabel(monthID),
		TotalSpent:  spent,
		TotalBudget: budget,
		IsCurrent:   true,
	}
}

func totalBudgetLimit() float64 {
	total := 0.0
	for _, category := range defaultCategories {
		total += category.BudgetLimit
	}
	return total
}

func monthLabel(monthID string) string {
	parsed, err := time.Parse("2006-01", monthID)
	if err != nil {
		return monthID
	}
	return parsed.Format("January 2006")
}

func shortMonthLabel(monthID string) string {
	parsed, err := time.Parse("2006-01", monthID)
	if err != nil {
		return monthID
	}
	return parsed.Format("Jan")
}

func daysInMonthCount(monthID string) int {
	parsed, err := time.Parse("2006-01", monthID)
	if err != nil {
		return 30
	}
	return time.Date(parsed.Year(), parsed.Month()+1, 0, 0, 0, 0, 0, time.UTC).Day()
}

func centsToDollars(cents int64) float64 {
	return float64(cents) / 100
}

func accountKind(subtype, accountType string) string {
	value := strings.ToLower(strings.TrimSpace(subtype))
	if value == "" {
		value = strings.ToLower(strings.TrimSpace(accountType))
	}
	switch {
	case strings.Contains(value, "credit"):
		return "credit"
	case strings.Contains(value, "savings"):
		return "savings"
	case strings.Contains(value, "investment"), strings.Contains(value, "brokerage"):
		return "investment"
	default:
		return "checking"
	}
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if trimmed := strings.TrimSpace(value); trimmed != "" {
			return trimmed
		}
	}
	return ""
}

func firstNonZero(values ...float64) float64 {
	for _, value := range values {
		if value > 0 {
			return value
		}
	}
	return 0
}

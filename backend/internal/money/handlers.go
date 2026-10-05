package money

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"budget-buddy/backend/internal/auth"
	"budget-buddy/backend/internal/requestjson"
	"budget-buddy/backend/internal/respond"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Handler struct {
	db  *pgxpool.Pool
	now func() time.Time
}

func RegisterRoutes(mux *http.ServeMux, base string, db *pgxpool.Pool, requireAuth func(http.Handler) http.Handler) {
	h := &Handler{db: db, now: time.Now}
	mux.Handle("PUT "+base+"/money/profile", requireAuth(http.HandlerFunc(h.saveProfile)))
	mux.Handle("GET "+base+"/money/profile", requireAuth(http.HandlerFunc(h.getProfile)))
	mux.Handle("GET "+base+"/money/today", requireAuth(http.HandlerFunc(h.today)))
	mux.Handle("POST "+base+"/money/spending", requireAuth(http.HandlerFunc(h.spend)))
	mux.Handle("POST "+base+"/money/yesterday/allocate", requireAuth(http.HandlerFunc(h.allocate)))
}
func decode(w http.ResponseWriter, r *http.Request, out any) bool {
	if e := requestjson.Decode(w, r, out, requestjson.DefaultMaxBytes); e != nil {
		respond.JSONBodyError(w, e)
		return false
	}
	return true
}
func fail(w http.ResponseWriter, e error) {
	if errors.Is(e, pgx.ErrNoRows) {
		respond.Error(w, 409, "money_setup_required", "Add income, next arrival, bills, and a goal plan to calculate your number.")
		return
	}
	respond.Error(w, 500, "money_unavailable", "Could not calculate your number. Please try again.")
}
func begin(ctx context.Context, db *pgxpool.Pool, user string) (pgx.Tx, error) {
	tx, e := db.Begin(ctx)
	if e != nil {
		return nil, e
	}
	_, e = tx.Exec(ctx, `select pg_advisory_xact_lock(hashtextextended($1,16))`, user)
	if e != nil {
		tx.Rollback(ctx)
		return nil, e
	}
	return tx, nil
}
func marshal(v any) string { b, _ := json.Marshal(v); return string(b) }

func (h *Handler) saveProfile(w http.ResponseWriter, r *http.Request) {
	user, _ := auth.UserIDFromContext(r.Context())
	var p Profile
	if !decode(w, r, &p) {
		return
	}
	today, e := LocalDate(h.now(), p.Timezone)
	if e != nil {
		respond.Error(w, 400, "invalid_timezone", "Use a valid IANA timezone.")
		return
	}
	// Initial setup starts today. A confirmed new income cycle is an explicit profile update.
	if p.StartDate == "" {
		p.StartDate = today
	}
	if p.StartDate > today {
		respond.Error(w, 400, "invalid_start_date", "Cycle start cannot be in the future.")
		return
	}
	c, e := BuildCycle(p)
	if e != nil {
		respond.Error(w, 400, "invalid_money_profile", e.Error())
		return
	}
	tx, e := begin(r.Context(), h.db, user)
	if e != nil {
		fail(w, e)
		return
	}
	defer tx.Rollback(r.Context())
	_, e = tx.Exec(r.Context(), `insert into money_profiles(user_id,profile,cycle) values($1,$2::jsonb,$3::jsonb) on conflict(user_id) do update set profile=excluded.profile,cycle=excluded.cycle,updated_at=now()`, user, marshal(p), marshal(c))
	if e != nil {
		fail(w, e)
		return
	}
	_, e = tx.Exec(r.Context(), `insert into money_events(user_id,kind,local_date,detail) values($1,'profile_updated',$2,$3::jsonb)`, user, today, marshal(p))
	if e != nil {
		fail(w, e)
		return
	}
	if e = tx.Commit(r.Context()); e != nil {
		fail(w, e)
		return
	}
	respond.JSON(w, 200, map[string]any{"profile": p, "cycle": c, "suggestedGoalCents": SuggestGoal(c.IncomeCents, c.BillsCents, c.Days)})
}
func (h *Handler) getProfile(w http.ResponseWriter, r *http.Request) {
	user, _ := auth.UserIDFromContext(r.Context())
	var p, c json.RawMessage
	e := h.db.QueryRow(r.Context(), `select profile,cycle from money_profiles where user_id=$1`, user).Scan(&p, &c)
	if e != nil {
		fail(w, e)
		return
	}
	respond.JSON(w, 200, map[string]any{"profile": p, "cycle": c})
}

type todayResponse struct {
	Result     Result     `json:"result"`
	Ledger     Ledger     `json:"ledger"`
	LastSyncAt *time.Time `json:"lastSyncAt"`
	BankState  string     `json:"bankState"`
}

func (h *Handler) today(w http.ResponseWriter, r *http.Request) {
	user, _ := auth.UserIDFromContext(r.Context())
	tx, e := begin(r.Context(), h.db, user)
	if e != nil {
		fail(w, e)
		return
	}
	defer tx.Rollback(r.Context())
	result, e := h.calculate(r.Context(), tx, user)
	if e != nil {
		fail(w, e)
		return
	}
	if e = tx.Commit(r.Context()); e != nil {
		fail(w, e)
		return
	}
	respond.JSON(w, 200, result)
}
func (h *Handler) calculate(ctx context.Context, tx pgx.Tx, user string) (todayResponse, error) {
	var out todayResponse
	var rawP, rawC []byte
	e := tx.QueryRow(ctx, `select profile,cycle from money_profiles where user_id=$1`, user).Scan(&rawP, &rawC)
	if e != nil {
		return out, e
	}
	var p Profile
	var c Cycle
	if e = json.Unmarshal(rawP, &p); e != nil {
		return out, e
	}
	if e = json.Unmarshal(rawC, &c); e != nil {
		return out, e
	}
	today, e := LocalDate(h.now(), p.Timezone)
	if e != nil {
		return out, e
	}
	entries, e := loadLedger(ctx, tx, user, c.Start, today)
	if e != nil {
		return out, e
	}
	out.Ledger = Reconcile(entries, p.Bills)
	before, live := Spending(out.Ledger, c.Start, today)
	var allocated int64
	// Virtual set-asides continue to reserve money in their original cycle. Planned
	// contributions for a new cycle already reserve the new cycle's goal money.
	e = tx.QueryRow(ctx, `select coalesce(sum(amount_cents),0)::bigint from money_goal_allocations where user_id=$1 and date >= $2`, user, c.Start).Scan(&allocated)
	if e != nil {
		return out, e
	}
	in := Inputs{Cycle: c, Date: today, SpentBeforeTodayCents: before, SpentTodayCents: live, AllocatedGoalCents: allocated}
	var morning int64
	e = tx.QueryRow(ctx, `select morning_cents from money_daily_snapshots where user_id=$1 and date=$2`, user, today).Scan(&morning)
	if e == nil {
		in.MorningCents = &morning
	} else if !errors.Is(e, pgx.ErrNoRows) {
		return out, e
	}
	out.Result, e = Calculate(in)
	if e != nil {
		return out, e
	}
	_, e = tx.Exec(ctx, `insert into money_daily_snapshots(user_id,date,timezone,cycle_start,version,morning_cents,morning_inputs,latest_result)
 values($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb) on conflict(user_id,date) do update set latest_result=excluded.latest_result,updated_at=now()`, user, today, p.Timezone, c.Start, Version, out.Result.MorningCents, marshal(in), marshal(out.Result))
	if e != nil {
		return out, e
	}
	if out.Result.WaitingForIncome {
		_, e = tx.Exec(ctx, `insert into money_events(user_id,kind,local_date,detail) values($1,'payday_missed',$2,$3::jsonb) on conflict do nothing`, user, today, marshal(map[string]string{"cycleStart": c.Start}))
		if e != nil {
			return out, e
		}
	}
	var count, unhealthy, never int
	e = tx.QueryRow(ctx, `select count(*),count(*) filter(where status<>'active'),count(*) filter(where last_sync_at is null),min(last_sync_at) from plaid_items where user_id=$1 and archived_at is null`, user).Scan(&count, &unhealthy, &never, &out.LastSyncAt)
	if e != nil {
		return out, e
	}
	out.BankState = "manual"
	if count > 0 {
		out.BankState = "current"
		if never > 0 || out.LastSyncAt == nil || h.now().Sub(*out.LastSyncAt) > 24*time.Hour {
			out.BankState = "stale"
		}
		if unhealthy > 0 {
			out.BankState = "reconnect_required"
		}
	}
	return out, nil
}

// Classification only uses supported checking/card accounts. Transfers are excluded
// before reimbursements; ambiguous incoming transfers never create extra allowance.
func classify(primary, detailed, merchant string, amount int64) string {
	d := strings.ToUpper(detailed)
	p := strings.ToUpper(primary)
	name := normalize(merchant)
	if strings.Contains(d, "CREDIT_CARD_PAYMENT") {
		return "card_payment"
	}
	if strings.Contains(d, "ACCOUNT_TRANSFER") || strings.Contains(d, "SAVINGS") {
		return "own_transfer"
	}
	if p == "INCOME" {
		return "income"
	}
	if amount < 0 {
		if strings.Contains(name, "venmo") || strings.Contains(name, "zelle") {
			return "reimbursement"
		}
		if p != "TRANSFER_IN" && p != "LOAN_DISBURSEMENTS" && p != "BANK_FEES" {
			return "refund"
		}
		return "income"
	}
	if p == "TRANSFER_OUT" || p == "LOAN_PAYMENTS" {
		return "own_transfer"
	}
	return "purchase"
}
func loadLedger(ctx context.Context, tx pgx.Tx, user, start, end string) ([]Transaction, error) {
	rows, e := tx.Query(ctx, `select pt.plaid_transaction_id,coalesce(pt.authorized_date,pt.date)::text,pt.amount_cents,coalesce(pt.merchant_name,pt.name),coalesce(pa.type,''),coalesce(pa.subtype,''),coalesce(pt.iso_currency_code,''),coalesce(pt.personal_finance_category_primary,''),coalesce(pt.personal_finance_category_detailed,''),pt.pending,coalesce(pt.pending_transaction_id,'') from plaid_transactions pt join plaid_accounts pa on pa.id=pt.account_id and pa.user_id=pt.user_id where pt.user_id=$1 and pa.is_active and coalesce(pt.authorized_date,pt.date)>=$2::date-2 and coalesce(pt.authorized_date,pt.date)<=$3::date+2`, user, start, end)
	if e != nil {
		return nil, e
	}
	entries := []Transaction{}
	for rows.Next() {
		var t Transaction
		var p, d string
		if e = rows.Scan(&t.ID, &t.Date, &t.AmountCents, &t.Merchant, &t.AccountType, &t.AccountSubtype, &t.Currency, &p, &d, &t.Pending, &t.PendingID); e != nil {
			rows.Close()
			return nil, e
		}
		t.Kind = classify(p, d, t.Merchant, t.AmountCents)
		entries = append(entries, t)
	}
	e = rows.Err()
	rows.Close()
	if e != nil {
		return nil, e
	}
	rows, e = tx.Query(ctx, `select id::text,date::text,amount_cents,merchant,cash from money_manual_entries where user_id=$1 and date>=$2::date-2 and date<=$3::date`, user, start, end)
	if e != nil {
		return nil, e
	}
	defer rows.Close()
	for rows.Next() {
		t := Transaction{Manual: true, Kind: "purchase", Currency: "USD"}
		if e = rows.Scan(&t.ID, &t.Date, &t.AmountCents, &t.Merchant, &t.Cash); e != nil {
			return nil, e
		}
		entries = append(entries, t)
	}
	return entries, rows.Err()
}
func (h *Handler) spend(w http.ResponseWriter, r *http.Request) {
	user, _ := auth.UserIDFromContext(r.Context())
	var req struct {
		ClientID    string `json:"clientId"`
		AmountCents int64  `json:"amountCents"`
		Date        string `json:"date"`
		Merchant    string `json:"merchant"`
		Cash        bool   `json:"cash"`
	}
	if !decode(w, r, &req) {
		return
	}
	if len(req.ClientID) < 8 || len(req.ClientID) > 128 || req.AmountCents <= 0 || !validMoney(req.AmountCents) || len(req.Merchant) > 200 {
		respond.Error(w, 400, "invalid_spending", "Use a unique client ID and a positive amount in cents.")
		return
	}
	tx, e := begin(r.Context(), h.db, user)
	if e != nil {
		fail(w, e)
		return
	}
	defer tx.Rollback(r.Context())
	var zone, start string
	e = tx.QueryRow(r.Context(), `select profile->>'timezone',cycle->>'start' from money_profiles where user_id=$1`, user).Scan(&zone, &start)
	if e != nil {
		fail(w, e)
		return
	}
	today, _ := LocalDate(h.now(), zone)
	if req.Date == "" {
		req.Date = today
	}
	if _, e = date(req.Date); e != nil || req.Date > today || req.Date < start {
		respond.Error(w, 400, "invalid_date", "Spending must be in this cycle and not in the future.")
		return
	}
	_, e = tx.Exec(r.Context(), `insert into money_manual_entries(user_id,client_id,date,amount_cents,merchant,cash) values($1,$2,$3,$4,$5,$6) on conflict(user_id,client_id) do nothing`, user, req.ClientID, req.Date, req.AmountCents, req.Merchant, req.Cash)
	if e != nil {
		fail(w, e)
		return
	}
	result, e := h.calculate(r.Context(), tx, user)
	if e != nil {
		fail(w, e)
		return
	}
	if e = tx.Commit(r.Context()); e != nil {
		fail(w, e)
		return
	}
	respond.JSON(w, 200, result)
}
func (h *Handler) allocate(w http.ResponseWriter, r *http.Request) {
	user, _ := auth.UserIDFromContext(r.Context())
	var req struct {
		GoalID string `json:"goalId"`
	}
	if !decode(w, r, &req) {
		return
	}
	tx, e := begin(r.Context(), h.db, user)
	if e != nil {
		fail(w, e)
		return
	}
	defer tx.Rollback(r.Context())
	current, e := h.calculate(r.Context(), tx, user)
	if e != nil {
		fail(w, e)
		return
	}
	d, _ := date(current.Result.Inputs.Date)
	yesterday := d.AddDate(0, 0, -1).Format("2006-01-02")
	var prior int64
	e = tx.QueryRow(r.Context(), `select amount_cents from money_goal_allocations where user_id=$1 and date=$2`, user, yesterday).Scan(&prior)
	if e == nil {
		respond.JSON(w, 200, map[string]any{"allocatedCents": prior, "alreadyAllocated": true})
		return
	}
	if !errors.Is(e, pgx.ErrNoRows) {
		fail(w, e)
		return
	}
	var morning int64
	var cycleStart string
	e = tx.QueryRow(r.Context(), `select morning_cents,cycle_start::text from money_daily_snapshots where user_id=$1 and date=$2`, user, yesterday).Scan(&morning, &cycleStart)
	if e != nil {
		fail(w, e)
		return
	}
	if cycleStart != current.Result.Inputs.Cycle.Start {
		respond.Error(w, 409, "cycle_closed", "The previous income cycle is closed.")
		return
	}
	_, spent := Spending(current.Ledger, cycleStart, yesterday)
	amount := min(max(0, morning-spent), max(0, current.Result.FlexibleBalanceCents-current.Result.Inputs.SpentTodayCents))
	if amount <= 0 {
		respond.Error(w, 409, "no_underspend", "There is no unallocated underspend available.")
		return
	}
	tag, e := tx.Exec(r.Context(), `update goals set already_saved_cents=already_saved_cents+$3 where id::text=$1 and user_id=$2 and archived_at is null`, req.GoalID, user, amount)
	if e != nil {
		fail(w, e)
		return
	}
	if tag.RowsAffected() != 1 {
		respond.Error(w, 404, "goal_not_found", "Goal not found.")
		return
	}
	_, e = tx.Exec(r.Context(), `insert into money_goal_allocations(user_id,date,goal_id,amount_cents) values($1,$2,$3,$4)`, user, yesterday, req.GoalID, amount)
	if e != nil {
		fail(w, e)
		return
	}
	_, e = tx.Exec(r.Context(), `insert into goal_contributions(goal_id,user_id,amount_cents,source) values($1,$2,$3,'system')`, req.GoalID, user, amount)
	if e != nil {
		fail(w, e)
		return
	}
	_, e = tx.Exec(r.Context(), `insert into money_events(user_id,kind,local_date,detail) values($1,'goal_allocation',$2,$3::jsonb)`, user, current.Result.Inputs.Date, marshal(map[string]any{"amountCents": amount, "fromDate": yesterday}))
	if e != nil {
		fail(w, e)
		return
	}
	if e = tx.Commit(r.Context()); e != nil {
		fail(w, e)
		return
	}
	respond.JSON(w, 200, map[string]any{"allocatedCents": amount, "alreadyAllocated": false})
}

// Package money implements the beta's deterministic, integer-cent ledger.
// Dates are local calendar dates. Results retain deficits even when the display is zero.
package money

import (
	"errors"
	"sort"
	"strings"
	"time"
)

const Version = "safe-to-spend-v1"
const maxCents int64 = 100_000_000_00

type IncomeSource struct {
	ID                   string  `json:"id"`
	AmountCents          int64   `json:"amountCents"`
	PeriodDays           int     `json:"periodDays"` // weekly=7, biweekly=14; monthly uses Monthly=true.
	Monthly              bool    `json:"monthly"`
	NextArrival          string  `json:"nextArrival"`
	LastThreeMonthsCents []int64 `json:"lastThreeMonthsCents,omitempty"`
}
type Bill struct {
	Name         string   `json:"name"`
	MonthlyCents int64    `json:"monthlyCents"`
	Merchants    []string `json:"merchants,omitempty"`
}
type Profile struct {
	Timezone         string         `json:"timezone"`
	StartDate        string         `json:"startDate"`
	Sources          []IncomeSource `json:"sources"`
	Bills            []Bill         `json:"bills"`
	GoalMonthlyCents int64          `json:"goalMonthlyCents"`
}
type Cycle struct {
	Start            string `json:"start"`
	End              string `json:"end"`
	Days             int    `json:"days"`
	IncomeCents      int64  `json:"incomeCents"`
	BillsCents       int64  `json:"billsCents"`
	PlannedGoalCents int64  `json:"plannedGoalCents"`
}
type Transaction struct {
	ID             string `json:"id"`
	Date           string `json:"date"`
	AmountCents    int64  `json:"amountCents"` // positive purchase; negative refund/reimbursement
	Merchant       string `json:"merchant"`
	AccountType    string `json:"accountType"`
	AccountSubtype string `json:"accountSubtype"`
	Currency       string `json:"currency"`
	Kind           string `json:"kind"` // purchase, refund, reimbursement, income, own_transfer, card_payment, savings, meal_plan, bill
	Manual         bool   `json:"manual"`
	Cash           bool   `json:"cash"`
	Pending        bool   `json:"pending"`
	PendingID      string `json:"pendingId,omitempty"`
}
type Ledger struct {
	Transactions     []Transaction `json:"transactions"`
	MatchedManualIDs []string      `json:"matchedManualIds"`
	ExcludedIDs      []string      `json:"excludedIds"`
}
type Inputs struct {
	Cycle                 Cycle  `json:"cycle"`
	Date                  string `json:"date"`
	SpentBeforeTodayCents int64  `json:"spentBeforeTodayCents"`
	SpentTodayCents       int64  `json:"spentTodayCents"`
	AllocatedGoalCents    int64  `json:"allocatedGoalCents"`
	// Once persisted, the morning baseline never changes during that local day.
	MorningCents *int64 `json:"morningCents,omitempty"`
}
type Result struct {
	Version              string `json:"version"`
	Inputs               Inputs `json:"inputs"`
	DaysLeft             int    `json:"daysLeft"`
	WaitingForIncome     bool   `json:"waitingForIncome"`
	BufferCents          int64  `json:"bufferCents"`
	FlexibleBalanceCents int64  `json:"flexibleBalanceCents"`
	MorningCents         int64  `json:"morningCents"`
	RemainingCents       int64  `json:"remainingCents"`
	DisplayDollars       int64  `json:"displayDollars"`
	OverCents            int64  `json:"overCents"`
}

func date(s string) (time.Time, error) { return time.Parse("2006-01-02", s) }
func DaysBetween(a, b string) (int, error) {
	x, e := date(a)
	if e != nil {
		return 0, e
	}
	y, e := date(b)
	if e != nil {
		return 0, e
	}
	return int(y.Sub(x).Hours() / 24), nil
}
func LocalDate(now time.Time, zone string) (string, error) {
	loc, e := time.LoadLocation(zone)
	if e != nil {
		return "", e
	}
	return now.In(loc).Format("2006-01-02"), nil
}
func ceilDiv(v, d int64) int64 { return (v + d - 1) / d }
func ceilDollar(c int64) int64 { return ceilDiv(c, 100) * 100 }
func validMoney(v int64) bool  { return v >= 0 && v <= maxCents }

// BuildCycle normalizes all source cadences to the same interval, starting at
// signup for the first partial cycle. Historical monthly income is compared to
// declared monthly income, never directly to a paycheck amount.
func BuildCycle(p Profile) (Cycle, error) {
	c := Cycle{Start: p.StartDate}
	if _, err := LocalDate(time.Now(), p.Timezone); err != nil {
		return c, errors.New("valid timezone required")
	}
	if _, err := date(p.StartDate); err != nil {
		return c, err
	}
	if len(p.Sources) == 0 || len(p.Sources) > 20 || len(p.Bills) > 100 {
		return c, errors.New("provide 1-20 income sources and at most 100 bills")
	}
	ids := map[string]bool{}
	for _, s := range p.Sources {
		if s.ID == "" || ids[s.ID] || !validMoney(s.AmountCents) {
			return c, errors.New("invalid income source")
		}
		ids[s.ID] = true
		d, e := DaysBetween(p.StartDate, s.NextArrival)
		if e != nil || d < 1 || d > 366 {
			return c, errors.New("next arrival must follow the cycle start within one year")
		}
		if c.End == "" || s.NextArrival < c.End {
			c.End = s.NextArrival
		}
	}
	c.Days, _ = DaysBetween(c.Start, c.End)
	for _, s := range p.Sources {
		// Rates represented as cents per tenth of a day: monthly = 304 tenths.
		period := int64(s.PeriodDays) * 10
		if s.Monthly {
			period = 304
		}
		if period < 10 || period > 3660 {
			return c, errors.New("invalid income cadence")
		}
		amount := s.AmountCents
		numerator := amount
		denominator := period
		if len(s.LastThreeMonthsCents) != 0 && len(s.LastThreeMonthsCents) != 3 {
			return c, errors.New("historical income needs three complete months")
		}
		if len(s.LastThreeMonthsCents) == 3 {
			low := s.LastThreeMonthsCents[0]
			for _, v := range s.LastThreeMonthsCents {
				if !validMoney(v) {
					return c, errors.New("invalid historical income")
				}
				if v < low {
					low = v
				}
			}
			if low*period < amount*304 {
				numerator = low
				denominator = 304
			}
		}
		c.IncomeCents += numerator * int64(c.Days) * 10 / denominator
	}
	for _, b := range p.Bills {
		if strings.TrimSpace(b.Name) == "" || !validMoney(b.MonthlyCents) {
			return c, errors.New("invalid bill")
		}
		c.BillsCents += ceilDollar(ceilDiv(b.MonthlyCents*int64(c.Days)*10, 304))
	}
	if !validMoney(p.GoalMonthlyCents) {
		return c, errors.New("invalid planned goal")
	}
	c.PlannedGoalCents = ceilDollar(ceilDiv(p.GoalMonthlyCents*int64(c.Days)*10, 304))
	if c.IncomeCents > maxCents || c.BillsCents > maxCents {
		return c, errors.New("cycle amount too large")
	}
	return c, nil
}

func Calculate(in Inputs) (Result, error) {
	r := Result{Version: Version, Inputs: in}
	if _, err := date(in.Date); err != nil {
		return r, err
	}
	duration, err := DaysBetween(in.Cycle.Start, in.Cycle.End)
	if err != nil || duration < 1 || duration > 366 || in.Date < in.Cycle.Start {
		return r, errors.New("invalid cycle")
	}
	if !validMoney(in.Cycle.IncomeCents) || !validMoney(in.Cycle.BillsCents) || !validMoney(in.Cycle.PlannedGoalCents) || !validMoney(in.AllocatedGoalCents) || !validMoney(in.SpentBeforeTodayCents) || in.SpentTodayCents < -in.SpentBeforeTodayCents || in.SpentTodayCents > maxCents {
		return r, errors.New("invalid money inputs")
	}
	r.DaysLeft, _ = DaysBetween(in.Date, in.Cycle.End)
	if r.DaysLeft <= 0 {
		r.DaysLeft = 1
		r.WaitingForIncome = true
	}
	r.BufferCents = ceilDiv(in.Cycle.IncomeCents, 10)
	r.FlexibleBalanceCents = in.Cycle.IncomeCents - in.Cycle.BillsCents - in.Cycle.PlannedGoalCents - r.BufferCents - in.AllocatedGoalCents - in.SpentBeforeTodayCents
	r.MorningCents = max(0, r.FlexibleBalanceCents/int64(r.DaysLeft)/100*100)
	if in.MorningCents != nil {
		if !validMoney(*in.MorningCents) {
			return r, errors.New("invalid snapshot")
		}
		r.MorningCents = *in.MorningCents
	}
	r.RemainingCents = max(0, r.MorningCents-in.SpentTodayCents)
	// Later goal allocations or corrected historical spending cannot create spendable money.
	r.RemainingCents = min(r.RemainingCents, max(0, r.FlexibleBalanceCents-in.SpentTodayCents))
	r.DisplayDollars = r.RemainingCents / 100
	r.OverCents = max(0, in.SpentTodayCents-r.MorningCents)
	return r, nil
}

// SuggestGoal preserves the $15 daily floor where possible. If income cannot
// support it even with no saving, the suggestion is zero, never invented money.
func SuggestGoal(income, bills int64, days int) int64 {
	if days < 1 || income <= bills {
		return 0
	}
	available := income - bills - ceilDiv(income, 10) - int64(days)*1500
	if available <= 0 {
		return 0
	}
	return min(ceilDollar(ceilDiv(income-bills, 10)), available/100*100)
}

func normalize(s string) string { return strings.Join(strings.Fields(strings.ToLower(s)), " ") }
func included(t Transaction, bills []Bill) bool {
	if t.Currency != "" && t.Currency != "USD" {
		return false
	}
	if !t.Manual && !((t.AccountType == "depository" && t.AccountSubtype == "checking") || (t.AccountType == "credit" && t.AccountSubtype == "credit card")) {
		return false
	}
	switch t.Kind {
	case "income", "own_transfer", "card_payment", "savings", "meal_plan", "bill":
		return false
	}
	for _, b := range bills {
		for _, merchant := range append([]string{b.Name}, b.Merchants...) {
			if normalize(merchant) != "" && normalize(t.Merchant) == normalize(merchant) {
				return false
			}
		}
	}
	if t.AmountCents < 0 {
		return t.Kind == "refund" || t.Kind == "reimbursement"
	}
	return true
}

// Reconcile is deterministic, one-to-one, independent of arrival ordering.
// Manual cash remains cash; only non-cash manual entries are bank-matchable.
func Reconcile(entries []Transaction, bills []Bill) Ledger {
	l := Ledger{Transactions: []Transaction{}, MatchedManualIDs: []string{}, ExcludedIDs: []string{}}
	replaced := map[string]bool{}
	seen := map[string]bool{}
	for _, t := range entries {
		if !t.Pending && t.PendingID != "" {
			replaced[t.PendingID] = true
		}
	}
	sorted := append([]Transaction(nil), entries...)
	sort.Slice(sorted, func(i, j int) bool {
		if sorted[i].Manual != sorted[j].Manual {
			return !sorted[i].Manual
		}
		if sorted[i].Date != sorted[j].Date {
			return sorted[i].Date < sorted[j].Date
		}
		return sorted[i].ID < sorted[j].ID
	})
	bank := []Transaction{}
	manual := []Transaction{}
	for _, t := range sorted {
		if seen[t.ID] {
			continue
		}
		seen[t.ID] = true
		if replaced[t.ID] || !included(t, bills) {
			l.ExcludedIDs = append(l.ExcludedIDs, t.ID)
			continue
		}
		if t.Manual {
			manual = append(manual, t)
		} else {
			bank = append(bank, t)
		}
	}
	used := map[string]bool{}
	for _, m := range manual {
		match := -1
		distance := 3
		if !m.Cash {
			for i, b := range bank {
				d, e := DaysBetween(m.Date, b.Date)
				if d < 0 {
					d = -d
				}
				if e == nil && d <= 2 && d < distance && !used[b.ID] && m.AmountCents == b.AmountCents {
					match = i
					distance = d
				}
			}
		}
		if match >= 0 {
			used[bank[match].ID] = true
			l.MatchedManualIDs = append(l.MatchedManualIDs, m.ID)
		} else {
			l.Transactions = append(l.Transactions, m)
		}
	}
	l.Transactions = append(l.Transactions, bank...)
	sort.Slice(l.Transactions, func(i, j int) bool {
		if l.Transactions[i].Date != l.Transactions[j].Date {
			return l.Transactions[i].Date < l.Transactions[j].Date
		}
		return l.Transactions[i].ID < l.Transactions[j].ID
	})
	return l
}

// Spending keeps total cycle spending non-negative while letting a reimbursement
// received today restore today's allowance by at most earlier cycle spending.
func Spending(l Ledger, start, today string) (before, live int64) {
	var prior, now int64
	for _, t := range l.Transactions {
		if t.Date < start || t.Date > today {
			continue
		}
		if t.Date < today {
			prior += t.AmountCents
		} else {
			now += t.AmountCents
		}
	}
	before = max(0, prior)
	total := max(0, prior+now)
	return before, total - before // live can be negative for a genuine refund.
}

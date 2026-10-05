package money

import (
	"reflect"
	"testing"
	"time"
)

func anchor() Inputs {
	return Inputs{Cycle: Cycle{Start: "2026-10-01", End: "2026-10-15", Days: 14, IncomeCents: 140000, BillsCents: 62000, PlannedGoalCents: 11500}, Date: "2026-10-09", SpentBeforeTodayCents: 29700}
}
func TestAnchorAndFrozenMorning(t *testing.T) {
	in := anchor()
	r, e := Calculate(in)
	if e != nil || r.DisplayDollars != 38 {
		t.Fatalf("%+v %v", r, e)
	}
	in.MorningCents = &r.MorningCents
	in.SpentTodayCents = 1700
	r, e = Calculate(in)
	if e != nil || r.DisplayDollars != 21 || r.MorningCents != 3800 {
		t.Fatalf("live purchase spread across cycle: %+v %v", r, e)
	}
	in.SpentTodayCents = 4700
	r, _ = Calculate(in)
	if r.DisplayDollars != 0 || r.OverCents != 900 {
		t.Fatal(r)
	}
	in.Date = "2026-10-10"
	in.SpentBeforeTodayCents += in.SpentTodayCents
	in.SpentTodayCents = 0
	in.MorningCents = nil
	r, _ = Calculate(in)
	if r.DisplayDollars != 36 {
		t.Fatal(r)
	}
}
func TestRealisticLedgerAnchor(t *testing.T) {
	bank := func(id string, c int64, kind, merchant string) Transaction {
		return Transaction{ID: id, Date: "2026-10-07", AmountCents: c, Kind: kind, Merchant: merchant, AccountType: "depository", AccountSubtype: "checking", Currency: "USD"}
	}
	entries := []Transaction{bank("groceries", 9000, "purchase", "Store"), bank("food", 7500, "purchase", "Cafe"), bank("pending", 14500, "purchase", "Shop"), bank("repayment", -1300, "reimbursement", "Venmo"), bank("rent", 62000, "purchase", "Landlord"), bank("spotify", 1200, "purchase", "Spotify"), bank("card", 9000, "card_payment", "Credit card"), bank("own", 5000, "own_transfer", "Transfer"), bank("save", 10000, "savings", "Savings"), bank("income", -140000, "income", "Payroll")}
	entries[2].Pending = true
	savings := bank("excluded-account", 8000, "purchase", "Store")
	savings.AccountSubtype = "savings"
	entries = append(entries, savings)
	in := anchor()
	l := Reconcile(entries, []Bill{{Name: "Rent", Merchants: []string{"Landlord"}}, {Name: "Spotify"}})
	in.SpentBeforeTodayCents, in.SpentTodayCents = Spending(l, in.Cycle.Start, in.Date)
	r, e := Calculate(in)
	if e != nil || r.DisplayDollars != 38 || in.SpentBeforeTodayCents != 29700 {
		t.Fatalf("%+v %v", r, e)
	}
}
func TestPartialMixedCadenceAndHistory(t *testing.T) {
	p := Profile{Timezone: "America/New_York", StartDate: "2026-10-09", Sources: []IncomeSource{{ID: "job", AmountCents: 140000, PeriodDays: 14, NextArrival: "2026-10-15"}}}
	c, e := BuildCycle(p)
	if e != nil || c.IncomeCents != 60000 || c.Days != 6 {
		t.Fatalf("%+v %v", c, e)
	}
	p.Sources = append(p.Sources, IncomeSource{ID: "parents", AmountCents: 30400, Monthly: true, NextArrival: "2026-11-01"})
	c, e = BuildCycle(p)
	if e != nil || c.IncomeCents != 66000 {
		t.Fatalf("%+v %v", c, e)
	}
	p.Sources[0].LastThreeMonthsCents = []int64{304000, 250000, 290000}
	c, e = BuildCycle(p)
	if e != nil || c.IncomeCents != 55342 {
		t.Fatalf("monthly comparison must normalize paycheck: %+v %v", c, e)
	}
}
func TestRoundingAndInsufficientIncome(t *testing.T) {
	p := Profile{Timezone: "UTC", StartDate: "2026-10-01", Sources: []IncomeSource{{ID: "job", AmountCents: 10000, PeriodDays: 14, NextArrival: "2026-10-15"}}, Bills: []Bill{{Name: "Phone", MonthlyCents: 5000}}, GoalMonthlyCents: 1000}
	c, e := BuildCycle(p)
	if e != nil || c.BillsCents != 2400 || c.PlannedGoalCents != 500 {
		t.Fatalf("%+v %v", c, e)
	}
	if SuggestGoal(10000, 9000, 14) != 0 || SuggestGoal(140000, 62000, 14) != 7800 {
		t.Fatal("goal affordability")
	}
	in := anchor()
	in.SpentBeforeTodayCents = 100000
	r, _ := Calculate(in)
	if r.DisplayDollars != 0 || r.FlexibleBalanceCents >= 0 {
		t.Fatal("deficit was lost", r)
	}
}
func TestMidnightDSTAndMissedPayday(t *testing.T) {
	now, _ := time.Parse(time.RFC3339, "2026-11-01T06:30:00Z")
	d, e := LocalDate(now, "America/Los_Angeles")
	if e != nil || d != "2026-10-31" {
		t.Fatal(d, e)
	}
	days, _ := DaysBetween("2026-10-31", "2026-11-02")
	if days != 2 {
		t.Fatal(days)
	}
	in := anchor()
	in.Date = "2026-10-14"
	r, _ := Calculate(in)
	if r.DaysLeft != 1 || r.WaitingForIncome {
		t.Fatal(r)
	}
	in.Date = "2026-10-15"
	r, _ = Calculate(in)
	if r.DaysLeft != 1 || !r.WaitingForIncome || r.DisplayDollars != 228 {
		t.Fatal(r)
	}
	in.Date = "2026-10-16"
	in.SpentBeforeTodayCents += 2800
	r, _ = Calculate(in)
	if r.DisplayDollars != 200 {
		t.Fatal(r)
	}
	// A confirmed income arrival begins a fresh cycle, including a different source.
	in.Cycle = Cycle{Start: "2026-10-16", End: "2026-10-23", IncomeCents: 70000}
	in.SpentBeforeTodayCents = 0
	r, _ = Calculate(in)
	if r.WaitingForIncome || r.DaysLeft != 7 || r.DisplayDollars != 90 {
		t.Fatal(r)
	}
}
func TestMatchingPendingAndRefundFloor(t *testing.T) {
	bank := Transaction{ID: "posted", PendingID: "pending", Date: "2026-10-03", AmountCents: 1000, AccountType: "credit", AccountSubtype: "credit card"}
	pending := bank
	pending.ID = "pending"
	pending.PendingID = ""
	pending.Pending = true
	m := Transaction{ID: "manual1", Manual: true, Date: "2026-10-01", AmountCents: 1000}
	m2 := m
	m2.ID = "manual2"
	cash := m
	cash.ID = "cash"
	cash.Cash = true
	entries := []Transaction{m2, pending, cash, m, bank}
	l := Reconcile(entries, nil)
	if len(l.MatchedManualIDs) != 1 || l.MatchedManualIDs[0] != "manual1" || len(l.Transactions) != 3 {
		t.Fatalf("%+v", l)
	}
	reverse := []Transaction{bank, m, cash, pending, m2}
	if !reflect.DeepEqual(l, Reconcile(reverse, nil)) {
		t.Fatal("order changed reconciliation")
	}
	refund := bank
	refund.ID = "refund"
	refund.PendingID = ""
	refund.AmountCents = -10000
	refund.Kind = "refund"
	entries = append(entries, refund)
	l = Reconcile(entries, nil)
	before, today := Spending(l, "2026-10-01", "2026-10-03")
	if before+today != 0 {
		t.Fatal(before, today)
	}
	in := anchor()
	in.SpentBeforeTodayCents = before
	in.SpentTodayCents = today
	if _, e := Calculate(in); e != nil {
		t.Fatal(e)
	}
}
func TestValidation(t *testing.T) {
	in := anchor()
	in.Cycle.End = in.Cycle.Start
	if _, e := Calculate(in); e == nil {
		t.Fatal("zero length cycle accepted")
	}
	in = anchor()
	in.Cycle.IncomeCents = -1
	if _, e := Calculate(in); e == nil {
		t.Fatal("negative income")
	}
}

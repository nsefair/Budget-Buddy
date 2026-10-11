package money

import "testing"

func TestDayResultUsesThatDaysSpendingOnly(t *testing.T) {
	l := Ledger{Transactions: []Transaction{
		{ID: "a", Date: "2026-10-07", AmountCents: 5_000},
		{ID: "b", Date: "2026-10-08", AmountCents: 2_400},
		{ID: "c", Date: "2026-10-08", AmountCents: -400}, // refund the same day
		{ID: "d", Date: "2026-10-09", AmountCents: 9_900},
	}}
	under := DayResultFor(l, "2026-10-01", "2026-10-08", 3_800)
	if under.SpentCents != 2_000 || under.Status != "under" || under.Date != "2026-10-08" {
		t.Fatal(under)
	}
	if over := DayResultFor(l, "2026-10-01", "2026-10-07", 3_800); over.SpentCents != 5_000 || over.Status != "over" {
		t.Fatal(over)
	}
	if even := DayResultFor(l, "2026-10-01", "2026-10-08", 2_000); even.Status != "even" {
		t.Fatal(even)
	}
	// A day with only a refund is under, never negative money to move.
	refundOnly := DayResultFor(Ledger{Transactions: []Transaction{{ID: "r", Date: "2026-10-08", AmountCents: -700}}}, "2026-10-01", "2026-10-08", 3_800)
	if refundOnly.Status != "under" || MovableCents(refundOnly, Result{FlexibleBalanceCents: 1_000_000}) != 3_800 {
		t.Fatal(refundOnly)
	}
}

func TestMovableCentsNeverExceedsFlexibleMoneyLeft(t *testing.T) {
	day := DayResult{MorningCents: 3_800, SpentCents: 2_400, Status: "under"}
	if got := MovableCents(day, Result{FlexibleBalanceCents: 50_000, Inputs: Inputs{SpentTodayCents: 1_000}}); got != 1_400 {
		t.Fatal(got)
	}
	// Today's spending already used most of the flexible money: move only what is left.
	if got := MovableCents(day, Result{FlexibleBalanceCents: 2_000, Inputs: Inputs{SpentTodayCents: 1_500}}); got != 500 {
		t.Fatal(got)
	}
	over := DayResult{MorningCents: 3_800, SpentCents: 4_500, Status: "over"}
	if got := MovableCents(over, Result{FlexibleBalanceCents: 50_000}); got != 0 {
		t.Fatal(got)
	}
	if got := MovableCents(day, Result{FlexibleBalanceCents: 1_000, Inputs: Inputs{SpentTodayCents: 3_000}}); got != 0 {
		t.Fatal(got)
	}
}

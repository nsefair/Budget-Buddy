package money

// DayResult compares one finished local day's spending with that morning's
// fixed number. Today's screen shows yesterday's result and the last seven
// days from these, so the copy never estimates: every figure is stored.
type DayResult struct {
	Date         string `json:"date"`
	MorningCents int64  `json:"morningCents"`
	SpentCents   int64  `json:"spentCents"`
	Status       string `json:"status"` // "under", "even", or "over"
}

// Yesterday adds what move-to-goal can set aside now, and what already was.
type Yesterday struct {
	DayResult
	MovableCents   int64  `json:"movableCents"`
	AllocatedCents int64  `json:"allocatedCents"`
	GoalID         string `json:"goalId,omitempty"`
}

// DayResultFor uses the same Spending rule as today's number and as
// move-to-goal, so a day's result always agrees with the amount it can move.
func DayResultFor(l Ledger, cycleStart, day string, morningCents int64) DayResult {
	_, spent := Spending(l, cycleStart, day)
	status := "even"
	if spent < morningCents {
		status = "under"
	} else if spent > morningCents {
		status = "over"
	}
	return DayResult{Date: day, MorningCents: morningCents, SpentCents: spent, Status: status}
}

// MovableCents is a finished day's underspend, never more than the flexible
// money left after today's spending: a set-aside cannot create money.
func MovableCents(day DayResult, current Result) int64 {
	return min(max(0, day.MorningCents-day.SpentCents), max(0, current.FlexibleBalanceCents-current.Inputs.SpentTodayCents))
}

package goals

import (
	"testing"
	"time"
)

func TestProjectedCompletionDateUsesTrailingThirtyDayPace(t *testing.T) {
	now := time.Date(2026, 6, 13, 12, 0, 0, 0, time.UTC)
	projected := projectedCompletionDate(now, 100000, 40000, 30000)
	if projected == nil {
		t.Fatal("expected a projected completion date")
	}
	want := now.AddDate(0, 0, 60).Format(time.RFC3339)
	if *projected != want {
		t.Fatalf("projected date = %q, want %q", *projected, want)
	}
}

func TestProjectedCompletionDateNeedsRecentPace(t *testing.T) {
	if projected := projectedCompletionDate(time.Now(), 100000, 40000, 0); projected != nil {
		t.Fatalf("projected date = %q, want nil", *projected)
	}
}

func TestSavingsTransferCandidate(t *testing.T) {
	candidate := plaidContributionCandidate{
		AccountID:   "account-id",
		AmountCents: -12500,
		Primary:     "TRANSFER_IN",
		Detailed:    "TRANSFER_IN_ACCOUNT_TRANSFER",
		AccountType: "depository",
		Subtype:     "savings",
	}
	if !candidate.isSavingsTransferIn() {
		t.Fatal("expected linked savings transfer to qualify")
	}

	candidate.Pending = true
	if candidate.isSavingsTransferIn() {
		t.Fatal("expected pending transfer to be ignored")
	}
}

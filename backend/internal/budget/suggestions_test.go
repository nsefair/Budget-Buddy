package budget

import "testing"

func TestAllocateRecommendationsMatchesFiftyThirtyBuckets(t *testing.T) {
	averages := map[string]int64{
		"housing":       120000,
		"food":          40000,
		"transport":     20000,
		"health":        10000,
		"education":     10000,
		"shopping":      20000,
		"entertainment": 10000,
		"personal":      5000,
	}

	result := allocateRecommendations(averages, 200000, 120000)
	var needsTotal, wantsTotal int64
	for categoryID, amounts := range result {
		if budgetBucket(categoryID) == "needs" {
			needsTotal += amounts.SuggestedCents
		} else {
			wantsTotal += amounts.SuggestedCents
		}
	}

	if needsTotal != 200000 {
		t.Fatalf("needs total = %d, want 200000", needsTotal)
	}
	if wantsTotal != 120000 {
		t.Fatalf("wants total = %d, want 120000", wantsTotal)
	}
	if result["housing"].SuggestedCents <= result["food"].SuggestedCents {
		t.Fatal("expected historical category proportions to influence suggestions")
	}
}

func TestDetectedIncomeExcludesTransfers(t *testing.T) {
	if !isDetectedIncome(-250000, "INCOME", "INCOME_WAGES", nil) {
		t.Fatal("expected paycheck to be detected as income")
	}
	if isDetectedIncome(-250000, "TRANSFER_IN", "TRANSFER_IN_ACCOUNT_TRANSFER", nil) {
		t.Fatal("expected account transfer to be excluded from income")
	}
}

package budget

import "testing"

func TestBankCategories(t *testing.T) {
	for _, tt := range []struct {
		primary, detailed string
		legacy            []string
		want              string
	}{
		{"FOOD_AND_DRINK", "FOOD_AND_DRINK_GROCERIES", nil, "food"},
		{"GENERAL_SERVICES", "GENERAL_SERVICES_EDUCATION", nil, "education"},
		{"GENERAL_SERVICES", "GENERAL_SERVICES_AUTOMOTIVE", nil, "transport"},
		{"TRANSFER_OUT", "TRANSFER_OUT_OTHER_TRANSFER_OUT", nil, "uncategorized"},
		{"BANK_FEES", "", nil, "uncategorized"},
		{"OTHER", "", nil, "uncategorized"},
		{"", "", []string{"Shops"}, "shopping"},
		{"", "", nil, "uncategorized"},
	} {
		if got := categoryForTransaction(tt.primary, tt.detailed, tt.legacy); got != tt.want {
			t.Errorf("%+v: got %s", tt, got)
		}
	}
}

func TestPayrollAndAmbiguousTransfers(t *testing.T) {
	if !isDetectedIncome(-250000, "TRANSFER_IN", "", []string{"Transfer", "Payroll"}) {
		t.Fatal("legacy payroll disappeared")
	}
	if isDetectedIncome(-250000, "TRANSFER_IN", "TRANSFER_IN_ACCOUNT_TRANSFER", []string{"Payroll"}) {
		t.Fatal("internal transfer counted as payroll")
	}
	if isDetectedIncome(-250000, "TRANSFER_IN", "TRANSFER_IN_OTHER_TRANSFER_IN", nil) {
		t.Fatal("ambiguous incoming transfer counted as income")
	}
	if isTransferCategory("TRANSFER_OUT", "TRANSFER_OUT_OTHER_TRANSFER_OUT", nil) {
		t.Fatal("ambiguous outgoing payment hidden from spending")
	}
}

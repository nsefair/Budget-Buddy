package budget

import "strings"

type CategoryDef struct {
	ID          string
	Name        string
	Icon        string
	BudgetLimit float64
	Color       string
}

var defaultCategories = []CategoryDef{
	{ID: "food", Name: "Food & Drink", Icon: "receipt", BudgetLimit: 400, Color: "#F59E0B"},
	{ID: "transport", Name: "Transportation", Icon: "activity", BudgetLimit: 200, Color: "#6366F1"},
	{ID: "shopping", Name: "Shopping", Icon: "wallet", BudgetLimit: 250, Color: "#EF4444"},
	{ID: "housing", Name: "Housing", Icon: "home", BudgetLimit: 1200, Color: "#1B2B4B"},
	{ID: "entertainment", Name: "Entertainment", Icon: "star", BudgetLimit: 100, Color: "#8B5CF6"},
	{ID: "health", Name: "Health & Wellness", Icon: "shield", BudgetLimit: 80, Color: "#10B981"},
	{ID: "personal", Name: "Personal Care", Icon: "user", BudgetLimit: 60, Color: "#13D845"},
	{ID: "education", Name: "Education", Icon: "layers", BudgetLimit: 50, Color: "#00B4A6"},
	{ID: "uncategorized", Name: "Uncategorized", Icon: "receipt", BudgetLimit: 0, Color: "#8B9CB8"},
}

var pfcToCategory = map[string]string{
	"FOOD_AND_DRINK":            "food",
	"TRANSPORTATION":            "transport",
	"GENERAL_MERCHANDISE":       "shopping",
	"HOME_IMPROVEMENT":          "housing",
	"RENT_AND_UTILITIES":        "housing",
	"ENTERTAINMENT":             "entertainment",
	"MEDICAL":                   "health",
	"PERSONAL_CARE":             "personal",
	"EDUCATION":                 "education",
	"GOVERNMENT_AND_NON_PROFIT": "uncategorized",
	"LOAN_PAYMENTS":             "uncategorized",
	"BANK_FEES":                 "uncategorized",
	"TRAVEL":                    "transport",
	"GAS_STATIONS":              "transport",
	"GROCERIES":                 "food",
	"TRANSFER_OUT":              "uncategorized",
	"TRANSFER_IN":               "uncategorized",
	"INCOME":                    "uncategorized",
	"OTHER":                     "uncategorized",
}

func categoryForTransaction(pfcPrimary, pfcDetailed string, legacyCategory []string) string {
	switch strings.ToUpper(strings.TrimSpace(pfcDetailed)) {
	case "GENERAL_SERVICES_EDUCATION":
		return "education"
	case "GENERAL_SERVICES_AUTOMOTIVE":
		return "transport"
	}
	primary := strings.ToUpper(strings.TrimSpace(pfcPrimary))
	if mapped, ok := pfcToCategory[primary]; ok {
		return mapped
	}
	if len(legacyCategory) > 0 {
		legacy := strings.ToLower(legacyCategory[0])
		switch {
		case strings.Contains(legacy, "food"):
			return "food"
		case strings.Contains(legacy, "travel") || strings.Contains(legacy, "transport"):
			return "transport"
		case strings.Contains(legacy, "shop"):
			return "shopping"
		case strings.Contains(legacy, "rent") || strings.Contains(legacy, "utilit"):
			return "housing"
		case strings.Contains(legacy, "entertain"):
			return "entertainment"
		case strings.Contains(legacy, "health") || strings.Contains(legacy, "medical"):
			return "health"
		case strings.Contains(legacy, "education"):
			return "education"
		}
	}
	return "uncategorized"
}

func categoryNameByID(id string) string {
	if id == "income" {
		return "Income"
	}
	for _, category := range defaultCategories {
		if category.ID == id {
			return category.Name
		}
	}
	return "Uncategorized"
}

func categoryMetaByID(id string) CategoryDef {
	for _, category := range defaultCategories {
		if category.ID == id {
			return category
		}
	}
	return CategoryDef{ID: id, Name: "Uncategorized", Icon: "wallet", BudgetLimit: 100, Color: "#8B9CB8"}
}

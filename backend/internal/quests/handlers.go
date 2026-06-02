package quests

import (
	"net/http"
	"strings"

	"budget-buddy/backend/internal/respond"
)

type FirstQuest struct {
	ID            string `json:"id"`
	Name          string `json:"name"`
	WhyItMatters  string `json:"whyItMatters"`
	XPReward      int    `json:"xpReward"`
	DurationLabel string `json:"durationLabel"`
	GoalKind      string `json:"goalKind"`
}

func RegisterRoutes(mux *http.ServeMux, basePath string) {
	mux.HandleFunc("GET "+basePath+"/quests/active", activeQuest)
}

func activeQuest(w http.ResponseWriter, r *http.Request) {
	goalKind := normalizeGoalKind(r.URL.Query().Get("goalKind"))
	respond.JSON(w, http.StatusOK, firstQuestByGoal[goalKind])
}

func normalizeGoalKind(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "emergency_fund", "debt_payoff", "stop_overspending", "savings_target", "invest", "income_growth":
		return strings.ToLower(strings.TrimSpace(value))
	default:
		return "custom"
	}
}

var firstQuestByGoal = map[string]FirstQuest{
	"emergency_fund": {
		ID:            "q_first_emergency",
		Name:          "Move $25 to savings this week",
		WhyItMatters:  "$25 is small enough to feel doable and big enough to start a habit.",
		XPReward:      80,
		DurationLabel: "this week",
		GoalKind:      "emergency_fund",
	},
	"debt_payoff": {
		ID:            "q_first_debt",
		Name:          "Make one extra $20 payment this week",
		WhyItMatters:  "One extra payment creates visible momentum without wrecking your week.",
		XPReward:      80,
		DurationLabel: "this week",
		GoalKind:      "debt_payoff",
	},
	"stop_overspending": {
		ID:            "q_first_awareness",
		Name:          "Log every coffee + takeout for 7 days",
		WhyItMatters:  "Awareness comes before discipline. Once you see the pattern, the change gets easier.",
		XPReward:      75,
		DurationLabel: "next 7 days",
		GoalKind:      "stop_overspending",
	},
	"savings_target": {
		ID:            "q_first_save",
		Name:          "Set up one auto-transfer to your goal",
		WhyItMatters:  "Automating one transfer means the goal grows even on the days you forget.",
		XPReward:      100,
		DurationLabel: "this week",
		GoalKind:      "savings_target",
	},
	"invest": {
		ID:            "q_first_invest",
		Name:          "Open or fund an investment account this week",
		WhyItMatters:  "Compound growth needs years, not drama. The first dollar matters because it starts the clock.",
		XPReward:      120,
		DurationLabel: "this week",
		GoalKind:      "invest",
	},
	"income_growth": {
		ID:            "q_first_income",
		Name:          "Track all income sources for the next 7 days",
		WhyItMatters:  "Knowing the real number is the first step to growing it.",
		XPReward:      70,
		DurationLabel: "next 7 days",
		GoalKind:      "income_growth",
	},
	"custom": {
		ID:            "q_first_custom",
		Name:          "Write a 1-line plan for your goal",
		WhyItMatters:  "A goal without a first move stays a wish. One sentence is enough to begin.",
		XPReward:      60,
		DurationLabel: "this week",
		GoalKind:      "custom",
	},
}

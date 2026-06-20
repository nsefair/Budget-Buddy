package quests

import "math"

const (
	minimumFinancialScore = 300
	maximumFinancialScore = 850
)

func calculateFinancialScore(components ScoreComponents) int {
	weighted := clampPercent(components.Quests)*0.30 +
		clampPercent(components.Budgeting)*0.20 +
		clampPercent(components.Saving)*0.20 +
		clampPercent(components.Goals)*0.20 +
		clampPercent(components.Consistency)*0.10

	return clampScore(int(math.Round(minimumFinancialScore + weighted*5.5)))
}

func clampPercent(value float64) float64 {
	return math.Max(0, math.Min(100, value))
}

func clampScore(value int) int {
	if value < minimumFinancialScore {
		return minimumFinancialScore
	}
	if value > maximumFinancialScore {
		return maximumFinancialScore
	}
	return value
}

func scoreBand(score int) string {
	switch {
	case score >= 780:
		return "Exceptional"
	case score >= 700:
		return "Thriving"
	case score >= 600:
		return "Strong"
	case score >= 500:
		return "Steady"
	default:
		return "Foundation"
	}
}

func leagueTier(score int) string {
	switch {
	case score >= 770:
		return "Champion"
	case score >= 690:
		return "Diamond"
	case score >= 610:
		return "Platinum"
	case score >= 530:
		return "Gold"
	case score >= 450:
		return "Silver"
	default:
		return "Bronze"
	}
}

func nextLeague(score int) (name string, points int) {
	thresholds := []struct {
		name  string
		score int
	}{
		{"Silver", 450},
		{"Gold", 530},
		{"Platinum", 610},
		{"Diamond", 690},
		{"Champion", 770},
	}
	for _, threshold := range thresholds {
		if score < threshold.score {
			return threshold.name, threshold.score - score
		}
	}
	return "", 0
}

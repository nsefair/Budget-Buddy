package quests

import "math"

const (
	minimumFinancialScore = 1
	initialFinancialScore = 280
	maximumFinancialScore = 500
)

// scoreMultiplier maps the 0–100 weighted component blend onto the 1–500 range.
const scoreMultiplier = 4.99

func calculateFinancialScore(components ScoreComponents) int {
	weighted := clampPercent(components.Quests)*0.30 +
		clampPercent(components.Budgeting)*0.20 +
		clampPercent(components.Saving)*0.20 +
		clampPercent(components.Goals)*0.20 +
		clampPercent(components.Consistency)*0.10

	return clampScore(int(math.Round(minimumFinancialScore + weighted*scoreMultiplier)))
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
	case score >= 435:
		return "Exceptional"
	case score >= 360:
		return "Thriving"
	case score >= 270:
		return "Strong"
	case score >= 180:
		return "Steady"
	default:
		return "Foundation"
	}
}

func leagueTier(score int) string {
	switch {
	case score >= 425:
		return "Champion"
	case score >= 355:
		return "Diamond"
	case score >= 280:
		return "Platinum"
	case score >= 210:
		return "Gold"
	case score >= 135:
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
		{"Silver", 135},
		{"Gold", 210},
		{"Platinum", 280},
		{"Diamond", 355},
		{"Champion", 425},
	}
	for _, threshold := range thresholds {
		if score < threshold.score {
			return threshold.name, threshold.score - score
		}
	}
	return "", 0
}

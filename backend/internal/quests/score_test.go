package quests

import (
	"strings"
	"testing"
)

func TestCalculateFinancialScore(t *testing.T) {
	cases := []struct {
		name       string
		components ScoreComponents
		want       int
	}{
		{name: "floor", components: ScoreComponents{}, want: 300},
		{name: "midpoint", components: ScoreComponents{50, 50, 50, 50, 50}, want: 575},
		{name: "ceiling", components: ScoreComponents{100, 100, 100, 100, 100}, want: 850},
		{name: "clamps inputs", components: ScoreComponents{120, -20, 100, 100, 100}, want: 740},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := calculateFinancialScore(tc.components); got != tc.want {
				t.Fatalf("calculateFinancialScore() = %d, want %d", got, tc.want)
			}
		})
	}
}

func TestLeagueBoundaries(t *testing.T) {
	cases := map[int]string{
		300: "Bronze",
		450: "Silver",
		530: "Gold",
		610: "Platinum",
		690: "Diamond",
		770: "Champion",
		850: "Champion",
	}
	for score, want := range cases {
		if got := leagueTier(score); got != want {
			t.Fatalf("leagueTier(%d) = %q, want %q", score, got, want)
		}
	}
}

func TestNextLeague(t *testing.T) {
	name, points := nextLeague(620)
	if name != "Diamond" || points != 70 {
		t.Fatalf("nextLeague(620) = %q, %d", name, points)
	}
	name, points = nextLeague(800)
	if name != "" || points != 0 {
		t.Fatalf("nextLeague(800) = %q, %d", name, points)
	}
}

func TestPersonalizedWhyUsesAccountFacts(t *testing.T) {
	why := personalizedWhy("goals", personalizationFacts{
		GoalName:           "Emergency Fund",
		GoalRemainingCents: 125000,
	})
	if !strings.Contains(why, "Emergency Fund") || !strings.Contains(why, "$1250") {
		t.Fatalf("personalizedWhy() = %q", why)
	}
}

func TestPublicNameSupportsUnicode(t *testing.T) {
	if got := publicName("Ana", "Éclair"); got != "Ana É." {
		t.Fatalf("publicName() = %q", got)
	}
}

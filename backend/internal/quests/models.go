package quests

import "time"

type FirstQuest struct {
	ID            string `json:"id"`
	Name          string `json:"name"`
	WhyItMatters  string `json:"whyItMatters"`
	XPReward      int    `json:"xpReward"`
	DurationLabel string `json:"durationLabel"`
	GoalKind      string `json:"goalKind"`
}

type WeeklyQuest struct {
	ID                      string `json:"id"`
	TemplateID              string `json:"templateId"`
	Type                    string `json:"type"`
	Category                string `json:"category"`
	Title                   string `json:"title"`
	WhyItMatters            string `json:"whyItMatters"`
	Instructions            string `json:"instructions"`
	CheckInLabel            string `json:"checkInLabel"`
	IconName                string `json:"iconName"`
	VerificationType        string `json:"verificationType"`
	VerificationDescription string `json:"verificationDescription"`
	XPReward                int    `json:"xpReward"`
	ScoreImpact             int    `json:"scoreImpact"`
	Progress                int    `json:"progress"`
	Total                   int    `json:"total"`
	Unit                    string `json:"unit"`
	Deadline                string `json:"deadline"`
	Status                  string `json:"status"`
	CheckedInToday          bool   `json:"checkedInToday"`
	CompletedAt             string `json:"completedAt,omitempty"`
}

type ScoreComponents struct {
	Quests      float64 `json:"quests"`
	Budgeting   float64 `json:"budgeting"`
	Saving      float64 `json:"saving"`
	Goals       float64 `json:"goals"`
	Consistency float64 `json:"consistency"`
}

type FinancialScore struct {
	Value            int             `json:"value"`
	PreviousValue    int             `json:"previousValue"`
	Change           int             `json:"change"`
	Band             string          `json:"band"`
	LeagueTier       string          `json:"leagueTier"`
	NextLeagueTier   string          `json:"nextLeagueTier,omitempty"`
	PointsToNextTier int             `json:"pointsToNextTier"`
	Components       ScoreComponents `json:"components"`
	UpdatedAt        string          `json:"updatedAt"`
}

type LeagueUser struct {
	ID             string `json:"id"`
	Name           string `json:"name"`
	Level          int    `json:"level"`
	XP             int    `json:"xp"`
	Streak         int    `json:"streak"`
	FinancialScore int    `json:"financialScore"`
	Rank           int    `json:"rank"`
	IsCurrentUser  bool   `json:"isCurrentUser,omitempty"`
}

type League struct {
	Tier            string       `json:"tier"`
	ResetDate       string       `json:"resetDate"`
	Users           []LeagueUser `json:"users"`
	CurrentUserRank int          `json:"currentUserRank"`
}

type Dashboard struct {
	WeekStart string         `json:"weekStart"`
	ResetDate string         `json:"resetDate"`
	Quests    []WeeklyQuest  `json:"quests"`
	Score     FinancialScore `json:"score"`
	League    League         `json:"league"`
}

type CheckInResult struct {
	Quest            WeeklyQuest    `json:"quest"`
	Score            FinancialScore `json:"score"`
	XPEarned         int            `json:"xpEarned"`
	TotalXP          int            `json:"totalXp"`
	AlreadyCheckedIn bool           `json:"alreadyCheckedIn"`
}

type questTemplate struct {
	ID                      string
	Category                string
	Title                   string
	Instructions            string
	CheckInLabel            string
	IconName                string
	VerificationType        string
	VerificationDescription string
	TargetValue             int
	Unit                    string
	XPReward                int
	ScoreImpact             int
}

type personalizationFacts struct {
	Score                  int
	Streak                 int
	GoalName               string
	GoalRemainingCents     int64
	RecentTransactionCount int
	DiningSpendCents       int64
}

type weeklyWindow struct {
	Start     time.Time
	Reset     time.Time
	StartDate string
	Timezone  string
}

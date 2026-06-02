package auth

import "time"

type User struct {
	ID                   string
	Email                string
	FirstName            string
	LastName             string
	Avatar               string
	Level                int
	XP                   int
	XPToNextLevel        int
	Streak               int
	StreakBestEver       int
	NetWorthCents        int64
	FinancialHealthScore int
	SubscriptionTier     string
	OnboardingComplete   bool
	Why                  string
	WhyIcon              string
	JoinedAt             time.Time
}

type APIUser struct {
	ID                   string  `json:"id"`
	FirstName            string  `json:"firstName"`
	LastName             string  `json:"lastName"`
	Email                string  `json:"email"`
	Avatar               string  `json:"avatar,omitempty"`
	Level                int     `json:"level"`
	XP                   int     `json:"xp"`
	XPToNextLevel        int     `json:"xpToNextLevel"`
	Streak               int     `json:"streak"`
	StreakBestEver       int     `json:"streakBestEver"`
	NetWorth             float64 `json:"netWorth"`
	FinancialHealthScore int     `json:"financialHealthScore"`
	SubscriptionTier     string  `json:"subscriptionTier"`
	OnboardingComplete   bool    `json:"onboardingComplete"`
	Why                  string  `json:"why"`
	WhyIcon              string  `json:"whyIcon"`
	JoinedAt             string  `json:"joinedAt"`
}

func (u User) API() APIUser {
	return APIUser{
		ID:                   u.ID,
		FirstName:            u.FirstName,
		LastName:             u.LastName,
		Email:                u.Email,
		Avatar:               u.Avatar,
		Level:                u.Level,
		XP:                   u.XP,
		XPToNextLevel:        u.XPToNextLevel,
		Streak:               u.Streak,
		StreakBestEver:       u.StreakBestEver,
		NetWorth:             float64(u.NetWorthCents) / 100,
		FinancialHealthScore: u.FinancialHealthScore,
		SubscriptionTier:     u.SubscriptionTier,
		OnboardingComplete:   u.OnboardingComplete,
		Why:                  u.Why,
		WhyIcon:              u.WhyIcon,
		JoinedAt:             u.JoinedAt.Format(time.RFC3339),
	}
}

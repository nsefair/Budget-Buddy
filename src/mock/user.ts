import { User } from "@/stores/authStore";

export const MOCK_USER: User = {
  id: "usr_01HZ9FAKE",
  firstName: "Marcus",
  lastName: "Rivera",
  email: "marcus@example.com",
  avatar: undefined,
  level: 7,
  xp: 3240,
  xpToNextLevel: 4000,
  streak: 14,
  streakBestEver: 21,
  netWorth: 8420,
  financialHealthScore: 74,
  subscriptionTier: "premium",
  onboardingComplete: true,
  why: "I want to retire my mom before she turns 60. She sacrificed everything.",
  whyEmoji: "❤️",
  joinedAt: "2025-11-01T00:00:00Z",
};

export const MOCK_TOKEN = "mock_access_token_dev_only";

/**
 * Mock auth user — used while EXPO_PUBLIC_USE_MOCK=true.
 *
 * Two profiles are exported so we can test both paths during dev:
 *   • MOCK_NEW_USER  — fresh signup, has not finished onboarding
 *   • MOCK_FULL_USER — established user with full streak / XP / why
 *
 * Which one boots is controlled by EXPO_PUBLIC_MOCK_PROFILE in your .env:
 *   "new"  → MOCK_NEW_USER (default — exercises the onboarding flow)
 *   "full" → MOCK_FULL_USER (exercises the home dashboard with rich state)
 */

import { User } from "@/stores/authStore";

export const MOCK_NEW_USER: User = {
  id: "usr_new_dev",
  firstName: "Alex",
  lastName: "Rivera",
  email: "alex@example.com",
  avatar: undefined,
  level: 1,
  xp: 0,
  xpToNextLevel: 200,
  streak: 0,
  streakBestEver: 0,
  netWorth: 0,
  financialHealthScore: 0,
  subscriptionTier: "free",
  onboardingComplete: false,
  why: "",
  whyEmoji: "✨",
  joinedAt: new Date().toISOString(),
};

export const MOCK_FULL_USER: User = {
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

const profile = (process.env.EXPO_PUBLIC_MOCK_PROFILE ?? "new").toLowerCase();
export const MOCK_USER: User = profile === "full" ? MOCK_FULL_USER : MOCK_NEW_USER;

export const MOCK_TOKEN = "mock_access_token_dev_only";

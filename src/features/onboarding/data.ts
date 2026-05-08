/**
 * Static onboarding content — copy and option lists.
 *
 * Kept here (not in mocks/) because this is real product content the user
 * will see in production, not test data. The backend may eventually serve
 * these dynamically — when that happens, replace the imports with a
 * service call inside onboardingService.getContent().
 *
 * Note: every option is paired with a Lucide icon name (typed via IconName)
 * — no emojis. Keeps the brand professional, finance-app-grade.
 */

import type { IconName } from "@/components/Icon";
import type {
  AgeRange,
  GoalKind,
  LifeSituation,
  SubscriptionTier,
} from "./types";

// ─── Profile options ─────────────────────────────────────────────────────────

export const AGE_RANGES: { id: AgeRange; label: string }[] = [
  { id: "under_18", label: "Under 18" },
  { id: "18_22", label: "18 – 22" },
  { id: "23_27", label: "23 – 27" },
  { id: "28_34", label: "28 – 34" },
  { id: "35_plus", label: "35+" },
];

export const SITUATIONS: {
  id: LifeSituation;
  icon: IconName;
  label: string;
  sub: string;
}[] = [
  {
    id: "college_student",
    icon: "layers",
    label: "College student",
    sub: "Studying, maybe a part-time gig",
  },
  {
    id: "first_job",
    icon: "wallet",
    label: "First real job",
    sub: "Figuring out the paycheck thing",
  },
  {
    id: "side_hustle",
    icon: "zap",
    label: "Side hustle",
    sub: "Mixing income from a few sources",
  },
  {
    id: "established_career",
    icon: "trending-up",
    label: "Established career",
    sub: "Steady income, ready to optimize",
  },
  {
    id: "between_jobs",
    icon: "activity",
    label: "Between things",
    sub: "Resetting and rebuilding",
  },
];

// ─── Goal kinds (the 1–3 multi-select) ───────────────────────────────────────

export const GOAL_OPTIONS: {
  id: GoalKind;
  icon: IconName;
  label: string;
  sub: string;
}[] = [
  {
    id: "emergency_fund",
    icon: "shield",
    label: "Build an emergency fund",
    sub: "3–6 months of breathing room",
  },
  {
    id: "debt_payoff",
    icon: "credit-card",
    label: "Pay off debt",
    sub: "Free up the money you already earn",
  },
  {
    id: "stop_overspending",
    icon: "target",
    label: "Stop overspending",
    sub: "Know where it goes before it's gone",
  },
  {
    id: "savings_target",
    icon: "piggy-bank",
    label: "Save for something specific",
    sub: "A trip, a car, a move, a milestone",
  },
  {
    id: "invest",
    icon: "trending-up",
    label: "Start investing",
    sub: "Put your money to work for you",
  },
  {
    id: "income_growth",
    icon: "banknote",
    label: "Grow my income",
    sub: "Track and lift what you earn",
  },
  {
    id: "custom",
    icon: "sparkles",
    label: "Something else",
    sub: "Tell Bud what you're working toward",
  },
];

// ─── Emotional why ───────────────────────────────────────────────────────────

export const WHY_OPTIONS: {
  id: string;
  icon: IconName;
  label: string;
  sub: string;
}[] = [
  {
    id: "freedom",
    icon: "shield-check",
    label: "Stop stressing about money",
    sub: "I want peace, not panic, when I check my balance",
  },
  {
    id: "family",
    icon: "users",
    label: "Take care of my family",
    sub: "The people who showed up for me",
  },
  {
    id: "wealth",
    icon: "trending-up",
    label: "Build wealth early",
    sub: "Start now so future me has options",
  },
  {
    id: "debt",
    icon: "minus",
    label: "Get out of debt",
    sub: "Stop renting my paychecks to a lender",
  },
  {
    id: "dream",
    icon: "star",
    label: "Fund the life I actually want",
    sub: "Travel, experiences, the version I picture",
  },
  {
    id: "legacy",
    icon: "trophy",
    label: "Build something that lasts",
    sub: "Beyond me — for the people next",
  },
  {
    id: "custom",
    icon: "sparkles",
    label: "Mine is different",
    sub: "Write your own — only you'll see it",
  },
];

// ─── Pricing tiers ───────────────────────────────────────────────────────────

export const PRICING: {
  id: SubscriptionTier;
  name: string;
  tagline: string;
  monthly: number;
  annualPerMonth: number;
  annualTotal: number;
  features: string[];
  recommended?: boolean;
}[] = [
  {
    id: "free",
    name: "Free",
    tagline: "All the essentials, forever",
    monthly: 0,
    annualPerMonth: 0,
    annualTotal: 0,
    features: [
      "Bud daily check-ins",
      "Up to 3 daily quests",
      "Streaks, XP, and levels",
      "Public Wealth Leagues",
      "Buds social feed + Fist Bumps",
    ],
  },
  {
    id: "premium",
    name: "Premium",
    tagline: "Where Bud unlocks personal",
    monthly: 15,
    annualPerMonth: 12,
    annualTotal: 144,
    recommended: true,
    features: [
      "Everything in Free",
      "Unlimited personalized quests",
      "Skill Tree + 90-Day Blueprint",
      "All Bud tools (Money Leaks, Future You, more)",
      "Accountability Partner",
      "4 Bud sessions per month",
    ],
  },
  {
    id: "elite",
    name: "Elite",
    tagline: "The full Budget Buddy experience",
    monthly: 20,
    annualPerMonth: 16,
    annualTotal: 192,
    features: [
      "Everything in Premium",
      "Unlimited Bud sessions",
      "Run Scenario time machine",
      "Smart Suggestions (proactive AI nudges)",
      "Community Circles (when active)",
      "Advanced analytics",
      "Priority support",
    ],
  },
];

export const LIFETIME_OFFER = {
  name: "Founders' Lifetime",
  blurb: "Pay once. Elite access for life. Limited spots.",
  spotsRemaining: 312,
  freeTrialDays: 14,
};

export const FREE_TRIAL_DAYS = 14;

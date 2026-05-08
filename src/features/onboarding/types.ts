/**
 * Onboarding domain types.
 *
 * These match the eventual ASP.NET backend payload shapes.
 * If the backend renames a field, change it here + in onboardingService's
 * `toDraft` / `fromDraft` mappers and nothing else needs to move.
 */

import type { IconName } from "@/components/Icon";

export type GoalKind =
  | "emergency_fund"
  | "debt_payoff"
  | "stop_overspending"
  | "savings_target"
  | "invest"
  | "income_growth"
  | "custom";

export type AgeRange = "under_18" | "18_22" | "23_27" | "28_34" | "35_plus";

export type LifeSituation =
  | "college_student"
  | "first_job"
  | "side_hustle"
  | "established_career"
  | "between_jobs";

export type SubscriptionTier = "free" | "premium" | "elite";
export type BillingCycle = "monthly" | "annual";

export interface FirstGoal {
  kind: GoalKind;
  name: string;
  targetAmount: number;
  alreadySaved: number;
  deadline: string | null; // ISO date — null means no deadline
  reason: string; // why this goal matters to them
}

export interface PlanSelection {
  tier: SubscriptionTier;
  cycle: BillingCycle;
  isLifetime: boolean;
}

export interface FirstQuest {
  id: string;
  name: string;
  whyItMatters: string;
  xpReward: number;
  durationLabel: string; // e.g. "this week"
  goalKind: GoalKind;
}

/**
 * The full draft we collect across the onboarding screens.
 * Stays in zustand until the user finishes — at which point we POST it
 * to the backend in one shot via onboardingService.complete().
 */
export interface OnboardingDraft {
  firstName: string;
  ageRange: AgeRange | null;
  situation: LifeSituation | null;
  goalKinds: GoalKind[]; // 1–3 selected goal types
  customGoalLabel: string; // when they pick "custom"
  whyId: string | null; // preset emotional why id, or "custom"
  whyText: string; // resolved label, or their custom text
  /** Lucide icon name representing the why visually. */
  whyIcon: IconName;
  bankConnected: boolean;
  plan: PlanSelection;
  firstGoal: FirstGoal | null;
  firstQuest: FirstQuest | null;
  shareToBuds: boolean;
}

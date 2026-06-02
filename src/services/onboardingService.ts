/**
 * Onboarding Service
 *
 * Single point of contact for onboarding-related API calls.
 * Screens call methods on this object — they never touch axios or the mocks
 * directly. Swap mock → real with EXPO_PUBLIC_USE_MOCK=false and nothing
 * inside the screens has to change.
 *
 * Backend integration map (when it's ready):
 *   submitProfile  → POST   ENDPOINTS.USER.UPDATE_PROFILE
 *   selectGoals    → POST   ENDPOINTS.USER.ONBOARDING (partial)
 *   connectBank    → POST   ENDPOINTS.PLAID.LINK_TOKEN + EXCHANGE
 *   subscribe      → POST   ENDPOINTS.PAYMENTS.SUBSCRIBE
 *   createGoal     → POST   ENDPOINTS.GOALS.CREATE
 *   suggestQuest   → GET    ENDPOINTS.QUESTS.ACTIVE  (server picks first)
 *   complete       → POST   ENDPOINTS.USER.ONBOARDING (final flag)
 *
 * The mappers at the bottom (`toApiOnboardingPayload`) translate the
 * draft shape into whatever the backend wants. The backend owning a
 * different field name? Change it there once and screens stay clean.
 */

import { api, IS_MOCK } from "@/api/client";
import { ENDPOINTS } from "@/api/endpoints";
import { budsService } from "@/services/budsService";
import type {
  FirstGoal,
  FirstQuest,
  GoalKind,
  OnboardingDraft,
  PlanSelection,
} from "@/features/onboarding/types";

// ─── Bud-suggested first quest (mock) ────────────────────────────────────────
// In real life the backend's personalization engine returns this based on
// goal type + Plaid trailing-30-day data. The shape here matches what
// QUESTS.ACTIVE will eventually return.

const QUEST_BY_GOAL: Record<GoalKind, FirstQuest> = {
  emergency_fund: {
    id: "q_first_emergency",
    name: "Move $25 to savings this week",
    whyItMatters:
      "$25 is small enough to feel doable and big enough to start a habit. By Sunday you're 1.25% of the way to a $2,000 cushion.",
    xpReward: 80,
    durationLabel: "this week",
    goalKind: "emergency_fund",
  },
  debt_payoff: {
    id: "q_first_debt",
    name: "Make one extra $20 payment this week",
    whyItMatters:
      "An extra $20 on your highest-interest balance can save you weeks of payments down the road. One small move, real momentum.",
    xpReward: 80,
    durationLabel: "this week",
    goalKind: "debt_payoff",
  },
  stop_overspending: {
    id: "q_first_awareness",
    name: "Log every coffee + takeout for 7 days",
    whyItMatters:
      "Awareness comes before discipline. Once you see the daily pattern, the change is almost automatic.",
    xpReward: 75,
    durationLabel: "next 7 days",
    goalKind: "stop_overspending",
  },
  savings_target: {
    id: "q_first_save",
    name: "Set up one auto-transfer to your goal",
    whyItMatters:
      "Automating one transfer means the goal grows even on the days you forget. Most progress is set-and-forget.",
    xpReward: 100,
    durationLabel: "this week",
    goalKind: "savings_target",
  },
  invest: {
    id: "q_first_invest",
    name: "Open or fund an investment account this week",
    whyItMatters:
      "Compound growth needs years, not dollars. The earliest dollar is the most valuable one you'll ever invest.",
    xpReward: 120,
    durationLabel: "this week",
    goalKind: "invest",
  },
  income_growth: {
    id: "q_first_income",
    name: "Track all income sources for the next 7 days",
    whyItMatters:
      "Most people undercount what they earn. Knowing the real number is the first step to growing it.",
    xpReward: 70,
    durationLabel: "next 7 days",
    goalKind: "income_growth",
  },
  custom: {
    id: "q_first_custom",
    name: "Write a 1-line plan for your goal",
    whyItMatters:
      "A goal without a first move stays a wish. One sentence on what you'll do this week is enough to make it real.",
    xpReward: 60,
    durationLabel: "this week",
    goalKind: "custom",
  },
};

function firstQuestForGoal(goalKind: GoalKind | undefined): FirstQuest {
  return QUEST_BY_GOAL[goalKind ?? "custom"] ?? QUEST_BY_GOAL.custom;
}

function isFirstQuest(value: unknown): value is FirstQuest {
  if (!value || typeof value !== "object") return false;
  const quest = value as Partial<FirstQuest>;
  return Boolean(
    quest.id &&
      quest.name &&
      quest.whyItMatters &&
      quest.durationLabel &&
      typeof quest.xpReward === "number" &&
      quest.goalKind
  );
}

// ─── Mappers — convert draft → API payload ──────────────────────────────────
// When the backend renames a field, update only this mapper.

interface ApiOnboardingPayload {
  firstName: string;
  ageRange: string | null;
  situation: string | null;
  goalKinds: string[];
  customGoalLabel?: string;
  why: string;
  whyIcon: string; // Lucide icon name; backend stores it as-is
  bankConnected: boolean;
  plan: PlanSelection;
  firstGoal: FirstGoal | null;
  firstQuest: FirstQuest | null;
  shareToBuds: boolean;
}

function toApiOnboardingPayload(draft: OnboardingDraft): ApiOnboardingPayload {
  return {
    firstName: draft.firstName,
    ageRange: draft.ageRange,
    situation: draft.situation,
    goalKinds: draft.goalKinds,
    customGoalLabel: draft.customGoalLabel || undefined,
    why: draft.whyText,
    whyIcon: draft.whyIcon,
    bankConnected: draft.bankConnected,
    plan: draft.plan,
    firstGoal: draft.firstGoal,
    firstQuest: draft.firstQuest,
    shareToBuds: draft.shareToBuds,
  };
}

// Network latency simulator for mock mode — gives the UI realistic loading.
const fakeDelay = (ms = 500) =>
  new Promise<void>((r) => setTimeout(() => r(), ms));

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const id = setTimeout(() => reject(new Error("timeout")), ms);
    promise
      .then(resolve)
      .catch(reject)
      .finally(() => clearTimeout(id));
  });
}

// ─── Service methods ────────────────────────────────────────────────────────

export const onboardingService = {
  /**
   * Returns a Bud-suggested first quest based on the user's primary goal.
   * In production this hits the personalization engine. In mock, we look
   * up a hand-written quest for the first selected goal kind.
   */
  suggestFirstQuest: async (goalKinds: GoalKind[]): Promise<FirstQuest> => {
    const primary = goalKinds[0] ?? "custom";

    if (IS_MOCK) {
      await fakeDelay(700);
      return firstQuestForGoal(primary);
    }

    try {
      // Real backend call (server picks the quest based on goal + transactions).
      const raw = await withTimeout(
        api.get<FirstQuest>(ENDPOINTS.QUESTS.ACTIVE, {
          goalKind: primary,
          mode: "first",
        }),
        900
      );
      if (isFirstQuest(raw)) return raw;
    } catch {
      // The personalization endpoint is not critical path during early backend
      // integration. Fall back locally so onboarding can still finish safely.
    }

    return firstQuestForGoal(primary);
  },

  /**
   * Triggers the Plaid Link flow.
   * In production: get a link_token from /plaid/link-token, then open the
   * Plaid Link SDK, then exchange the public_token via /plaid/exchange.
   * In mock: pretend it succeeded after a short pause.
   */
  connectBank: async (): Promise<{ connected: boolean }> => {
    if (IS_MOCK) {
      await fakeDelay(1200);
      return { connected: true };
    }
    const linkToken = await api.post<{ link_token: string }>(ENDPOINTS.PLAID.LINK_TOKEN);
    // The actual Plaid Link SDK flow happens in the screen — see StepBank.
    // After exchange:
    // await api.post(ENDPOINTS.PLAID.EXCHANGE, { public_token });
    return { connected: !!linkToken.link_token };
  },

  /**
   * Subscribes the user to the chosen plan via Stripe.
   * In production: create a Stripe checkout session or PaymentSheet on the
   * server (ENDPOINTS.PAYMENTS.SUBSCRIBE), then surface the Stripe SDK.
   * Free tier is a no-op.
   */
  subscribe: async (plan: PlanSelection): Promise<{ tier: PlanSelection["tier"] }> => {
    if (plan.tier === "free") return { tier: "free" };
    if (IS_MOCK) {
      await fakeDelay(800);
      return { tier: plan.tier };
    }
    const result = await api.post<{ tier: PlanSelection["tier"] }>(
      plan.isLifetime ? ENDPOINTS.PAYMENTS.LIFETIME : ENDPOINTS.PAYMENTS.SUBSCRIBE,
      plan
    );
    return result;
  },

  /**
   * Final atomic submission — sends the entire draft to the backend at once.
   * The backend creates the user profile, the first goal, the first quest,
   * the streak record, and (if opted in) the Buds post in a single transaction.
   *
   * Splitting submission per step is also fine — but a single call keeps
   * onboarding atomic from a UX perspective: success or rollback together.
   */
  complete: async (draft: OnboardingDraft): Promise<void> => {
    if (IS_MOCK) {
      await fakeDelay(600);
      return;
    }
    const payload = toApiOnboardingPayload(draft);
    await api.post(ENDPOINTS.USER.ONBOARDING, payload);
    if (draft.shareToBuds) {
      await budsService.sharePost({
        type: "quest_complete",
        title: "Day 1 started",
        message: "Starting today, I'm building better money habits with Bud.",
      });
    }
  },
};

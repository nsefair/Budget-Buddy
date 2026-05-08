/**
 * Goals Service
 *
 * Single point for goal-related API calls. Screens never touch axios or
 * the mocks directly — just call goalsService.list(), .create(), etc.
 *
 * Backend integration:
 *   list       → GET    ENDPOINTS.GOALS.LIST
 *   detail     → GET    ENDPOINTS.GOALS.DETAIL(id)
 *   create     → POST   ENDPOINTS.GOALS.CREATE
 *   update     → PATCH  ENDPOINTS.GOALS.UPDATE(id)
 *   delete     → DELETE ENDPOINTS.GOALS.DELETE(id)
 *   contribute → POST   ENDPOINTS.GOALS.CONTRIBUTE(id)
 *
 * If the API renames a field, only `toGoal` below needs updating.
 */

import { api, IS_MOCK } from "@/api/client";
import { ENDPOINTS } from "@/api/endpoints";
import {
  MOCK_GOALS,
  MOCK_GOALS_SUMMARY,
  type Goal,
  type GoalsSummary,
} from "@/mock/goals";

// Raw API shape — kept separate so screens always get the normalised `Goal`.
type RawGoal = Goal;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function toGoal(raw: RawGoal): Goal {
  // 1:1 today, but we keep the mapper so any backend rename is one line.
  return { ...raw };
}

const fakeDelay = (ms = 350) => new Promise<void>((r) => setTimeout(r, ms));

export const goalsService = {
  list: async (): Promise<{ goals: Goal[]; summary: GoalsSummary }> => {
    if (IS_MOCK) {
      await fakeDelay();
      return { goals: MOCK_GOALS, summary: MOCK_GOALS_SUMMARY };
    }
    const goals = await api.get<RawGoal[]>(ENDPOINTS.GOALS.LIST);
    const list = goals.map(toGoal);
    return {
      goals: list,
      summary: computeSummary(list),
    };
  },

  detail: async (id: string): Promise<Goal | null> => {
    if (IS_MOCK) {
      await fakeDelay();
      return MOCK_GOALS.find((g) => g.id === id) ?? null;
    }
    return toGoal(await api.get<RawGoal>(ENDPOINTS.GOALS.DETAIL(id)));
  },

  create: async (
    payload: Omit<Goal, "id" | "createdAt">
  ): Promise<Goal> => {
    if (IS_MOCK) {
      await fakeDelay();
      return {
        ...payload,
        id: `goal_${Math.random().toString(36).slice(2, 9)}`,
        createdAt: new Date().toISOString(),
      };
    }
    return toGoal(
      await api.post<RawGoal>(ENDPOINTS.GOALS.CREATE, payload)
    );
  },

  contribute: async (id: string, amount: number): Promise<Goal> => {
    if (IS_MOCK) {
      await fakeDelay();
      const found = MOCK_GOALS.find((g) => g.id === id)!;
      return { ...found, alreadySaved: found.alreadySaved + amount };
    }
    return toGoal(
      await api.post<RawGoal>(ENDPOINTS.GOALS.CONTRIBUTE(id), { amount })
    );
  },
};

function computeSummary(goals: Goal[]): GoalsSummary {
  return {
    totalSaved: goals.reduce((s, g) => s + g.alreadySaved, 0),
    totalTargetAcrossActive: goals.reduce((s, g) => s + g.targetAmount, 0),
    activeCount: goals.length,
    monthlyCommittedTotal: goals.reduce((s, g) => s + g.monthlyCommit, 0),
  };
}

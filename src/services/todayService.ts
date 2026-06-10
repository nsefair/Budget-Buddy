/**
 * Today (Dashboard) Service
 *
 * Feeds the Today tab. When IS_MOCK=true, returns local mock data instantly.
 * When IS_MOCK=false, calls the ASP.NET Core API.
 *
 * React Query keys are defined here alongside the fetchers so they stay in sync.
 * Usage in screens:
 *   const { data } = useQuery(todayService.queries.summary())
 */

import { api, IS_MOCK } from "@/api/client";
import { ENDPOINTS } from "@/api/endpoints";
import {
  MOCK_BUD_GREETING,
  MOCK_BUD_INSIGHT,
  type BudInsight,
} from "@/mock/bud";
import {
  MOCK_TRANSACTIONS,
  MOCK_BUDGET_OVERVIEW,
  type BudgetOverview,
  type Transaction,
} from "@/mock/budget";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TodaySummary {
  totalSpent: number;
  dailyBudget: number;
  topCategoryName: string;
  topCategoryAmount: number;
}

// ─── React Query key factory ──────────────────────────────────────────────────
// Centralised keys prevent typo mismatches across screens.
// If you rename a key, update it here once — all queries auto-invalidate.

export const TODAY_KEYS = {
  all: ["today"] as const,
  summary: () => [...TODAY_KEYS.all, "summary"] as const,
  greeting: (firstName: string) => [...TODAY_KEYS.all, "greeting", firstName] as const,
  insight: () => [...TODAY_KEYS.all, "insight"] as const,
  recentTransactions: () => [...TODAY_KEYS.all, "transactions"] as const,
};

// ─── Fetchers ─────────────────────────────────────────────────────────────────

export const todayService = {
  getSummary: async (): Promise<TodaySummary> => {
    if (IS_MOCK) {
      const { totalSpent, totalBudget, categories } = MOCK_BUDGET_OVERVIEW;
      const top = [...categories].sort((a, b) => b.spent - a.spent)[0];
      return {
        totalSpent,
        dailyBudget: Math.round(totalBudget / 30),
        topCategoryName: top.name,
        topCategoryAmount: top.spent,
      };
    }
    try {
      await api.post(ENDPOINTS.PLAID.SYNC);
    } catch {
      // Budget summary can still load from the last successful sync.
    }
    return api.get<TodaySummary>(ENDPOINTS.TODAY.SUMMARY);
  },

  getGreeting: async (firstName: string): Promise<string> => {
    if (IS_MOCK) return MOCK_BUD_GREETING(firstName, 14);
    return api.get<string>(ENDPOINTS.TODAY.BUD_GREETING);
  },

  getInsight: async (): Promise<BudInsight> => {
    if (IS_MOCK) return MOCK_BUD_INSIGHT;
    return api.get<BudInsight>(ENDPOINTS.TODAY.BUD_INSIGHT);
  },

  getRecentTransactions: async (): Promise<Transaction[]> => {
    if (IS_MOCK) return MOCK_TRANSACTIONS.slice(0, 5);
    return api.get<Transaction[]>(ENDPOINTS.TODAY.RECENT_TRANSACTIONS);
  },

  // Pre-built React Query option objects — use directly in useQuery()
  queries: {
    summary: () => ({
      queryKey: TODAY_KEYS.summary(),
      queryFn: todayService.getSummary,
      staleTime: 1000 * 60 * 2,
    }),
    insight: () => ({
      queryKey: TODAY_KEYS.insight(),
      queryFn: todayService.getInsight,
      staleTime: 1000 * 60 * 60, // insights are fresh for 1 hour
    }),
    recentTransactions: () => ({
      queryKey: TODAY_KEYS.recentTransactions(),
      queryFn: todayService.getRecentTransactions,
      staleTime: 1000 * 60 * 2,
    }),
  },
};

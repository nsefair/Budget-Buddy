/**
 * Bud (AI) Service
 *
 * All AI/chat interactions go through here.
 * The "Ask Bud" feature will call a streaming endpoint — swap the mock
 * implementation here when the backend engineer wires up the LLM.
 */

import { api, IS_MOCK } from "@/api/client";
import { ENDPOINTS } from "@/api/endpoints";
import {
  MOCK_BUD_INSIGHT,
  MOCK_SESSIONS,
  MOCK_CHAT_HISTORY,
  type BudInsight,
  type BudSession,
  type BudMessage,
} from "@/mock/bud";

export const BUD_KEYS = {
  all: ["bud"] as const,
  insight: () => [...BUD_KEYS.all, "insight"] as const,
  sessions: () => [...BUD_KEYS.all, "sessions"] as const,
  weekReview: () => [...BUD_KEYS.all, "weekReview"] as const,
};

export const budService = {
  getInsight: async (): Promise<BudInsight> => {
    if (IS_MOCK) return MOCK_BUD_INSIGHT;
    return api.get<BudInsight>(ENDPOINTS.BUD.INSIGHT);
  },

  getSessions: async (): Promise<BudSession[]> => {
    if (IS_MOCK) return MOCK_SESSIONS;
    return api.get<BudSession[]>(ENDPOINTS.BUD.SESSIONS);
  },

  /**
   * Ask Bud a question.
   * In production this will likely be a streaming response from the LLM.
   * The backend engineer can swap this for a streaming fetch — the screen
   * only sees a Promise<string>, so no UI changes are needed.
   */
  askQuestion: async (question: string): Promise<string> => {
    if (IS_MOCK) {
      await new Promise((r) => setTimeout(r, 1400));
      return "One thing worth knowing is that most people find progress happens in small, consistent steps rather than big swings. Based on your current spending patterns, even shifting $30/week makes a measurable difference over 90 days.";
    }
    const response = await api.post<{ answer: string }>(ENDPOINTS.BUD.ASK, { question });
    return response.answer;
  },

  getWeekReview: async (): Promise<BudMessage[]> => {
    if (IS_MOCK) return MOCK_CHAT_HISTORY;
    return api.get<BudMessage[]>(ENDPOINTS.BUD.WEEK_REVIEW);
  },

  queries: {
    insight: () => ({
      queryKey: BUD_KEYS.insight(),
      queryFn: budService.getInsight,
      staleTime: 1000 * 60 * 60, // fresh for 1 hour (regenerated daily at 7am server-side)
    }),
    sessions: () => ({
      queryKey: BUD_KEYS.sessions(),
      queryFn: budService.getSessions,
      staleTime: 1000 * 60 * 10,
    }),
  },
};

/**
 * Quests Service
 *
 * Weekly challenge, Financial Score, and score-based league data. The dashboard
 * endpoint intentionally returns the whole gamification snapshot in one request
 * so Today and Quests never waterfall through separate score/league calls.
 */

import { api, IS_MOCK } from "@/api/client";
import { ENDPOINTS } from "@/api/endpoints";
import {
  MOCK_BADGES,
  checkInMockQuest,
  getMockQuestDashboard,
} from "@/mock/quests";
import type {
  Badge,
  FinancialScore,
  League,
  Quest,
  QuestCheckInResult,
  QuestDashboard,
} from "@/features/quests/types";

export const QUESTS_KEYS = {
  all: ["quests"] as const,
  dashboard: () => [...QUESTS_KEYS.all, "dashboard"] as const,
  active: () => [...QUESTS_KEYS.all, "active"] as const,
  score: () => [...QUESTS_KEYS.all, "score"] as const,
  league: () => [...QUESTS_KEYS.all, "league"] as const,
  badges: () => [...QUESTS_KEYS.all, "badges"] as const,
};

export const questsService = {
  getDashboard: async (): Promise<QuestDashboard> => {
    if (IS_MOCK) return getMockQuestDashboard();
    return api.get<QuestDashboard>(ENDPOINTS.QUESTS.DASHBOARD);
  },

  getActiveQuests: async (): Promise<Quest[]> => {
    if (IS_MOCK) {
      return getMockQuestDashboard().quests.filter((quest) => quest.status === "active");
    }
    return api.get<Quest[]>(ENDPOINTS.QUESTS.WEEKLY);
  },

  checkIn: async (questId: string): Promise<QuestCheckInResult> => {
    if (IS_MOCK) return checkInMockQuest(questId);
    return api.post<QuestCheckInResult>(ENDPOINTS.QUESTS.CHECK_IN(questId));
  },

  completeQuest: async (questId: string): Promise<{ xpEarned: number }> => {
    const result = IS_MOCK
      ? checkInMockQuest(questId)
      : await api.post<QuestCheckInResult>(ENDPOINTS.QUESTS.COMPLETE(questId));
    return { xpEarned: result.xpEarned };
  },

  getFinancialScore: async (): Promise<FinancialScore> => {
    if (IS_MOCK) return getMockQuestDashboard().score;
    return api.get<FinancialScore>(ENDPOINTS.QUESTS.SCORE);
  },

  getLeague: async (): Promise<League> => {
    if (IS_MOCK) return getMockQuestDashboard().league;
    return api.get<League>(ENDPOINTS.QUESTS.LEAGUE);
  },

  getBadges: async (): Promise<Badge[]> => {
    if (IS_MOCK) return MOCK_BADGES;
    return api.get<Badge[]>(ENDPOINTS.QUESTS.BADGES);
  },

  getAlternatives: async (questId: string): Promise<Quest[]> => {
    if (IS_MOCK) {
      return getMockQuestDashboard().quests.filter((quest) => quest.id !== questId).slice(0, 3);
    }
    return api.get<Quest[]>(ENDPOINTS.QUESTS.ALTERNATIVES(questId));
  },

  queries: {
    dashboard: () => ({
      queryKey: QUESTS_KEYS.dashboard(),
      queryFn: questsService.getDashboard,
      staleTime: 1000 * 60 * 2,
    }),
    active: () => ({
      queryKey: QUESTS_KEYS.active(),
      queryFn: questsService.getActiveQuests,
      staleTime: 1000 * 60 * 2,
    }),
    score: () => ({
      queryKey: QUESTS_KEYS.score(),
      queryFn: questsService.getFinancialScore,
      staleTime: 1000 * 60 * 2,
    }),
    league: () => ({
      queryKey: QUESTS_KEYS.league(),
      queryFn: questsService.getLeague,
      staleTime: 1000 * 60,
    }),
    badges: () => ({
      queryKey: QUESTS_KEYS.badges(),
      queryFn: questsService.getBadges,
      staleTime: 1000 * 60 * 10,
    }),
  },
};

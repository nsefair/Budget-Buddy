/**
 * Quests Service
 *
 * Gamification data: quests, league, skill tree, badges.
 */

import { api, IS_MOCK } from "@/api/client";
import { ENDPOINTS } from "@/api/endpoints";
import {
  MOCK_QUESTS,
  MOCK_LEAGUE,
  MOCK_BADGES,
  type Quest,
  type League,
  type Badge,
} from "@/mock/quests";

export const QUESTS_KEYS = {
  all: ["quests"] as const,
  active: () => [...QUESTS_KEYS.all, "active"] as const,
  league: () => [...QUESTS_KEYS.all, "league"] as const,
  badges: () => [...QUESTS_KEYS.all, "badges"] as const,
};

export const questsService = {
  getActiveQuests: async (): Promise<Quest[]> => {
    if (IS_MOCK) return MOCK_QUESTS.filter((q) => q.status === "active");
    return api.get<Quest[]>(ENDPOINTS.QUESTS.ACTIVE);
  },

  completeQuest: async (questId: string): Promise<{ xpEarned: number }> => {
    if (IS_MOCK) {
      const quest = MOCK_QUESTS.find((q) => q.id === questId);
      return { xpEarned: quest?.xpReward ?? 0 };
    }
    return api.post<{ xpEarned: number }>(ENDPOINTS.QUESTS.COMPLETE(questId));
  },

  getLeague: async (): Promise<League> => {
    if (IS_MOCK) return MOCK_LEAGUE;
    return api.get<League>(ENDPOINTS.QUESTS.LEAGUE);
  },

  getBadges: async (): Promise<Badge[]> => {
    if (IS_MOCK) return MOCK_BADGES;
    return api.get<Badge[]>(ENDPOINTS.QUESTS.BADGES);
  },

  getAlternatives: async (questId: string): Promise<Quest[]> => {
    if (IS_MOCK) return MOCK_QUESTS.filter((q) => q.id !== questId).slice(0, 3);
    return api.get<Quest[]>(ENDPOINTS.QUESTS.ALTERNATIVES(questId));
  },

  queries: {
    active: () => ({
      queryKey: QUESTS_KEYS.active(),
      queryFn: questsService.getActiveQuests,
      staleTime: 1000 * 60 * 5,
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

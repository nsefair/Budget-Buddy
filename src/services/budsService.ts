/**
 * Buds (Social) Service
 *
 * Feed, follow/unfollow, fist bumps, discovery.
 * Privacy rule enforced here: no financial data is ever included in any
 * return type from this service. BudProfile contains only gamification signals.
 */

import { api, IS_MOCK } from "@/api/client";
import { ENDPOINTS } from "@/api/endpoints";
import {
  MOCK_FEED,
  MOCK_BUDS_PROFILES,
  SUGGESTED_BUDS,
  type FeedPost,
  type BudProfile,
} from "@/mock/buds";

export const BUDS_KEYS = {
  all: ["buds"] as const,
  feed: () => [...BUDS_KEYS.all, "feed"] as const,
  following: () => [...BUDS_KEYS.all, "following"] as const,
  discover: () => [...BUDS_KEYS.all, "discover"] as const,
  profile: (id: string) => [...BUDS_KEYS.all, "profile", id] as const,
};

export const budsService = {
  getFeed: async (): Promise<FeedPost[]> => {
    if (IS_MOCK) return MOCK_FEED;
    return api.get<FeedPost[]>(ENDPOINTS.BUDS.FEED);
  },

  getFollowing: async (): Promise<BudProfile[]> => {
    if (IS_MOCK) return MOCK_BUDS_PROFILES.filter((b) => b.isFollowing);
    return api.get<BudProfile[]>(ENDPOINTS.BUDS.MY_BUDS);
  },

  getDiscover: async (): Promise<BudProfile[]> => {
    if (IS_MOCK) return SUGGESTED_BUDS;
    return api.get<BudProfile[]>(ENDPOINTS.BUDS.DISCOVER);
  },

  getProfile: async (userId: string): Promise<BudProfile> => {
    if (IS_MOCK) {
      return MOCK_BUDS_PROFILES.find((b) => b.id === userId) ?? MOCK_BUDS_PROFILES[0];
    }
    return api.get<BudProfile>(ENDPOINTS.BUDS.PROFILE(userId));
  },

  follow: async (userId: string): Promise<void> => {
    if (IS_MOCK) return;
    await api.post(ENDPOINTS.BUDS.FOLLOW(userId));
  },

  unfollow: async (userId: string): Promise<void> => {
    if (IS_MOCK) return;
    await api.post(ENDPOINTS.BUDS.UNFOLLOW(userId));
  },

  fistBump: async (postId: string): Promise<{ newCount: number }> => {
    if (IS_MOCK) {
      const post = MOCK_FEED.find((p) => p.id === postId);
      return { newCount: (post?.fistBumps ?? 0) + 1 };
    }
    return api.post<{ newCount: number }>(ENDPOINTS.BUDS.FIST_BUMP(postId));
  },

  sharePost: async (content: {
    type: string;
    title: string;
    message: string;
  }): Promise<FeedPost> => {
    if (IS_MOCK) {
      return {
        id: `post_${Date.now()}`,
        user: {
          id: "u_me",
          displayName: "You",
          initials: "Y",
          level: 7,
          streak: 14,
          leagueTier: "Gold",
          badgeCount: 3,
          isFollowing: false,
        },
        type: content.type as FeedPost["type"],
        title: content.title,
        message: content.message,
        timestamp: new Date().toISOString(),
        fistBumps: 0,
        hasFistBumped: false,
      };
    }
    return api.post<FeedPost>(ENDPOINTS.BUDS.POST, content);
  },

  queries: {
    feed: () => ({
      queryKey: BUDS_KEYS.feed(),
      queryFn: budsService.getFeed,
      staleTime: 1000 * 60,
    }),
    following: () => ({
      queryKey: BUDS_KEYS.following(),
      queryFn: budsService.getFollowing,
      staleTime: 1000 * 60 * 5,
    }),
    discover: () => ({
      queryKey: BUDS_KEYS.discover(),
      queryFn: budsService.getDiscover,
      staleTime: 1000 * 60 * 10,
    }),
  },
};

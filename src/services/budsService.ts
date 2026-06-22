/**
 * Buds social service. Public return types intentionally exclude balances,
 * transactions, income, debt, categories, and exact savings amounts.
 */

import { API_BASE_URL, IS_MOCK, TokenStore, api, apiClient } from "@/api/client";
import { ENDPOINTS } from "@/api/endpoints";
import {
  MOCK_BUDS_PROFILES,
  MOCK_COMMENTS,
  MOCK_FEED,
  MOCK_SHAREABLE_ACHIEVEMENTS,
  SUGGESTED_BUDS,
  type BudProfile,
  type FeedMedia,
  type FeedPage,
  type FeedPost,
  type PostComment,
  type ShareableAchievement,
} from "@/mock/buds";
import { MOCK_LEAGUE, type League } from "@/mock/quests";

export const BUDS_KEYS = {
  all: ["buds"] as const,
  feed: () => [...BUDS_KEYS.all, "feed"] as const,
  league: () => [...BUDS_KEYS.all, "league"] as const,
  following: () => [...BUDS_KEYS.all, "following"] as const,
  followers: () => [...BUDS_KEYS.all, "followers"] as const,
  discover: () => [...BUDS_KEYS.all, "discover"] as const,
  profile: (id: string) => [...BUDS_KEYS.all, "profile", id] as const,
  comments: (postId: string) => [...BUDS_KEYS.all, "comments", postId] as const,
  achievements: () => [...BUDS_KEYS.all, "shareable-achievements"] as const,
};

export interface CreatePostInput {
  type: FeedPost["type"];
  title: string;
  message: string;
  visibility?: "buds" | "private";
  commentsEnabled?: boolean;
  mediaIds?: string[];
  achievementKind?: "quest" | "goal" | "score" | "league";
  achievementRefId?: string;
  localMedia?: Array<{ uri: string; width: number; height: number }>;
}

export interface UploadableImage {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
}

function absoluteMediaUrl(url: string) {
  if (!url || /^https?:\/\//.test(url)) return url;
  const apiOrigin = API_BASE_URL.replace(/\/v\d+\/?$/, "");
  return `${apiOrigin}${url.startsWith("/") ? "" : "/"}${url}`;
}

function normalizePost(post: FeedPost): FeedPost {
  return {
    ...post,
    media: (post.media ?? []).map((media) => ({
      ...media,
      url: absoluteMediaUrl(media.url),
    })),
  };
}

export const budsService = {
  getFeedPage: async ({ cursor, limit = 10 }: { cursor?: string; limit?: number } = {}): Promise<FeedPage> => {
    if (IS_MOCK) {
      const offset = cursor ? Number(cursor) : 0;
      const safeOffset = Number.isFinite(offset) ? offset : 0;
      const items = MOCK_FEED.slice(safeOffset, safeOffset + limit);
      const nextOffset = safeOffset + items.length;
      return {
        items,
        nextCursor: nextOffset < MOCK_FEED.length ? String(nextOffset) : undefined,
      };
    }
    const page = await api.get<FeedPage>(ENDPOINTS.BUDS.FEED, { cursor, limit });
    return { ...page, items: page.items.map(normalizePost) };
  },

  getFeed: async (): Promise<FeedPost[]> => {
    const page = await budsService.getFeedPage({ limit: 30 });
    return page.items;
  },

  getLeague: async (): Promise<League> => {
    if (IS_MOCK) return MOCK_LEAGUE;
    try {
      const league = await api.get<Omit<League, "tierColor">>(ENDPOINTS.BUDS.LEAGUE);
      return { ...league, tierColor: MOCK_LEAGUE.tierColor };
    } catch {
      return MOCK_LEAGUE;
    }
  },

  getFollowing: async (): Promise<BudProfile[]> => {
    if (IS_MOCK) return MOCK_BUDS_PROFILES.filter((bud) => bud.isFollowing);
    return api.get<BudProfile[]>(ENDPOINTS.BUDS.MY_BUDS);
  },

  getFollowers: async (): Promise<BudProfile[]> => {
    if (IS_MOCK) return MOCK_BUDS_PROFILES.slice(0, 2);
    return api.get<BudProfile[]>(ENDPOINTS.BUDS.FOLLOWERS);
  },

  getDiscover: async (): Promise<BudProfile[]> => {
    if (IS_MOCK) return SUGGESTED_BUDS;
    return api.get<BudProfile[]>(ENDPOINTS.BUDS.DISCOVER);
  },

  getProfile: async (userId: string): Promise<BudProfile> => {
    if (IS_MOCK) {
      return (
        MOCK_BUDS_PROFILES.find((bud) => bud.id === userId) ??
        SUGGESTED_BUDS.find((bud) => bud.id === userId) ?? {
          id: userId,
          displayName: "Budget Buddy member",
          initials: "BB",
          level: 1,
          streak: 0,
          leagueTier: "Bronze",
          badgeCount: 0,
          isFollowing: false,
        }
      );
    }
    return api.get<BudProfile>(ENDPOINTS.BUDS.PROFILE(userId));
  },

  follow: async (userId: string): Promise<void> => {
    if (!IS_MOCK) await api.post(ENDPOINTS.BUDS.FOLLOW(userId));
  },

  unfollow: async (userId: string): Promise<void> => {
    if (!IS_MOCK) await api.post(ENDPOINTS.BUDS.UNFOLLOW(userId));
  },

  block: async (userId: string): Promise<void> => {
    if (!IS_MOCK) await api.post(ENDPOINTS.BUDS.BLOCK(userId));
  },

  report: async (
    userId: string,
    payload: { postId?: string; reason?: string; details?: string } = {},
  ): Promise<void> => {
    if (!IS_MOCK) await api.post(ENDPOINTS.BUDS.REPORT(userId), payload);
  },

  fistBump: async (postId: string): Promise<{ newCount: number; hasFistBumped?: boolean }> => {
    if (IS_MOCK) {
      const post = MOCK_FEED.find((item) => item.id === postId);
      return { newCount: (post?.fistBumps ?? 0) + 1, hasFistBumped: true };
    }
    return api.post<{ newCount: number; hasFistBumped: boolean }>(ENDPOINTS.BUDS.FIST_BUMP(postId));
  },

  uploadMedia: async (image: UploadableImage): Promise<FeedMedia> => {
    if (IS_MOCK) {
      return {
        id: `media_${Date.now()}_${Math.random().toString(16).slice(2)}`,
        url: image.uri,
        mimeType: "image/jpeg",
        width: 1080,
        height: 1350,
        position: 0,
      };
    }
    const form = new FormData();
    form.append("image", {
      uri: image.uri,
      name: image.fileName ?? `buds-${Date.now()}.jpg`,
      type: image.mimeType ?? "image/jpeg",
    } as unknown as Blob);
    const response = await apiClient.post<FeedMedia>(ENDPOINTS.BUDS.MEDIA, form, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 30_000,
    });
    return { ...response.data, url: absoluteMediaUrl(response.data.url) };
  },

  sharePost: async (content: CreatePostInput): Promise<FeedPost> => {
    if (IS_MOCK) {
      const localMedia: FeedMedia[] = (content.localMedia ?? []).map((media, index) => ({
        id: `local_${Date.now()}_${index}`,
        url: media.uri,
        mimeType: "image/jpeg",
        width: media.width,
        height: media.height,
        position: index,
      }));
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
        type: content.type,
        title: content.title,
        message: content.message,
        timestamp: new Date().toISOString(),
        fistBumps: 0,
        hasFistBumped: false,
        visibility: content.visibility ?? "buds",
        commentsEnabled: content.commentsEnabled ?? true,
        commentCount: 0,
        achievement: content.achievementKind
          ? { kind: content.achievementKind, label: `Verified ${content.achievementKind}`, verified: true }
          : undefined,
        media: localMedia,
      };
    }
    const { localMedia: _localMedia, ...payload } = content;
    return normalizePost(await api.post<FeedPost>(ENDPOINTS.BUDS.POST, payload));
  },

  getComments: async (postId: string): Promise<PostComment[]> => {
    if (IS_MOCK) return MOCK_COMMENTS[postId] ?? [];
    return api.get<PostComment[]>(ENDPOINTS.BUDS.COMMENTS(postId));
  },

  addComment: async (postId: string, body: string): Promise<PostComment> => {
    if (IS_MOCK) {
      return {
        id: `comment_${Date.now()}`,
        body,
        timestamp: new Date().toISOString(),
        user: { id: "u_me", displayName: "You", initials: "Y" },
      };
    }
    return api.post<PostComment>(ENDPOINTS.BUDS.COMMENTS(postId), { body });
  },

  getShareableAchievements: async (): Promise<ShareableAchievement[]> => {
    if (IS_MOCK) return MOCK_SHAREABLE_ACHIEVEMENTS;
    return api.get<ShareableAchievement[]>(ENDPOINTS.BUDS.SHAREABLE_ACHIEVEMENTS);
  },

  mediaHeaders: async (): Promise<Record<string, string> | undefined> => {
    if (IS_MOCK) return undefined;
    const token = await TokenStore.getAccess();
    return token ? { Authorization: `Bearer ${token}` } : undefined;
  },

  queries: {
    league: () => ({
      queryKey: BUDS_KEYS.league(),
      queryFn: budsService.getLeague,
      staleTime: 60_000,
    }),
    following: () => ({
      queryKey: BUDS_KEYS.following(),
      queryFn: budsService.getFollowing,
      staleTime: 5 * 60_000,
    }),
    followers: () => ({
      queryKey: BUDS_KEYS.followers(),
      queryFn: budsService.getFollowers,
      staleTime: 5 * 60_000,
    }),
    discover: () => ({
      queryKey: BUDS_KEYS.discover(),
      queryFn: budsService.getDiscover,
      staleTime: 10 * 60_000,
    }),
  },
};

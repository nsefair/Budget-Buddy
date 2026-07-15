export interface BudProfile {
  id: string;
  displayName: string;
  avatar?: string;
  avatarAsset?: number;
  initials: string;
  level: number;
  streak: number;
  leagueTier: string;
  badgeCount: number;
  isFollowing?: boolean;
  followerCount?: number;
  followingCount?: number;
  financialHealthScore?: number;
}

export type FeedPostType =
  | "quest_complete"
  | "goal_milestone"
  | "score_milestone"
  | "league_progress"
  | "level_up"
  | "streak_milestone"
  | "badge_earned"
  | "week_review";

export interface FeedPost {
  id: string;
  user: BudProfile;
  type: FeedPostType;
  title: string;
  message: string;
  timestamp: string;
  fistBumps: number;
  hasFistBumped: boolean;
  visibility: "buds" | "private";
  commentsEnabled: boolean;
  commentCount: number;
  achievement?: {
    kind: "quest" | "goal" | "score" | "league" | "badge";
    label: string;
    verified: boolean;
  };
  media: FeedMedia[];
}

export interface FeedMedia {
  id: string;
  url: string;
  mimeType: string;
  width: number;
  height: number;
  position: number;
  localAsset?: number;
}

export interface PostComment {
  id: string;
  body: string;
  timestamp: string;
  user: Pick<BudProfile, "id" | "displayName" | "initials" | "avatar" | "avatarAsset">;
}

export interface FeedPage {
  items: FeedPost[];
  nextCursor?: string;
}

export interface ShareableAchievement {
  kind: "quest" | "goal" | "score" | "league";
  refId: string;
  title: string;
  label: string;
  verifiedAt: string;
}

const SOCIAL_FEED_PHOTO = require("../../assets/buds/social-feed-photo-mock.jpeg");

export const MOCK_BUDS_PROFILES: BudProfile[] = [
  { id: "u1", displayName: "Alex R.", initials: "AR", avatarAsset: SOCIAL_FEED_PHOTO, level: 12, streak: 30, leagueTier: "Platinum", badgeCount: 14, isFollowing: true },
  { id: "u2", displayName: "Priya M.", initials: "PM", level: 10, streak: 22, leagueTier: "Gold", badgeCount: 11, isFollowing: true },
  { id: "u3", displayName: "Derek T.", initials: "DT", level: 9, streak: 19, leagueTier: "Gold", badgeCount: 9, isFollowing: true },
  { id: "u4", displayName: "Sofia L.", initials: "SL", level: 7, streak: 11, leagueTier: "Silver", badgeCount: 7, isFollowing: true },
  { id: "u5", displayName: "Chris A.", initials: "CA", level: 6, streak: 9, leagueTier: "Silver", badgeCount: 5, isFollowing: false },
  { id: "u6", displayName: "Aaliyah W.", initials: "AW", level: 6, streak: 7, leagueTier: "Bronze", badgeCount: 4, isFollowing: false },
];

export const MOCK_FEED: FeedPost[] = [
  {
    id: "post_1",
    user: MOCK_BUDS_PROFILES[0],
    type: "quest_complete",
    title: "No-Buy Day complete",
    message: "Quiet win. Real progress.",
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    fistBumps: 152,
    hasFistBumped: true,
    visibility: "buds",
    commentsEnabled: true,
    commentCount: 28,
    achievement: { kind: "quest", label: "Verified quest", verified: true },
    media: [{ id: "media_1", url: "", mimeType: "image/jpeg", width: 1179, height: 2096, position: 0, localAsset: SOCIAL_FEED_PHOTO }],
  },
  {
    id: "post_2",
    user: MOCK_BUDS_PROFILES[1],
    type: "goal_milestone",
    title: "Emergency Fund — 50%",
    message: "Priya just hit the halfway point on her Emergency Fund. Halfway to the safety net.",
    timestamp: "2026-05-06T08:30:00Z",
    fistBumps: 8,
    hasFistBumped: false,
    visibility: "buds",
    commentsEnabled: true,
    commentCount: 6,
    achievement: { kind: "goal", label: "Verified goal", verified: true },
    media: [],
  },
  {
    id: "post_3",
    user: MOCK_BUDS_PROFILES[2],
    type: "level_up",
    title: "Reached level 9",
    message: "Derek just leveled up to 9. The climb continues.",
    timestamp: "2026-05-05T20:15:00Z",
    fistBumps: 6,
    hasFistBumped: false,
    visibility: "buds",
    commentsEnabled: true,
    commentCount: 3,
    media: [],
  },
  {
    id: "post_4",
    user: MOCK_BUDS_PROFILES[3],
    type: "quest_complete",
    title: "Quest complete",
    message: "Sofia finished 'Cook 3 meals at home this week' and earned 150 XP.",
    timestamp: "2026-05-05T18:00:00Z",
    fistBumps: 4,
    hasFistBumped: true,
    visibility: "buds",
    commentsEnabled: true,
    commentCount: 2,
    achievement: { kind: "quest", label: "Verified quest", verified: true },
    media: [],
  },
  {
    id: "post_5",
    user: MOCK_BUDS_PROFILES[1],
    type: "badge_earned",
    title: "New badge — Streak Starter",
    message: "Priya just earned the Streak Starter badge for hitting 7 days in a row.",
    timestamp: "2026-05-04T22:00:00Z",
    fistBumps: 9,
    hasFistBumped: false,
    visibility: "buds",
    commentsEnabled: false,
    commentCount: 0,
    media: [],
  },
];

export const MOCK_COMMENTS: Record<string, PostComment[]> = {
  post_1: [
    {
      id: "comment_1",
      body: "That kind of consistency is the whole game.",
      timestamp: new Date(Date.now() - 75 * 60 * 1000).toISOString(),
      user: MOCK_BUDS_PROFILES[1],
    },
    {
      id: "comment_2",
      body: "Fist bump. Keep the streak alive.",
      timestamp: new Date(Date.now() - 48 * 60 * 1000).toISOString(),
      user: MOCK_BUDS_PROFILES[2],
    },
  ],
};

export const MOCK_SHAREABLE_ACHIEVEMENTS: ShareableAchievement[] = [
  {
    kind: "quest",
    refId: "mock_no_buy_day",
    title: "No-Buy Day complete",
    label: "Verified quest",
    verifiedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    kind: "goal",
    refId: "mock_goal:50",
    title: "Goal milestone — 50%",
    label: "Verified goal",
    verifiedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    kind: "score",
    refId: "",
    title: "Financial Score reached 280",
    label: "Verified score",
    verifiedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    kind: "league",
    refId: "",
    title: "Built a steady week",
    label: "Verified progress",
    verifiedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

export const SUGGESTED_BUDS: BudProfile[] = [
  { id: "s1", displayName: "Mia T.", initials: "MT", level: 5, streak: 6, leagueTier: "Silver", badgeCount: 3, isFollowing: false },
  { id: "s2", displayName: "Liam R.", initials: "LR", level: 8, streak: 15, leagueTier: "Gold", badgeCount: 8, isFollowing: false },
  { id: "s3", displayName: "Emma C.", initials: "EC", level: 6, streak: 10, leagueTier: "Silver", badgeCount: 5, isFollowing: false },
];

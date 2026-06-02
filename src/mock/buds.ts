export interface BudProfile {
  id: string;
  displayName: string;
  avatar?: string;
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
}

export const MOCK_BUDS_PROFILES: BudProfile[] = [
  { id: "u1", displayName: "Jordan K.", initials: "JK", level: 12, streak: 30, leagueTier: "Platinum", badgeCount: 14, isFollowing: true },
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
    type: "streak_milestone",
    title: "30-day streak",
    message: "Jordan just hit a 30-day streak. The habit is locked in.",
    timestamp: "2026-05-06T09:00:00Z",
    fistBumps: 12,
    hasFistBumped: true,
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
  },
];

export const SUGGESTED_BUDS: BudProfile[] = [
  { id: "s1", displayName: "Mia T.", initials: "MT", level: 5, streak: 6, leagueTier: "Silver", badgeCount: 3, isFollowing: false },
  { id: "s2", displayName: "Liam R.", initials: "LR", level: 8, streak: 15, leagueTier: "Gold", badgeCount: 8, isFollowing: false },
  { id: "s3", displayName: "Emma C.", initials: "EC", level: 6, streak: 10, leagueTier: "Silver", badgeCount: 5, isFollowing: false },
];

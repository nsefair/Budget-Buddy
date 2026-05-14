export type QuestType = "short" | "medium" | "long";
export type QuestStatus = "active" | "completed" | "locked";

export interface Quest {
  id: string;
  type: QuestType;
  title: string;
  whyItMatters: string;
  xpReward: number;
  progress: number;
  total: number;
  deadline?: string;
  linkedGoalId?: string;
  linkedGoalName?: string;
  status: QuestStatus;
  completedAt?: string;
}

export interface LeagueUser {
  id: string;
  name: string;
  avatar?: string;
  level: number;
  xp: number;
  streak: number;
  isCurrentUser?: boolean;
}

export interface League {
  tier: "Bronze" | "Silver" | "Gold" | "Platinum" | "Diamond" | "Champion";
  tierColor: string;
  resetDate: string;
  users: LeagueUser[];
  currentUserRank: number;
}

export interface SkillNode {
  id: string;
  name: string;
  branch: "spending" | "saving" | "debt" | "income" | "wealth";
  status: "locked" | "in_progress" | "unlocked";
  xpRequired: number;
  questsRequired: string[];
  unlockedAt?: string;
  x: number;
  y: number;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: "streak" | "quest" | "social" | "tool" | "league" | "milestone";
  earned: boolean;
  earnedAt?: string;
  requirement?: string;
}

// ─── Mock Data ────────────────────────────────────────────────────────────────
export const MOCK_QUESTS: Quest[] = [
  // Short-term
  {
    id: "q_short_1",
    type: "short",
    title: "Cook 3 meals at home this week",
    whyItMatters: "You spent $160 on delivery last month — cooking 3 meals could save $50 this week alone.",
    xpReward: 150,
    progress: 1,
    total: 3,
    deadline: "2026-05-10T23:59:59Z",
    status: "active",
  },
  {
    id: "q_short_2",
    type: "short",
    title: "Stay under $20 on coffee this week",
    whyItMatters: "Starbucks alone hit $45 last month — trimming this adds $25 straight to your Emergency Fund.",
    xpReward: 100,
    progress: 7.45,
    total: 20,
    deadline: "2026-05-10T23:59:59Z",
    status: "active",
  },
  {
    id: "q_short_3",
    type: "short",
    title: "Open Budget Buddy 5 days in a row",
    whyItMatters: "You're on a 14-day streak — this keeps your momentum and unlocks your streak badge.",
    xpReward: 75,
    progress: 3,
    total: 5,
    deadline: "2026-05-10T23:59:59Z",
    status: "active",
  },
  // Medium-term
  {
    id: "q_med_1",
    type: "medium",
    title: "Transfer $200 to your Emergency Fund this month",
    whyItMatters: "You're $340 unallocated this month — putting $200 here gets you 22% closer to your 1-month cushion.",
    xpReward: 400,
    progress: 50,
    total: 200,
    deadline: "2026-05-31T23:59:59Z",
    linkedGoalId: "goal_1",
    linkedGoalName: "Emergency Fund",
    status: "active",
  },
  {
    id: "q_med_2",
    type: "medium",
    title: "Keep Shopping under $250 for May",
    whyItMatters: "Shopping is your biggest overspend category — staying on budget this month saves $80 vs last month.",
    xpReward: 350,
    progress: 287,
    total: 250,
    deadline: "2026-05-31T23:59:59Z",
    status: "active",
  },
  // Long-term
  {
    id: "q_long_1",
    type: "long",
    title: "Maintain a 30-day streak",
    whyItMatters: "You're at 14 days — 30 days is the threshold where financial habits become automatic. You're halfway.",
    xpReward: 1000,
    progress: 14,
    total: 30,
    status: "active",
  },
];

export const MOCK_LEAGUE: League = {
  tier: "Gold",
  tierColor: "#13D845",
  resetDate: "2026-05-12T00:00:00Z",
  currentUserRank: 4,
  users: [
    { id: "u1", name: "Jordan K.", level: 12, xp: 5800, streak: 30 },
    { id: "u2", name: "Priya M.", level: 10, xp: 5200, streak: 22 },
    { id: "u3", name: "Derek T.", level: 9, xp: 4800, streak: 19 },
    { id: "u_me", name: "Marcus R.", level: 7, xp: 3240, streak: 14, isCurrentUser: true },
    { id: "u4", name: "Sofia L.", level: 7, xp: 3100, streak: 11 },
    { id: "u5", name: "Chris A.", level: 6, xp: 2900, streak: 9 },
    { id: "u6", name: "Aaliyah W.", level: 6, xp: 2750, streak: 7 },
    { id: "u7", name: "Noah B.", level: 5, xp: 2400, streak: 5 },
  ],
};

export const MOCK_BADGES: Badge[] = [
  { id: "b1", name: "First Step", description: "Complete your first quest", icon: "🥇", category: "quest", earned: true, earnedAt: "2025-11-02T00:00:00Z" },
  { id: "b2", name: "Streak Starter", description: "Reach a 7-day streak", icon: "🔥", category: "streak", earned: true, earnedAt: "2025-11-08T00:00:00Z" },
  { id: "b3", name: "Connected", description: "Follow your first Bud", icon: "🤝", category: "social", earned: true, earnedAt: "2025-11-10T00:00:00Z" },
  { id: "b4", name: "Budget Boss", description: "Stay under budget for a full month", icon: "💪", category: "milestone", earned: false, requirement: "Stay within budget in all categories for one month" },
  { id: "b5", name: "Curious Learner", description: "Ask Bud 5 questions", icon: "🎓", category: "tool", earned: false, requirement: "Use Ask Bud 5 times" },
  { id: "b6", name: "Streak Legend", description: "Reach a 30-day streak", icon: "⚡", category: "streak", earned: false, requirement: "Maintain a 30-day streak" },
  { id: "b7", name: "League Climber", description: "Rank top 3 in Wealth League", icon: "🏆", category: "league", earned: false, requirement: "Finish in top 3 during a weekly league reset" },
  { id: "b8", name: "Community Member", description: "Follow 10 Buds", icon: "👥", category: "social", earned: false, requirement: "Follow 10 people on Budget Buddy" },
];

import { Colors } from "@/constants/colors";
import type {
  Badge,
  FinancialScore,
  League,
  Quest,
  QuestCheckInResult,
  QuestDashboard,
} from "@/features/quests/types";

function currentWeek() {
  const now = new Date();
  const start = new Date(now);
  const daysFromMonday = (now.getDay() + 6) % 7;
  start.setDate(now.getDate() - daysFromMonday);
  start.setHours(0, 0, 0, 0);
  const reset = new Date(start);
  reset.setDate(start.getDate() + 7);
  return { start, reset };
}

const { start, reset } = currentWeek();

export const MOCK_QUESTS: Quest[] = [
  {
    id: "q_week_home_meals",
    templateId: "home_meals_3",
    type: "short",
    category: "spending",
    title: "Cook 3 meals at home",
    whyItMatters:
      "Food and delivery totaled $160 in the last 30 days — a few home-first choices can leave more room for what matters.",
    instructions:
      "Check in after a meal you made at home. One check-in counts each day.",
    checkInLabel: "Meal cooked",
    iconName: "home",
    verificationType: "self_report",
    verificationDescription: "Confirmed by your check-in.",
    xpReward: 120,
    scoreImpact: 10,
    progress: 2,
    total: 3,
    unit: "meals",
    deadline: reset.toISOString(),
    status: "active",
    checkedInToday: false,
  },
  {
    id: "q_week_planned_spend",
    templateId: "planned_spend_5",
    type: "short",
    category: "planning",
    title: "Keep surprise spending at zero for 5 days",
    whyItMatters:
      "Planning a few choices before they happen keeps your week calm and leaves more room for your goals.",
    instructions:
      "At the end of a day when every purchase was planned, add one check-in.",
    checkInLabel: "Day stayed planned",
    iconName: "shield-check",
    verificationType: "bank_no_spend",
    verificationDescription: "Verified from yesterday's synced transactions.",
    xpReward: 180,
    scoreImpact: 15,
    progress: 3,
    total: 5,
    unit: "days",
    deadline: reset.toISOString(),
    status: "active",
    checkedInToday: false,
  },
  {
    id: "q_week_goal_move",
    templateId: "goal_move",
    type: "short",
    category: "goals",
    title: "Make one move toward a goal",
    whyItMatters:
      "Emergency Fund is $3,450 from its finish line — one small move keeps it real and visible.",
    instructions:
      "Open a goal and record any contribution that fits this week.",
    checkInLabel: "Goal move made",
    iconName: "target",
    verificationType: "goal_contribution",
    verificationDescription: "Verified from a new contribution to one of your goals.",
    xpReward: 130,
    scoreImpact: 11,
    progress: 0,
    total: 1,
    unit: "move",
    deadline: reset.toISOString(),
    linkedGoalId: "goal_1",
    linkedGoalName: "Emergency Fund",
    status: "active",
    checkedInToday: false,
  },
];

export const MOCK_SCORE: FinancialScore = {
  value: 280,
  previousValue: 278,
  change: 2,
  band: "Strong",
  leagueTier: "Platinum",
  nextLeagueTier: "Diamond",
  pointsToNextTier: 75,
  components: {
    quests: 58,
    budgeting: 57,
    saving: 55,
    goals: 60,
    consistency: 54,
  },
  updatedAt: new Date().toISOString(),
};

export const MOCK_LEAGUE: League = {
  tier: "Platinum",
  tierColor: Colors.gold,
  resetDate: reset.toISOString(),
  currentUserRank: 4,
  users: [
    { id: "u1", name: "Jordan K.", level: 12, xp: 5800, streak: 30, financialScore: 316, rank: 1 },
    { id: "u2", name: "Priya M.", level: 10, xp: 5200, streak: 22, financialScore: 302, rank: 2 },
    { id: "u3", name: "Derek T.", level: 9, xp: 4800, streak: 19, financialScore: 291, rank: 3 },
    { id: "u_me", name: "Taylor M.", level: 7, xp: 3240, streak: 12, financialScore: 280, rank: 4, isCurrentUser: true },
    { id: "u4", name: "Sofia L.", level: 7, xp: 3100, streak: 11, financialScore: 271, rank: 5 },
  ],
};

let mockDashboard: QuestDashboard = {
  weekStart: start.toISOString().slice(0, 10),
  resetDate: reset.toISOString(),
  quests: MOCK_QUESTS,
  score: MOCK_SCORE,
  league: MOCK_LEAGUE,
};

export function getMockQuestDashboard(): QuestDashboard {
  return {
    ...mockDashboard,
    quests: mockDashboard.quests.map((quest) => ({ ...quest })),
    score: {
      ...mockDashboard.score,
      components: { ...mockDashboard.score.components },
    },
    league: {
      ...mockDashboard.league,
      users: mockDashboard.league.users.map((user) => ({ ...user })),
    },
  };
}

export function checkInMockQuest(questId: string): QuestCheckInResult {
  const quest = mockDashboard.quests.find((candidate) => candidate.id === questId);
  if (!quest) throw new Error("Quest not found");

  if (quest.checkedInToday || quest.status === "completed") {
    return {
      quest: { ...quest },
      score: { ...mockDashboard.score },
      xpEarned: 0,
      totalXp: 350,
      alreadyCheckedIn: true,
    };
  }

  const progress = Math.min(quest.total, quest.progress + 1);
  const completed = progress >= quest.total;
  const updatedQuest: Quest = {
    ...quest,
    progress,
    checkedInToday: true,
    status: completed ? "completed" : "active",
    completedAt: completed ? new Date().toISOString() : undefined,
  };
  const scoreIncrease = completed ? Math.max(3, Math.round(quest.scoreImpact * 0.6)) : 0;
  const score = {
    ...mockDashboard.score,
    previousValue: mockDashboard.score.value,
    value: Math.min(500, mockDashboard.score.value + scoreIncrease),
    change: scoreIncrease,
    updatedAt: new Date().toISOString(),
  };
  mockDashboard = {
    ...mockDashboard,
    quests: mockDashboard.quests.map((candidate) =>
      candidate.id === questId ? updatedQuest : candidate
    ),
    score,
  };

  return {
    quest: updatedQuest,
    score,
    xpEarned: completed ? quest.xpReward : 0,
    totalXp: 350 + (completed ? quest.xpReward : 0),
    alreadyCheckedIn: false,
  };
}

export const MOCK_BADGES: Badge[] = [
  { id: "b1", name: "First Step", description: "Complete your first quest", icon: "medal", category: "quest", earned: true, earnedAt: "2025-11-02T00:00:00Z" },
  { id: "b2", name: "Streak Starter", description: "Reach a 7-day streak", icon: "flame", category: "streak", earned: true, earnedAt: "2025-11-08T00:00:00Z" },
  { id: "b3", name: "Connected", description: "Follow your first Bud", icon: "users", category: "social", earned: true, earnedAt: "2025-11-10T00:00:00Z" },
  { id: "b4", name: "On Plan", description: "Stay within plan for a full month", icon: "shield-check", category: "milestone", earned: false, requirement: "Stay within plan in all categories for one month" },
  { id: "b5", name: "Curious Learner", description: "Ask Bud 5 questions", icon: "sparkles", category: "tool", earned: false, requirement: "Use Ask Bud 5 times" },
  { id: "b6", name: "Streak Legend", description: "Reach a 30-day streak", icon: "zap", category: "streak", earned: false, requirement: "Maintain a 30-day streak" },
];

export type {
  Badge,
  FinancialScore,
  League,
  LeagueUser,
  Quest,
  QuestCheckInResult,
  QuestDashboard,
  QuestStatus,
  QuestType,
  SkillNode,
} from "@/features/quests/types";

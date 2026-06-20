import type { IconName } from "@/components/Icon";

export type QuestType = "short" | "medium" | "long";
export type QuestStatus = "active" | "completed" | "expired" | "locked";
export type QuestCategory =
  | "spending"
  | "saving"
  | "planning"
  | "awareness"
  | "goals"
  | "consistency";
export type QuestVerificationType =
  | "self_report"
  | "bank_no_spend"
  | "bank_no_delivery"
  | "goal_contribution"
  | "budget_limit";

export interface Quest {
  id: string;
  templateId?: string;
  type: QuestType;
  category: QuestCategory;
  title: string;
  whyItMatters: string;
  instructions: string;
  checkInLabel: string;
  iconName: IconName;
  verificationType: QuestVerificationType;
  verificationDescription: string;
  xpReward: number;
  scoreImpact: number;
  progress: number;
  total: number;
  unit: string;
  deadline?: string;
  linkedGoalId?: string;
  linkedGoalName?: string;
  status: QuestStatus;
  checkedInToday: boolean;
  completedAt?: string;
}

export interface ScoreComponents {
  quests: number;
  budgeting: number;
  saving: number;
  goals: number;
  consistency: number;
}

export interface FinancialScore {
  value: number;
  previousValue: number;
  change: number;
  band: "Foundation" | "Steady" | "Strong" | "Thriving" | "Exceptional";
  leagueTier: League["tier"];
  nextLeagueTier?: League["tier"];
  pointsToNextTier: number;
  components: ScoreComponents;
  updatedAt: string;
}

export interface LeagueUser {
  id: string;
  name: string;
  avatar?: string;
  level: number;
  xp: number;
  streak: number;
  financialScore: number;
  rank?: number;
  isCurrentUser?: boolean;
}

export interface League {
  tier: "Bronze" | "Silver" | "Gold" | "Platinum" | "Diamond" | "Champion";
  tierColor?: string;
  resetDate: string;
  users: LeagueUser[];
  currentUserRank: number;
}

export interface QuestDashboard {
  weekStart: string;
  resetDate: string;
  quests: Quest[];
  score: FinancialScore;
  league: League;
}

export interface QuestCheckInResult {
  quest: Quest;
  score: FinancialScore;
  xpEarned: number;
  totalXp: number;
  alreadyCheckedIn: boolean;
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

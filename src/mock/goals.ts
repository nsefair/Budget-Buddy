/**
 * Mock goals — matches the CEO's Goals tab drawing.
 *
 * Shapes mirror what /goals will return from the backend.
 * If the API renames a field, only goalsService's mapper changes.
 */

export type GoalCategoryKind =
  | "emergency_fund"
  | "debt_payoff"
  | "savings_target"
  | "invest"
  | "income_growth"
  | "stop_overspending"
  | "custom";

export type GoalDuration = "short" | "medium" | "long";

export interface Goal {
  id: string;
  name: string;
  kind: GoalCategoryKind;
  duration: GoalDuration;
  reason: string;
  targetAmount: number;
  alreadySaved: number;
  monthlyCommit: number;
  deadline: string; // ISO
  linkedAccountId?: string;
  createdAt: string;
}

export interface GoalsSummary {
  totalSaved: number;
  totalTargetAcrossActive: number;
  activeCount: number;
  monthlyCommittedTotal: number;
}

export const MOCK_GOALS: Goal[] = [
  {
    id: "goal_car",
    name: "Car Fund",
    kind: "savings_target",
    duration: "medium",
    reason: "I need to move to places",
    targetAmount: 8000,
    alreadySaved: 3200,
    monthlyCommit: 300,
    deadline: "2026-03-14T00:00:00Z",
    createdAt: "2025-08-01T00:00:00Z",
  },
  {
    id: "goal_bahamas",
    name: "Bahamas Trip",
    kind: "savings_target",
    duration: "long",
    reason: "I've never left the country",
    targetAmount: 3000,
    alreadySaved: 340,
    monthlyCommit: 25,
    deadline: "2027-12-15T00:00:00Z",
    createdAt: "2025-09-15T00:00:00Z",
  },
  {
    id: "goal_emergency",
    name: "Emergency Fund",
    kind: "emergency_fund",
    duration: "medium",
    reason: "Security means I stop making fear-based money decisions",
    targetAmount: 20000,
    alreadySaved: 800,
    monthlyCommit: 500,
    deadline: "2026-11-22T00:00:00Z",
    createdAt: "2025-07-10T00:00:00Z",
  },
  {
    id: "goal_macbook",
    name: "MacBook",
    kind: "savings_target",
    duration: "short",
    reason: "Faster machine equals more money",
    targetAmount: 1299,
    alreadySaved: 650,
    monthlyCommit: 50,
    deadline: "2026-02-17T00:00:00Z",
    createdAt: "2025-10-05T00:00:00Z",
  },
];

export const MOCK_GOALS_SUMMARY: GoalsSummary = {
  totalSaved: MOCK_GOALS.reduce((s, g) => s + g.alreadySaved, 0),
  totalTargetAcrossActive: MOCK_GOALS.reduce((s, g) => s + g.targetAmount, 0),
  activeCount: MOCK_GOALS.length,
  monthlyCommittedTotal: MOCK_GOALS.reduce((s, g) => s + g.monthlyCommit, 0),
};

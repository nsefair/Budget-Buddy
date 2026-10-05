import { api } from "@/api/client";
import { ENDPOINTS } from "@/api/endpoints";

export interface MoneyProfile {
  timezone: string;
  startDate: string;
  sources: { id: string; amountCents: number; periodDays: number; monthly: boolean; nextArrival: string }[];
  bills: { name: string; monthlyCents: number; merchants: string[] }[];
  goalMonthlyCents: number;
}
export interface MoneyCycle {
  start: string; end: string; days: number;
  incomeCents: number; billsCents: number; plannedGoalCents: number;
}
export interface MoneyToday {
  result: {
    version: string;
    inputs: {
      cycle: MoneyCycle; date: string; spentBeforeTodayCents: number;
      spentTodayCents: number; allocatedGoalCents: number;
    };
    daysLeft: number; waitingForIncome: boolean; bufferCents: number;
    flexibleBalanceCents: number; morningCents: number; remainingCents: number;
    displayDollars: number; overCents: number;
  };
  bankState: "manual" | "current" | "stale" | "reconnect_required";
  lastSyncAt: string | null;
}
export interface MoneySpending {
  clientId: string; amountCents: number; cash: boolean;
  date?: string; merchant?: string;
}

// All arithmetic remains on the backend. Never fall back to invented balances.
export const moneyService = {
  today: () => api.get<MoneyToday>(ENDPOINTS.MONEY.TODAY),
  profile: () => api.get<{ profile: MoneyProfile; cycle: MoneyCycle }>(ENDPOINTS.MONEY.PROFILE),
  saveProfile: (profile: MoneyProfile) => api.put<{ profile: MoneyProfile; cycle: MoneyCycle; suggestedGoalCents: number }>(ENDPOINTS.MONEY.PROFILE, profile),
  spend: (spending: MoneySpending) => api.post<MoneyToday>(ENDPOINTS.MONEY.SPENDING, spending),
  allocateYesterday: (goalId: string) => api.post<{ allocatedCents: number; alreadyAllocated: boolean }>(ENDPOINTS.MONEY.ALLOCATE_YESTERDAY, { goalId }),
};

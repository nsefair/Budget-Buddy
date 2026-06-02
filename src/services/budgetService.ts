/**
 * Budget Service
 *
 * All budget and transaction data flows through here.
 * Screens never import from mock/ directly.
 */

import { api, IS_MOCK } from "@/api/client";
import { ENDPOINTS } from "@/api/endpoints";
import {
  MOCK_BUDGET_OVERVIEW,
  MOCK_BUDGET_MONTH_OPTIONS,
  MOCK_BUDGET_MONTHS,
  MOCK_TRANSACTIONS,
  type BudgetOverview,
  type BudgetCategory,
  type BudgetMonthOption,
  type Transaction,
} from "@/mock/budget";

export const BUDGET_KEYS = {
  all: ["budget"] as const,
  months: () => [...BUDGET_KEYS.all, "months"] as const,
  overview: (month: string) => [...BUDGET_KEYS.all, "overview", month] as const,
  category: (id: string) => [...BUDGET_KEYS.all, "category", id] as const,
  transactions: (filters?: Record<string, unknown>) =>
    [...BUDGET_KEYS.all, "transactions", filters] as const,
};

function isTransactionInMonth(transaction: Transaction, month: string) {
  return transaction.date.startsWith(month);
}

function sortTransactionsNewestFirst(transactions: Transaction[]) {
  return [...transactions].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
}

export const budgetService = {
  getAvailableMonths: async (): Promise<BudgetMonthOption[]> => {
    if (IS_MOCK) return MOCK_BUDGET_MONTH_OPTIONS;
    try {
      return await api.get<BudgetMonthOption[]>(ENDPOINTS.BUDGET.MONTHS);
    } catch {
      return MOCK_BUDGET_MONTH_OPTIONS;
    }
  },

  getOverview: async (month: string): Promise<BudgetOverview> => {
    if (IS_MOCK) {
      return (
        MOCK_BUDGET_MONTHS.find((overview) => overview.monthId === month) ??
        MOCK_BUDGET_MONTHS.find((overview) => overview.month === month) ??
        MOCK_BUDGET_OVERVIEW
      );
    }
    try {
      return await api.get<BudgetOverview>(ENDPOINTS.BUDGET.OVERVIEW, { month });
    } catch {
      return (
        MOCK_BUDGET_MONTHS.find((overview) => overview.monthId === month) ??
        MOCK_BUDGET_MONTHS.find((overview) => overview.month === month) ??
        MOCK_BUDGET_OVERVIEW
      );
    }
  },

  getCategories: async (month = MOCK_BUDGET_OVERVIEW.monthId): Promise<BudgetCategory[]> => {
    if (IS_MOCK) return (await budgetService.getOverview(month)).categories;
    try {
      return await api.get<BudgetCategory[]>(ENDPOINTS.BUDGET.CATEGORIES, { month });
    } catch {
      return (await budgetService.getOverview(month)).categories;
    }
  },

  getCategoryTransactions: async (
    categoryId: string,
    month = MOCK_BUDGET_OVERVIEW.monthId
  ): Promise<Transaction[]> => {
    if (IS_MOCK) {
      return sortTransactionsNewestFirst(
        MOCK_TRANSACTIONS.filter(
          (t) => t.categoryId === categoryId && isTransactionInMonth(t, month)
        )
      );
    }
    try {
      return await api.get<Transaction[]>(ENDPOINTS.BUDGET.CATEGORY_DETAIL(categoryId), { month });
    } catch {
      return sortTransactionsNewestFirst(
        MOCK_TRANSACTIONS.filter(
          (t) => t.categoryId === categoryId && isTransactionInMonth(t, month)
        )
      );
    }
  },

  getTransactions: async ({
    page = 1,
    limit = 20,
    month,
  }: {
    page?: number;
    limit?: number;
    month?: string;
  } = {}): Promise<Transaction[]> => {
    if (IS_MOCK) {
      const scoped = month
        ? MOCK_TRANSACTIONS.filter((t) => isTransactionInMonth(t, month))
        : MOCK_TRANSACTIONS;
      return sortTransactionsNewestFirst(scoped).slice((page - 1) * limit, page * limit);
    }
    try {
      return await api.get<Transaction[]>(ENDPOINTS.BUDGET.TRANSACTIONS, { page, limit, month });
    } catch {
      const scoped = month
        ? MOCK_TRANSACTIONS.filter((t) => isTransactionInMonth(t, month))
        : MOCK_TRANSACTIONS;
      return sortTransactionsNewestFirst(scoped).slice((page - 1) * limit, page * limit);
    }
  },

  addManualTransaction: async (
    tx: Pick<Transaction, "merchant" | "category" | "categoryId" | "amount" | "date" | "note">
  ): Promise<Transaction> => {
    if (IS_MOCK) {
      return { ...tx, id: `manual_${Date.now()}`, isRecurring: false, isManual: true, isFlagged: false };
    }
    try {
      return await api.post<Transaction>(ENDPOINTS.BUDGET.MANUAL_ENTRY, tx);
    } catch {
      return { ...tx, id: `manual_${Date.now()}`, isRecurring: false, isManual: true, isFlagged: false };
    }
  },

  recategorize: async (transactionId: string, newCategoryId: string): Promise<void> => {
    if (IS_MOCK) return;
    try {
      await api.patch(ENDPOINTS.BUDGET.TRANSACTION_DETAIL(transactionId), { categoryId: newCategoryId });
    } catch {
      return;
    }
  },

  queries: {
    overview: (month: string) => ({
      queryKey: BUDGET_KEYS.overview(month),
      queryFn: () => budgetService.getOverview(month),
      staleTime: 1000 * 60 * 5,
    }),
    months: () => ({
      queryKey: BUDGET_KEYS.months(),
      queryFn: () => budgetService.getAvailableMonths(),
      staleTime: 1000 * 60 * 30,
    }),
    transactions: (month?: string) => ({
      queryKey: BUDGET_KEYS.transactions({ month }),
      queryFn: () => budgetService.getTransactions({ month }),
      staleTime: 1000 * 60 * 2,
    }),
  },
};

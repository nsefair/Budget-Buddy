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
  MOCK_TRANSACTIONS,
  type BudgetOverview,
  type BudgetCategory,
  type Transaction,
} from "@/mock/budget";

export const BUDGET_KEYS = {
  all: ["budget"] as const,
  overview: (month: string) => [...BUDGET_KEYS.all, "overview", month] as const,
  category: (id: string) => [...BUDGET_KEYS.all, "category", id] as const,
  transactions: (filters?: Record<string, unknown>) =>
    [...BUDGET_KEYS.all, "transactions", filters] as const,
};

export const budgetService = {
  getOverview: async (month: string): Promise<BudgetOverview> => {
    if (IS_MOCK) return { ...MOCK_BUDGET_OVERVIEW, month };
    return api.get<BudgetOverview>(ENDPOINTS.BUDGET.OVERVIEW, { month });
  },

  getCategories: async (): Promise<BudgetCategory[]> => {
    if (IS_MOCK) return MOCK_BUDGET_OVERVIEW.categories;
    return api.get<BudgetCategory[]>(ENDPOINTS.BUDGET.CATEGORIES);
  },

  getCategoryTransactions: async (categoryId: string): Promise<Transaction[]> => {
    if (IS_MOCK) {
      return MOCK_TRANSACTIONS.filter((t) => t.categoryId === categoryId);
    }
    return api.get<Transaction[]>(ENDPOINTS.BUDGET.CATEGORY_DETAIL(categoryId));
  },

  getTransactions: async (page = 1, limit = 20): Promise<Transaction[]> => {
    if (IS_MOCK) return MOCK_TRANSACTIONS;
    return api.get<Transaction[]>(ENDPOINTS.BUDGET.TRANSACTIONS, { page, limit });
  },

  addManualTransaction: async (
    tx: Pick<Transaction, "merchant" | "category" | "categoryId" | "amount" | "date" | "note">
  ): Promise<Transaction> => {
    if (IS_MOCK) {
      return { ...tx, id: `manual_${Date.now()}`, isRecurring: false, isManual: true, isFlagged: false };
    }
    return api.post<Transaction>(ENDPOINTS.BUDGET.MANUAL_ENTRY, tx);
  },

  recategorize: async (transactionId: string, newCategoryId: string): Promise<void> => {
    if (IS_MOCK) return;
    await api.patch(ENDPOINTS.BUDGET.TRANSACTION_DETAIL(transactionId), { categoryId: newCategoryId });
  },

  queries: {
    overview: (month: string) => ({
      queryKey: BUDGET_KEYS.overview(month),
      queryFn: () => budgetService.getOverview(month),
      staleTime: 1000 * 60 * 5,
    }),
    transactions: () => ({
      queryKey: BUDGET_KEYS.transactions(),
      queryFn: () => budgetService.getTransactions(),
      staleTime: 1000 * 60 * 2,
    }),
  },
};

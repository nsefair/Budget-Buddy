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
  MOCK_ACCOUNTS,
  type BudgetOverview,
  type BudgetCategory,
  type BudgetMonthOption,
  type Transaction,
  type AccountSummary,
} from "@/mock/budget";

export const BUDGET_KEYS = {
  all: ["budget"] as const,
  months: () => [...BUDGET_KEYS.all, "months"] as const,
  overview: (month: string) => [...BUDGET_KEYS.all, "overview", month] as const,
  category: (id: string) => [...BUDGET_KEYS.all, "category", id] as const,
  transactions: (filters?: Record<string, unknown>) =>
    [...BUDGET_KEYS.all, "transactions", filters] as const,
  accounts: () => [...BUDGET_KEYS.all, "accounts"] as const,
};

const CATEGORY_DEFAULTS: Omit<BudgetCategory, "spent">[] = [
  { id: "food", name: "Food & Drink", icon: "receipt", budgetLimit: 400, color: "#F59E0B" },
  { id: "transport", name: "Transportation", icon: "activity", budgetLimit: 200, color: "#6366F1" },
  { id: "shopping", name: "Shopping", icon: "wallet", budgetLimit: 250, color: "#EF4444" },
  { id: "housing", name: "Housing", icon: "home", budgetLimit: 1200, color: "#1B2B4B" },
  { id: "entertainment", name: "Entertainment", icon: "star", budgetLimit: 100, color: "#8B5CF6" },
  { id: "health", name: "Health & Wellness", icon: "shield", budgetLimit: 80, color: "#10B981" },
  { id: "personal", name: "Personal Care", icon: "user", budgetLimit: 60, color: "#13D845" },
  { id: "education", name: "Education", icon: "layers", budgetLimit: 50, color: "#00B4A6" },
];

function currentMonthId() {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  return `${now.getFullYear()}-${month}`;
}

function monthLabel(monthId: string) {
  const parsed = new Date(`${monthId}-01T00:00:00`);
  return parsed.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function emptyOverview(month = currentMonthId()): BudgetOverview {
  const categories = CATEGORY_DEFAULTS.map((category) => ({ ...category, spent: 0 }));
  const totalBudget = categories.reduce((sum, category) => sum + category.budgetLimit, 0);
  return {
    monthId: month,
    month: monthLabel(month),
    totalBudget,
    totalSpent: 0,
    income: 0,
    savingsRate: 0,
    avgDailySpend: 0,
    categories,
  };
}

function emptyMonthOptions(): BudgetMonthOption[] {
  const monthId = currentMonthId();
  const overview = emptyOverview(monthId);
  return [
    {
      id: monthId,
      label: overview.month,
      shortLabel: new Date(`${monthId}-01T00:00:00`).toLocaleDateString("en-US", {
        month: "short",
      }),
      totalSpent: 0,
      totalBudget: overview.totalBudget,
      isCurrent: true,
    },
  ];
}

function isTransactionInMonth(transaction: Transaction, month: string) {
  return transaction.date.startsWith(month);
}

function sortTransactionsNewestFirst(transactions: Transaction[]) {
  return [...transactions].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
}

export function linkedAccountNetWorth(accounts: AccountSummary[]) {
  return accounts.reduce((sum, account) => {
    if (account.kind === "investment") return sum;
    return sum + account.balance;
  }, 0);
}

export const budgetService = {
  getAvailableMonths: async (): Promise<BudgetMonthOption[]> => {
    if (IS_MOCK) return MOCK_BUDGET_MONTH_OPTIONS;
    return api.get<BudgetMonthOption[]>(ENDPOINTS.BUDGET.MONTHS);
  },

  getOverview: async (month: string): Promise<BudgetOverview> => {
    if (IS_MOCK) {
      return (
        MOCK_BUDGET_MONTHS.find((overview) => overview.monthId === month) ??
        MOCK_BUDGET_MONTHS.find((overview) => overview.month === month) ??
        MOCK_BUDGET_OVERVIEW
      );
    }
    return api.get<BudgetOverview>(ENDPOINTS.BUDGET.OVERVIEW, { month });
  },

  getCategories: async (month = currentMonthId()): Promise<BudgetCategory[]> => {
    if (IS_MOCK) return (await budgetService.getOverview(month)).categories;
    return api.get<BudgetCategory[]>(ENDPOINTS.BUDGET.CATEGORIES, { month });
  },

  getAccounts: async (): Promise<AccountSummary[]> => {
    if (IS_MOCK) return MOCK_ACCOUNTS;
    return api.get<AccountSummary[]>(ENDPOINTS.BUDGET.ACCOUNTS);
  },

  getCategoryTransactions: async (
    categoryId: string,
    month = currentMonthId()
  ): Promise<Transaction[]> => {
    if (IS_MOCK) {
      return sortTransactionsNewestFirst(
        MOCK_TRANSACTIONS.filter(
          (t) => t.categoryId === categoryId && isTransactionInMonth(t, month)
        )
      );
    }
    const transactions = await api.get<Transaction[]>(ENDPOINTS.BUDGET.TRANSACTIONS, {
      month,
      limit: 100,
    });
    return sortTransactionsNewestFirst(
      transactions.filter((transaction) => transaction.categoryId === categoryId)
    );
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
    return api.get<Transaction[]>(ENDPOINTS.BUDGET.TRANSACTIONS, { page, limit, month });
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
    await api.patch(ENDPOINTS.BUDGET.TRANSACTION_DETAIL(transactionId), {
      categoryId: newCategoryId,
    });
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
    accounts: () => ({
      queryKey: BUDGET_KEYS.accounts(),
      queryFn: () => budgetService.getAccounts(),
      staleTime: 1000 * 60 * 2,
    }),
  },
};

export { emptyOverview, emptyMonthOptions };

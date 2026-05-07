export interface BudgetCategory {
  id: string;
  name: string;
  icon: string;
  budgetLimit: number;
  spent: number;
  color: string;
}

export interface Transaction {
  id: string;
  merchant: string;
  category: string;
  categoryId: string;
  amount: number;
  date: string;
  isRecurring: boolean;
  isManual: boolean;
  isFlagged: boolean;
  note?: string;
}

export interface BudgetOverview {
  month: string;
  totalBudget: number;
  totalSpent: number;
  income: number;
  savingsRate: number;
  avgDailySpend: number;
  categories: BudgetCategory[];
}

export const MOCK_BUDGET_CATEGORIES: BudgetCategory[] = [
  { id: "food", name: "Food & Drink", icon: "🍔", budgetLimit: 400, spent: 312, color: "#F59E0B" },
  { id: "transport", name: "Transportation", icon: "🚗", budgetLimit: 200, spent: 178, color: "#6366F1" },
  { id: "shopping", name: "Shopping", icon: "🛍️", budgetLimit: 250, spent: 287, color: "#EF4444" },
  { id: "housing", name: "Housing", icon: "🏠", budgetLimit: 1200, spent: 1200, color: "#1B2B4B" },
  { id: "entertainment", name: "Entertainment", icon: "🎬", budgetLimit: 100, spent: 64, color: "#8B5CF6" },
  { id: "health", name: "Health & Wellness", icon: "💊", budgetLimit: 80, spent: 45, color: "#10B981" },
  { id: "personal", name: "Personal Care", icon: "✂️", budgetLimit: 60, spent: 38, color: "#F4A832" },
  { id: "education", name: "Education", icon: "📚", budgetLimit: 50, spent: 0, color: "#00B4A6" },
];

export const MOCK_TRANSACTIONS: Transaction[] = [
  { id: "txn_001", merchant: "Chipotle", category: "Food & Drink", categoryId: "food", amount: 14.75, date: "2026-05-06T12:30:00Z", isRecurring: false, isManual: false, isFlagged: false },
  { id: "txn_002", merchant: "Uber", category: "Transportation", categoryId: "transport", amount: 23.50, date: "2026-05-06T09:15:00Z", isRecurring: false, isManual: false, isFlagged: false },
  { id: "txn_003", merchant: "Netflix", category: "Entertainment", categoryId: "entertainment", amount: 15.49, date: "2026-05-05T00:00:00Z", isRecurring: true, isManual: false, isFlagged: false },
  { id: "txn_004", merchant: "Amazon", category: "Shopping", categoryId: "shopping", amount: 89.99, date: "2026-05-05T14:22:00Z", isRecurring: false, isManual: false, isFlagged: true },
  { id: "txn_005", merchant: "Whole Foods", category: "Food & Drink", categoryId: "food", amount: 67.30, date: "2026-05-04T18:00:00Z", isRecurring: false, isManual: false, isFlagged: false },
  { id: "txn_006", merchant: "Planet Fitness", category: "Health & Wellness", categoryId: "health", amount: 24.99, date: "2026-05-01T00:00:00Z", isRecurring: true, isManual: false, isFlagged: false },
  { id: "txn_007", merchant: "Starbucks", category: "Food & Drink", categoryId: "food", amount: 7.45, date: "2026-05-06T08:05:00Z", isRecurring: false, isManual: false, isFlagged: false },
  { id: "txn_008", merchant: "Shell Gas Station", category: "Transportation", categoryId: "transport", amount: 52.00, date: "2026-05-03T11:30:00Z", isRecurring: false, isManual: false, isFlagged: false },
];

export const MOCK_BUDGET_OVERVIEW: BudgetOverview = {
  month: "May 2026",
  totalBudget: 2340,
  totalSpent: 2124,
  income: 3800,
  savingsRate: 18.4,
  avgDailySpend: 68.5,
  categories: MOCK_BUDGET_CATEGORIES,
};

import { Colors } from "@/constants/colors";

export interface BudgetCategory {
  id: string;
  name: string;
  icon: string;
  budgetLimit: number;
  spent: number;
  color: string;
  source?: "default" | "bud_recommended" | "user_adjusted";
  recommendedLimit?: number;
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
  monthId: string;
  month: string;
  totalBudget: number;
  totalSpent: number;
  income: number;
  savingsRate: number;
  avgDailySpend: number;
  categories: BudgetCategory[];
}

export interface BudgetMonthOption {
  id: string;
  label: string;
  shortLabel: string;
  totalSpent: number;
  totalBudget: number;
  isCurrent: boolean;
}

const CATEGORY_META: Array<Omit<BudgetCategory, "spent">> = [
  { id: "food", name: "Food & Drink", icon: "receipt", budgetLimit: 400, color: "#F59E0B" },
  { id: "transport", name: "Transportation", icon: "activity", budgetLimit: 200, color: "#6366F1" },
  { id: "shopping", name: "Shopping", icon: "wallet", budgetLimit: 250, color: "#EF4444" },
  { id: "housing", name: "Housing", icon: "home", budgetLimit: 1200, color: "#1B2B4B" },
  { id: "entertainment", name: "Entertainment", icon: "star", budgetLimit: 100, color: "#8B5CF6" },
  { id: "health", name: "Health & Wellness", icon: "shield", budgetLimit: 80, color: "#10B981" },
  { id: "personal", name: "Personal Care", icon: "user", budgetLimit: 60, color: Colors.gold },
  { id: "education", name: "Education", icon: "layers", budgetLimit: 50, color: "#00B4A6" },
];

function makeCategories(spend: Record<string, number>): BudgetCategory[] {
  return CATEGORY_META.map((category) => ({
    ...category,
    spent: spend[category.id] ?? 0,
  }));
}

function makeOverview({
  monthId,
  month,
  income,
  categories,
}: {
  monthId: string;
  month: string;
  income: number;
  categories: BudgetCategory[];
}): BudgetOverview {
  const totalSpent = categories.reduce((sum, c) => sum + c.spent, 0);
  const totalBudget = categories.reduce((sum, c) => sum + c.budgetLimit, 0);
  const daysElapsed = monthId === "2026-05" ? 31 : 30;

  return {
    monthId,
    month,
    income,
    categories,
    totalSpent,
    totalBudget,
    savingsRate: Math.max(0, ((income - totalSpent) / income) * 100),
    avgDailySpend: totalSpent / daysElapsed,
  };
}

export const MOCK_BUDGET_MONTHS: BudgetOverview[] = [
  makeOverview({
    monthId: "2026-03",
    month: "March 2026",
    income: 3650,
    categories: makeCategories({
      food: 354,
      transport: 142,
      shopping: 186,
      housing: 1200,
      entertainment: 92,
      health: 36,
      personal: 52,
      education: 28,
    }),
  }),
  makeOverview({
    monthId: "2026-04",
    month: "April 2026",
    income: 3750,
    categories: makeCategories({
      food: 438,
      transport: 205,
      shopping: 221,
      housing: 1200,
      entertainment: 118,
      health: 42,
      personal: 48,
      education: 12,
    }),
  }),
  makeOverview({
    monthId: "2026-05",
    month: "May 2026",
    income: 3800,
    categories: makeCategories({
      food: 312,
      transport: 178,
      shopping: 287,
      housing: 1200,
      entertainment: 64,
      health: 45,
      personal: 38,
      education: 0,
    }),
  }),
];

export const MOCK_BUDGET_OVERVIEW = MOCK_BUDGET_MONTHS[MOCK_BUDGET_MONTHS.length - 1];
export const MOCK_BUDGET_CATEGORIES = MOCK_BUDGET_OVERVIEW.categories;

export const MOCK_BUDGET_MONTH_OPTIONS: BudgetMonthOption[] = MOCK_BUDGET_MONTHS.map(
  (overview, index) => ({
    id: overview.monthId,
    label: overview.month,
    shortLabel: new Date(`${overview.monthId}-01T00:00:00`).toLocaleDateString("en-US", {
      month: "short",
    }),
    totalSpent: overview.totalSpent,
    totalBudget: overview.totalBudget,
    isCurrent: index === MOCK_BUDGET_MONTHS.length - 1,
  })
);

export const MOCK_TRANSACTIONS: Transaction[] = [
  { id: "txn_paycheck_may_15", merchant: "Payroll deposit", category: "Income", categoryId: "income", amount: -1900, date: "2026-05-15T09:00:00Z", isRecurring: true, isManual: false, isFlagged: false },
  { id: "txn_icloud_may", merchant: "iCloud+", category: "Entertainment", categoryId: "entertainment", amount: 2.99, date: "2026-05-12T00:00:00Z", isRecurring: true, isManual: false, isFlagged: false },
  { id: "txn_001", merchant: "Chipotle", category: "Food & Drink", categoryId: "food", amount: 14.75, date: "2026-05-06T12:30:00Z", isRecurring: false, isManual: false, isFlagged: false },
  { id: "txn_002", merchant: "Uber", category: "Transportation", categoryId: "transport", amount: 23.50, date: "2026-05-06T09:15:00Z", isRecurring: false, isManual: false, isFlagged: false },
  { id: "txn_003", merchant: "Netflix", category: "Entertainment", categoryId: "entertainment", amount: 15.49, date: "2026-05-05T00:00:00Z", isRecurring: true, isManual: false, isFlagged: false },
  { id: "txn_004", merchant: "Amazon", category: "Shopping", categoryId: "shopping", amount: 89.99, date: "2026-05-05T14:22:00Z", isRecurring: false, isManual: false, isFlagged: true },
  { id: "txn_005", merchant: "Whole Foods", category: "Food & Drink", categoryId: "food", amount: 67.30, date: "2026-05-04T18:00:00Z", isRecurring: false, isManual: false, isFlagged: false },
  { id: "txn_006", merchant: "Planet Fitness", category: "Health & Wellness", categoryId: "health", amount: 24.99, date: "2026-05-01T00:00:00Z", isRecurring: true, isManual: false, isFlagged: false },
  { id: "txn_rent_may", merchant: "Landlord", category: "Housing", categoryId: "housing", amount: 1200, date: "2026-05-01T08:00:00Z", isRecurring: true, isManual: false, isFlagged: false },
  { id: "txn_paycheck_may_01", merchant: "Payroll deposit", category: "Income", categoryId: "income", amount: -1900, date: "2026-05-01T09:00:00Z", isRecurring: true, isManual: false, isFlagged: false },
  { id: "txn_007", merchant: "Starbucks", category: "Food & Drink", categoryId: "food", amount: 7.45, date: "2026-05-06T08:05:00Z", isRecurring: false, isManual: false, isFlagged: false },
  { id: "txn_008", merchant: "Shell Gas Station", category: "Transportation", categoryId: "transport", amount: 52.00, date: "2026-05-03T11:30:00Z", isRecurring: false, isManual: false, isFlagged: false },
  { id: "txn_009", merchant: "Target", category: "Shopping", categoryId: "shopping", amount: 72.40, date: "2026-04-28T16:10:00Z", isRecurring: false, isManual: false, isFlagged: false },
  { id: "txn_010", merchant: "Trader Joe's", category: "Food & Drink", categoryId: "food", amount: 84.10, date: "2026-04-24T21:14:00Z", isRecurring: false, isManual: false, isFlagged: false },
  { id: "txn_011", merchant: "Spotify", category: "Entertainment", categoryId: "entertainment", amount: 10.99, date: "2026-04-18T00:00:00Z", isRecurring: true, isManual: false, isFlagged: false },
  { id: "txn_012", merchant: "Lyft", category: "Transportation", categoryId: "transport", amount: 31.25, date: "2026-04-11T23:20:00Z", isRecurring: false, isManual: false, isFlagged: false },
  { id: "txn_013", merchant: "Landlord", category: "Housing", categoryId: "housing", amount: 1200, date: "2026-04-01T09:00:00Z", isRecurring: true, isManual: false, isFlagged: false },
  { id: "txn_014", merchant: "Sweetgreen", category: "Food & Drink", categoryId: "food", amount: 18.60, date: "2026-03-27T18:32:00Z", isRecurring: false, isManual: false, isFlagged: false },
  { id: "txn_015", merchant: "Campus Bookstore", category: "Education", categoryId: "education", amount: 28.00, date: "2026-03-20T14:05:00Z", isRecurring: false, isManual: false, isFlagged: false },
  { id: "txn_016", merchant: "AMC Theatres", category: "Entertainment", categoryId: "entertainment", amount: 27.50, date: "2026-03-15T02:18:00Z", isRecurring: false, isManual: false, isFlagged: false },
  { id: "txn_017", merchant: "CVS Pharmacy", category: "Health & Wellness", categoryId: "health", amount: 36.00, date: "2026-03-08T13:46:00Z", isRecurring: false, isManual: false, isFlagged: false },
  { id: "txn_018", merchant: "Landlord", category: "Housing", categoryId: "housing", amount: 1200, date: "2026-03-01T09:00:00Z", isRecurring: true, isManual: false, isFlagged: false },
];

// ─── Daily snapshot (Today tab) ──────────────────────────────────────────────
export interface DailySnapshot {
  spentToday: number;
  dailyBudget: number;
  topMerchant: string;
  topMerchantAmount: number;
  topMerchantPctOfBudget: number;
}

export const MOCK_DAILY_SNAPSHOT: DailySnapshot = {
  spentToday: 68,
  dailyBudget: 80,
  topMerchant: "Walmart",
  topMerchantAmount: 68,
  topMerchantPctOfBudget: 85,
};

// ─── Upcoming bills (Today tab) ──────────────────────────────────────────────
export interface UpcomingBill {
  id: string;
  merchant: string;
  amount: number;
  dueAt: string;       // ISO
  category: string;
  isCovered: boolean;
}

export const MOCK_UPCOMING_BILLS: UpcomingBill[] = [
  {
    id: "bill_rent",
    merchant: "Rent",
    amount: 1000,
    dueAt: new Date(Date.now() + 2 * 24 * 3600 * 1000).toISOString(),
    category: "Housing",
    isCovered: true,
  },
  {
    id: "bill_netflix",
    merchant: "Netflix",
    amount: 15.99,
    dueAt: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
    category: "Entertainment",
    isCovered: true,
  },
  {
    id: "bill_cc",
    merchant: "Credit Card Statement",
    amount: 258,
    dueAt: new Date(Date.now() + 2 * 24 * 3600 * 1000).toISOString(),
    category: "Debt Payments",
    isCovered: false,
  },
];

// ─── Investments (Budget tab) ────────────────────────────────────────────────
export interface InvestmentHolding {
  id: string;
  ticker: string;
  name: string;
  value: number;
  shares: number;
  changePct: number;
}

export const MOCK_HOLDINGS: InvestmentHolding[] = [
  { id: "h_voo", ticker: "VOO", name: "S&P 500 ETF", value: 2800, shares: 6.4, changePct: 3.21 },
  { id: "h_aapl", ticker: "AAPL", name: "Apple Inc.", value: 1100, shares: 5, changePct: -0.8 },
  { id: "h_btc", ticker: "BTC", name: "Bitcoin", value: 680, shares: 0.012, changePct: 7.1 },
];

export const MOCK_INVESTMENT_SUMMARY = {
  totalValue: MOCK_HOLDINGS.reduce((s, h) => s + h.value, 0),
};

// ─── Accounts (Budget tab) ───────────────────────────────────────────────────
export interface AccountSummary {
  id: string;
  name: string;
  kind: "checking" | "savings" | "credit" | "investment";
  balance: number;       // signed — credit balances are stored as negative
  institution?: string;
}

export const MOCK_ACCOUNTS: AccountSummary[] = [
  { id: "acc_chk", name: "Checking", kind: "checking", balance: 6848, institution: "Chase" },
  { id: "acc_cc", name: "Credit Balance", kind: "credit", balance: -1050, institution: "Amex" },
  { id: "acc_sav", name: "Savings", kind: "savings", balance: 10100, institution: "Ally" },
  { id: "acc_inv", name: "Investments", kind: "investment", balance: 5000, institution: "Fidelity" },
];

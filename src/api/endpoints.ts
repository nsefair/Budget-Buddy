/**
 * API Endpoints — single source of truth for all route strings.
 *
 * RULE: Never hardcode a URL string anywhere else in the codebase.
 *       If a route changes on the backend, update it here only.
 *
 * CONVENTION: Group by feature, match the backend controller structure.
 * The backend engineer can reference this file to confirm route expectations.
 */

export const ENDPOINTS = {
  // ── Auth ────────────────────────────────────────────────────────────────────
  AUTH: {
    LOGIN: "/auth/login",
    REGISTER: "/auth/register",
    REFRESH: "/auth/refresh",
    LOGOUT: "/auth/logout",
    ME: "/auth/me",
    FORGOT_PASSWORD: "/auth/forgot-password",
    RESET_PASSWORD: "/auth/reset-password",
    VERIFY_EMAIL: "/auth/verify-email",
  },

  // ── User / Profile ──────────────────────────────────────────────────────────
  USER: {
    PROFILE: "/user/profile",
    UPDATE_PROFILE: "/user/profile",
    ONBOARDING: "/user/onboarding",
    PREFERENCES: "/user/preferences",
    STREAK: "/user/streak",
    XP: "/user/xp",
    SUBSCRIPTION: "/user/subscription",
    DELETE_ACCOUNT: "/user/account",
  },

  // ── Today / Dashboard ───────────────────────────────────────────────────────
  TODAY: {
    SUMMARY: "/today/summary",
    BUD_GREETING: "/today/bud-greeting",
    BUD_INSIGHT: "/today/bud-insight",
    SPENDING_SNAPSHOT: "/today/spending-snapshot",
    RECENT_TRANSACTIONS: "/today/transactions/recent",
    UPCOMING_BILLS: "/today/bills/upcoming",
  },

  // ── Budget ──────────────────────────────────────────────────────────────────
  BUDGET: {
    MONTHS: "/budget/months",
    OVERVIEW: "/budget/overview",
    CATEGORIES: "/budget/categories",
    CATEGORY_DETAIL: (id: string) => `/budget/categories/${id}`,
    UPDATE_CATEGORY_LIMIT: (id: string) => `/budget/categories/${id}/limit`,
    TRANSACTIONS: "/budget/transactions",
    TRANSACTION_DETAIL: (id: string) => `/budget/transactions/${id}`,
    MANUAL_ENTRY: "/budget/transactions/manual",
    MONTH_COMPARISON: "/budget/comparison",
  },

  // ── Goals ───────────────────────────────────────────────────────────────────
  GOALS: {
    LIST: "/goals",
    CREATE: "/goals",
    DETAIL: (id: string) => `/goals/${id}`,
    UPDATE: (id: string) => `/goals/${id}`,
    DELETE: (id: string) => `/goals/${id}`,
    CONTRIBUTE: (id: string) => `/goals/${id}/contribute`,
    MILESTONES: (id: string) => `/goals/${id}/milestones`,
  },

  // ── Quests ──────────────────────────────────────────────────────────────────
  QUESTS: {
    ACTIVE: "/quests/active",
    DETAIL: (id: string) => `/quests/${id}`,
    COMPLETE: (id: string) => `/quests/${id}/complete`,
    ALTERNATIVES: (id: string) => `/quests/${id}/alternatives`,
    LEAGUE: "/quests/league",
    LEADERBOARD: "/quests/league/leaderboard",
    SKILL_TREE: "/quests/skill-tree",
    BADGES: "/quests/badges",
    UNLOCK_NODE: (nodeId: string) => `/quests/skill-tree/${nodeId}/unlock`,
  },

  // ── Bud (AI) ────────────────────────────────────────────────────────────────
  BUD: {
    INSIGHT: "/bud/insight",
    ASK: "/bud/ask",
    SESSIONS: "/bud/sessions",
    SESSION_DETAIL: (id: string) => `/bud/sessions/${id}`,
    SESSION_COMPLETE: (id: string) => `/bud/sessions/${id}/complete`,
    WEEK_REVIEW: "/bud/week-review",
    MEMORY: "/bud/memory",
    UPDATE_MEMORY: "/bud/memory",
    SCENARIO: "/bud/scenario",
  },

  // ── Buds (Social) ───────────────────────────────────────────────────────────
  BUDS: {
    FEED: "/buds/feed",
    LEAGUE: "/buds/league",
    PROFILE: (id: string) => `/buds/profile/${id}`,
    FOLLOW: (id: string) => `/buds/${id}/follow`,
    UNFOLLOW: (id: string) => `/buds/${id}/unfollow`,
    FIST_BUMP: (postId: string) => `/buds/posts/${postId}/fist-bump`,
    DISCOVER: "/buds/discover",
    MY_BUDS: "/buds/following",
    FOLLOWERS: "/buds/followers",
    POST: "/buds/posts",
    REFERRAL: "/buds/referral",
    BLOCK: (id: string) => `/buds/${id}/block`,
    REPORT: (id: string) => `/buds/${id}/report`,
  },

  // ── Plaid (Bank connection) ──────────────────────────────────────────────────
  PLAID: {
    LINK_TOKEN: "/plaid/link-token",
    EXCHANGE: "/plaid/exchange",
    ACCOUNTS: "/plaid/accounts",
    SYNC: "/plaid/sync",
  },

  // ── Payments / Subscriptions ─────────────────────────────────────────────────
  PAYMENTS: {
    PLANS: "/payments/plans",
    SUBSCRIBE: "/payments/subscribe",
    CANCEL: "/payments/cancel",
    PORTAL: "/payments/portal",
    LIFETIME: "/payments/lifetime",
  },
} as const;

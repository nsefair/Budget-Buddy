/**
 * Auth Store (Zustand)
 *
 * Manages auth state and session. All API calls go through authService —
 * this store never imports from api/client or mock/ directly.
 *
 * Screens call: useAuthStore() to read state or trigger actions.
 * The underlying transport (mock vs real) is invisible to this store.
 */

import { create } from "zustand";
import { TokenStore, IS_MOCK } from "@/api/client";
import { authService, type LoginPayload, type RegisterPayload } from "@/services/authService";
import { MOCK_USER, MOCK_TOKEN } from "@/mock/user";
import type { IconName } from "@/components/Icon";

// ─── Types ────────────────────────────────────────────────────────────────────
// User is the normalised internal shape — screens always work with this,
// never with raw API response shapes.

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  avatar?: string;
  level: number;
  xp: number;
  xpToNextLevel: number;
  streak: number;
  streakBestEver: number;
  netWorth: number;
  financialHealthScore: number;
  subscriptionTier: "free" | "premium" | "elite";
  onboardingComplete: boolean;
  why: string;
  whyIcon: IconName;
  joinedAt: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  hasCompletedOnboarding: boolean;

  // Actions
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  restoreSession: () => Promise<void>;
  updateUser: (updates: Partial<User>) => void;
  setOnboardingComplete: () => Promise<void>;
}

// ─── Store ────────────────────────────────────────────────────────────────────
export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isLoading: true,
  isAuthenticated: false,
  hasCompletedOnboarding: false,

  login: async (payload) => {
    const { accessToken, refreshToken, user } = await authService.login(payload);
    await TokenStore.setAccess(accessToken);
    await TokenStore.setRefresh(refreshToken);
    set({
      user,
      token: accessToken,
      isAuthenticated: true,
      hasCompletedOnboarding: user.onboardingComplete,
    });
  },

  register: async (payload) => {
    const { accessToken, refreshToken, user } = await authService.register(payload);
    await TokenStore.setAccess(accessToken);
    await TokenStore.setRefresh(refreshToken);
    set({
      user,
      token: accessToken,
      isAuthenticated: true,
      hasCompletedOnboarding: false,
    });
  },

  logout: async () => {
    await authService.logout();
    await TokenStore.clearAll();
    set({ user: null, token: null, isAuthenticated: false, hasCompletedOnboarding: false });
  },

  restoreSession: async () => {
    set({ isLoading: true });

    // In mock/dev mode, boot straight into the app with the mock user.
    // Remove this block (or set EXPO_PUBLIC_USE_MOCK=false) to use the real API.
    if (IS_MOCK) {
      set({
        user: MOCK_USER,
        token: MOCK_TOKEN,
        isAuthenticated: true,
        hasCompletedOnboarding: MOCK_USER.onboardingComplete,
        isLoading: false,
      });
      return;
    }

    // Production path — validate the stored token against the real API.
    try {
      const token = await TokenStore.getAccess();
      if (!token) {
        set({ isLoading: false, isAuthenticated: false });
        return;
      }
      const user = await authService.getMe();
      if (user) {
        set({ user, token, isAuthenticated: true, hasCompletedOnboarding: user.onboardingComplete, isLoading: false });
      } else {
        await TokenStore.clearAll();
        set({ isLoading: false, isAuthenticated: false });
      }
    } catch {
      set({ isLoading: false, isAuthenticated: false });
    }
  },

  updateUser: (updates) => {
    const current = get().user;
    if (!current) return;
    set({ user: { ...current, ...updates } });
  },

  setOnboardingComplete: async () => {
    set({ hasCompletedOnboarding: true });
    get().updateUser({ onboardingComplete: true });
  },
}));

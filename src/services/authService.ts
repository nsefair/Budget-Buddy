/**
 * Auth Service
 *
 * All authentication calls go through here.
 * Screens and stores import from this file — never from api/client directly.
 *
 * TO SWITCH FROM MOCK → REAL:
 *   Set EXPO_PUBLIC_USE_MOCK=false in your .env file. Done.
 *
 * TO CHANGE AN ENDPOINT:
 *   Update ENDPOINTS.AUTH below. Nothing else in the app changes.
 *
 * TO CHANGE THE RESPONSE SHAPE:
 *   Update the AuthResponse type and the mapper at the bottom.
 *   Screens always receive a normalised User — they never see raw API shapes.
 */

import { api, apiClient, IS_MOCK } from "@/api/client";
import { ENDPOINTS } from "@/api/endpoints";
import { MOCK_USER, MOCK_TOKEN } from "@/mock/user";
import type { User } from "@/stores/authStore";
import type { IconName } from "@/components/Icon";

// ─── Request / Response types ─────────────────────────────────────────────────
// These match your ASP.NET Core API contracts.
// If the backend changes a field name, update the mapper below — screens are safe.

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

interface RawAuthResponse {
  accessToken: string;
  refreshToken: string;
  user: RawUser;
}

// Raw shape from the API — may differ from what screens expect
interface RawUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  emailVerified: boolean;
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
  /** Lucide icon name representing the user's why. */
  whyIcon: IconName;
  joinedAt: string;
}

// Normalise raw API user → internal User shape.
// If the API renames a field (e.g. xpToNextLevel → nextLevelXp),
// only this function needs updating.
function toUser(raw: RawUser): User {
  return {
    id: raw.id,
    firstName: raw.firstName,
    lastName: raw.lastName,
    email: raw.email,
    emailVerified: raw.emailVerified,
    avatar: raw.avatar,
    level: raw.level,
    xp: raw.xp,
    xpToNextLevel: raw.xpToNextLevel,
    streak: raw.streak,
    streakBestEver: raw.streakBestEver,
    netWorth: raw.netWorth,
    financialHealthScore: raw.financialHealthScore,
    subscriptionTier: raw.subscriptionTier,
    onboardingComplete: raw.onboardingComplete,
    why: raw.why,
    whyIcon: raw.whyIcon,
    joinedAt: raw.joinedAt,
  };
}

// ─── Service methods ──────────────────────────────────────────────────────────

export const authService = {
  login: async (payload: LoginPayload) => {
    if (IS_MOCK) {
      await new Promise((r) => setTimeout(r, 600));
      return { accessToken: MOCK_TOKEN, refreshToken: "mock_refresh", user: MOCK_USER };
    }
    const raw = await api.post<RawAuthResponse>(ENDPOINTS.AUTH.LOGIN, payload);
    return { ...raw, user: toUser(raw.user) };
  },

  register: async (payload: RegisterPayload) => {
    if (IS_MOCK) {
      await new Promise((r) => setTimeout(r, 600));
      return { accessToken: MOCK_TOKEN, refreshToken: "mock_refresh", user: MOCK_USER };
    }
    const raw = await api.post<RawAuthResponse>(ENDPOINTS.AUTH.REGISTER, payload);
    return { ...raw, user: toUser(raw.user) };
  },

  getMe: async (): Promise<User | null> => {
    if (IS_MOCK) return MOCK_USER;
    try {
      const raw = await api.get<RawUser>(ENDPOINTS.AUTH.ME);
      return toUser(raw);
    } catch {
      return null;
    }
  },

  logout: async () => {
    if (IS_MOCK) return;
    try {
      await api.post(ENDPOINTS.AUTH.LOGOUT);
    } catch {
      // Best-effort — always clear tokens regardless
    }
  },

  forgotPassword: async (email: string) => {
    if (IS_MOCK) return { message: "Reset link sent.", debugToken: "mock_reset_token" };
    return api.post<{ message: string; debugToken?: string }>(
      ENDPOINTS.AUTH.FORGOT_PASSWORD,
      { email }
    );
  },

  resetPassword: async (token: string, newPassword: string) => {
    if (IS_MOCK) return { message: "Password reset." };
    return api.post<{ message: string }>(ENDPOINTS.AUTH.RESET_PASSWORD, {
      token,
      newPassword,
    });
  },

  requestEmailVerification: async () => {
    if (IS_MOCK) return { message: "Verification email sent.", debugToken: "mock_verify_token" };
    return api.post<{ message: string; debugToken?: string }>(
      ENDPOINTS.AUTH.REQUEST_EMAIL_VERIFICATION
    );
  },

  verifyEmail: async (token: string) => {
    if (IS_MOCK) return { message: "Email verified." };
    return api.post<{ message: string }>(ENDPOINTS.AUTH.VERIFY_EMAIL, { token });
  },

  requestEmailChange: async (newEmail: string, password: string) => {
    if (IS_MOCK) return { message: "Confirmation email sent.", debugToken: "mock_email_token" };
    return api.post<{ message: string; debugToken?: string }>(ENDPOINTS.USER.CHANGE_EMAIL, {
      newEmail,
      password,
    });
  },

  confirmEmailChange: async (token: string) => {
    if (IS_MOCK) return { message: "Email changed." };
    return api.post<{ message: string }>(ENDPOINTS.AUTH.CONFIRM_EMAIL_CHANGE, { token });
  },

  updateProfile: async (payload: { firstName: string; lastName: string; why: string }) => {
    if (IS_MOCK) return { ...MOCK_USER, ...payload };
    const raw = await api.patch<RawUser>(ENDPOINTS.USER.UPDATE_PROFILE, payload);
    return toUser(raw);
  },

  changePassword: async (currentPassword: string, newPassword: string) => {
    if (IS_MOCK) return { message: "Password changed." };
    return api.post<{ message: string }>(ENDPOINTS.USER.CHANGE_PASSWORD, {
      currentPassword,
      newPassword,
    });
  },

  deleteAccount: async (password: string) => {
    if (IS_MOCK) return;
    await apiClient.delete(ENDPOINTS.USER.DELETE_ACCOUNT, { data: { password } });
  },
};

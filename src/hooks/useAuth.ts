/**
 * Auth selector hooks.
 *
 * Use these instead of calling useAuthStore() directly in screens.
 * They subscribe to ONLY the slices you need, so changing one piece of
 * auth state (e.g. xp) doesn't re-render screens that only care about user.firstName.
 *
 * Usage:
 *   const user = useUser();           // re-renders only when user object changes
 *   const isAuth = useIsAuthenticated();
 *   const { login, logout } = useAuthActions();
 */

import { useAuthStore } from "@/stores/authStore";
import { useShallow } from "zustand/react/shallow";

export const useUser = () => useAuthStore((s) => s.user);

export const useIsAuthenticated = () => useAuthStore((s) => s.isAuthenticated);

export const useHasOnboarded = () => useAuthStore((s) => s.hasCompletedOnboarding);

export const useAuthLoading = () => useAuthStore((s) => s.isLoading);

// Actions are stable references — useShallow prevents recreated-object re-renders.
export const useAuthActions = () =>
  useAuthStore(
    useShallow((s) => ({
      login: s.login,
      register: s.register,
      logout: s.logout,
      restoreSession: s.restoreSession,
      updateUser: s.updateUser,
      setOnboardingComplete: s.setOnboardingComplete,
    }))
  );

/**
 * Root index — pure router redirect.
 *
 * Anyone landing on `/` gets sent to the right place based on auth state.
 * This is the only file that decides "where does the app start?"
 */

import { Redirect } from "expo-router";
import {
  useHasKnownAccount,
  useHasOnboarded,
  useIsAuthenticated,
} from "@/hooks/useAuth";

export default function Index() {
  const isAuthenticated = useIsAuthenticated();
  const hasOnboarded = useHasOnboarded();
  const hasKnownAccount = useHasKnownAccount();

  if (!isAuthenticated) {
    return <Redirect href={hasKnownAccount ? "/(auth)/login" : "/(auth)/onboarding"} />;
  }
  if (!hasOnboarded) return <Redirect href="/(auth)/onboarding" />;
  return <Redirect href="/(tabs)/today" />;
}

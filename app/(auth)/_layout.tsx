/**
 * Auth Group Layout
 *
 * Guards the auth flow: if a logged-in user lands here, kick them to the right place.
 * Uses selector hooks for performance.
 */

import { Stack, Redirect } from "expo-router";
import { useIsAuthenticated, useHasOnboarded } from "@/hooks/useAuth";
import { Colors } from "@/constants/colors";

export default function AuthLayout() {
  const isAuthenticated = useIsAuthenticated();
  const hasOnboarded = useHasOnboarded();

  if (isAuthenticated && hasOnboarded) {
    return <Redirect href="/(tabs)/today" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "fade",
        contentStyle: { backgroundColor: Colors.navy },
      }}
    >
      <Stack.Screen name="welcome" />
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen
        name="onboarding"
        options={{ animation: "slide_from_right", gestureEnabled: false }}
      />
    </Stack>
  );
}

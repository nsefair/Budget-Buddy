/**
 * Tabs Group Layout
 *
 * Guards the main app: if logged out, send to welcome.
 * If onboarding incomplete, send there.
 * Custom tab bar comes from src/components/TabBar.tsx
 */

import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { Tabs, Redirect } from "expo-router";
import type { BottomTabBarProps } from "expo-router/js-tabs";
import { useIsAuthenticated, useHasOnboarded } from "@/hooks/useAuth";
import { CustomTabBar } from "@/components/TabBar";
import { eventsService } from "@/services/eventsService";

// Beta metric: every open, on launch and on each return from the background
// (not when Control Center or a notification briefly covers the app).
function useAppOpenEvent(enabled: boolean) {
  const lastState = useRef(AppState.currentState);
  useEffect(() => {
    if (!enabled) return;
    eventsService.log("app_open");
    const subscription = AppState.addEventListener("change", (next) => {
      if (lastState.current === "background" && next === "active") eventsService.log("app_open");
      lastState.current = next;
    });
    return () => subscription.remove();
  }, [enabled]);
}

export default function TabsLayout() {
  const isAuthenticated = useIsAuthenticated();
  const hasOnboarded = useHasOnboarded();
  useAppOpenEvent(isAuthenticated && hasOnboarded);

  if (!isAuthenticated) return <Redirect href="/(auth)/welcome" />;
  if (!hasOnboarded) return <Redirect href="/(auth)/onboarding" />;

  return (
    <Tabs
      tabBar={(props: BottomTabBarProps) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tabs.Screen name="today" options={{ title: "Today", tabBarLabel: "Today" }} />
      <Tabs.Screen name="budget" options={{ title: "Budget", tabBarLabel: "Budget" }} />
      <Tabs.Screen name="bud" options={{ title: "Bud", tabBarLabel: "Bud" }} />
      <Tabs.Screen name="quests" options={{ title: "Quests", tabBarLabel: "Quests" }} />
      <Tabs.Screen name="goals" options={{ title: "Goals", tabBarLabel: "Goals" }} />
      <Tabs.Screen
        name="buds"
        options={{ title: "Buds", tabBarLabel: "Buds", href: null }}
      />
    </Tabs>
  );
}

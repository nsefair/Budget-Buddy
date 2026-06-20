/**
 * Tabs Group Layout
 *
 * Guards the main app: if logged out, send to welcome.
 * If onboarding incomplete, send there.
 * Custom tab bar comes from src/components/TabBar.tsx
 */

import { Tabs, Redirect } from "expo-router";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useIsAuthenticated, useHasOnboarded } from "@/hooks/useAuth";
import { CustomTabBar } from "@/components/TabBar";

export default function TabsLayout() {
  const isAuthenticated = useIsAuthenticated();
  const hasOnboarded = useHasOnboarded();

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
      <Tabs.Screen name="goals" options={{ title: "Quests", tabBarLabel: "Quests" }} />
      <Tabs.Screen name="buds" options={{ title: "Buds", tabBarLabel: "Buds" }} />
    </Tabs>
  );
}

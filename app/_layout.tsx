/**
 * Root Layout
 *
 * Bootstraps the entire app:
 *   1. Loads Inter fonts
 *   2. Restores auth session (mock or real, transparent to this file)
 *   3. Wraps everything in providers (gestures, safe area, react-query)
 *   4. Catches any unhandled error with the ErrorBoundary
 *
 * This file should never need to change when integrating the real backend —
 * IS_MOCK / restoreSession lives in the service layer, not here.
 */

import "../global.css";
import React, { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useColorScheme } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from "@expo-google-fonts/inter";
import * as SplashScreen from "expo-splash-screen";
import { QueryProvider } from "@/providers/QueryProvider";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AppSplash } from "@/components/AppSplash";
import { useAuthLoading, useAuthActions } from "@/hooks/useAuth";
import { Colors } from "@/constants/colors";
import { useNotificationObserver } from "@/services/notificationService";

SplashScreen.preventAutoHideAsync().catch(() => {
  // Splash may already be hidden in dev hot-reload — safe to ignore
});

// Dependency-level console noise is filtered in src/utils/suppressConsole.ts,
// which runs from index.ts before expo-router loads.

export default function RootLayout() {
	useNotificationObserver();
  const isLoading = useAuthLoading();
  const { restoreSession } = useAuthActions();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  useEffect(() => {
    if (fontsLoaded && !isLoading) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, isLoading]);

  // Show branded splash instead of a white flash
  if (!fontsLoaded || isLoading) return <AppSplash />;

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <QueryProvider>
            <StatusBar
              style={isDark ? "light" : "dark"}
              backgroundColor={Colors.surface}
            />
            <Stack screenOptions={{ headerShown: false, animation: "fade" }}>
              <Stack.Screen name="index" options={{ headerShown: false }} />
              <Stack.Screen name="(auth)" options={{ headerShown: false }} />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen
                name="profile"
                options={{ headerShown: false, presentation: "modal", animation: "slide_from_bottom" }}
              />
              <Stack.Screen
                name="goal/[id]"
                options={{ headerShown: false, animation: "slide_from_right" }}
              />
              <Stack.Screen
                name="goal-action"
                options={{ headerShown: false, animation: "slide_from_right" }}
              />
              <Stack.Screen
                name="settings/[section]"
                options={{ headerShown: false, animation: "slide_from_right" }}
              />
              <Stack.Screen
                name="buds/profile/[id]"
                options={{ headerShown: false, animation: "slide_from_right" }}
              />
              <Stack.Screen
                name="buds/list"
                options={{ headerShown: false, animation: "slide_from_right" }}
              />
              <Stack.Screen
                name="buds/invite"
                options={{ headerShown: false, animation: "slide_from_right" }}
              />
              <Stack.Screen
                name="buds/league"
                options={{ headerShown: false, animation: "slide_from_right" }}
              />
            </Stack>
          </QueryProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}

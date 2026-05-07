/**
 * OnboardingShell — the consistent chrome around every onboarding step.
 *
 * Provides:
 *   • Branded gradient background
 *   • Progress dots (per-step) + current/total label
 *   • Optional back button
 *   • Safe-area aware padding
 *   • Slide-in transition when the step index changes
 *
 * Each step renders its own content as children. The shell never
 * decides UI per step — it stays content-agnostic.
 */

import React, { ReactNode, useEffect, useRef } from "react";
import {
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { Colors } from "@/constants/colors";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface Props {
  step: number;
  totalSteps: number;
  onBack?: () => void;
  /** Hide the progress dots + step label (used for terminal celebration screens) */
  hideProgress?: boolean;
  /** Pull content closer to top (used for hero screens with big illustration) */
  centerContent?: boolean;
  children: ReactNode;
  /** Sticky CTA area pinned to bottom (above safe area) */
  footer?: ReactNode;
}

export function OnboardingShell({
  step,
  totalSteps,
  onBack,
  hideProgress,
  centerContent,
  children,
  footer,
}: Props) {
  const insets = useSafeAreaInsets();

  // Slide-in transition each time `step` changes — gives the conversation feel
  const slide = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    slide.setValue(SCREEN_WIDTH * 0.06);
    Animated.timing(slide, {
      toValue: 0,
      duration: 320,
      useNativeDriver: true,
    }).start();
  }, [step, slide]);

  return (
    <LinearGradient
      colors={[Colors.navy800, Colors.navy600]}
      style={{ flex: 1 }}
    >
      {/* Top bar — back + progress */}
      <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
        <View style={styles.backSlot}>
          {onBack && (
            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                onBack();
              }}
              style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.5 }]}
              hitSlop={12}
            >
              <Text style={styles.backArrow}>←</Text>
            </Pressable>
          )}
        </View>

        {!hideProgress && (
          <View style={styles.progressWrap}>
            <ProgressDots step={step} total={totalSteps} />
          </View>
        )}

        <View style={styles.backSlot} />
      </View>

      {/* Content */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Animated.View
          style={{
            flex: 1,
            transform: [{ translateX: slide }],
            opacity: slide.interpolate({
              inputRange: [0, SCREEN_WIDTH * 0.06],
              outputRange: [1, 0.6],
            }),
          }}
        >
          <ScrollView
            contentContainerStyle={[
              styles.content,
              centerContent && styles.contentCentered,
              { paddingBottom: 24 },
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
        </Animated.View>

        {footer && (
          <View
            style={[
              styles.footer,
              { paddingBottom: Math.max(insets.bottom, 12) + 8 },
            ]}
          >
            {footer}
          </View>
        )}
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

// ─── Progress dots ──────────────────────────────────────────────────────────

function ProgressDots({ step, total }: { step: number; total: number }) {
  return (
    <View style={styles.dots}>
      {Array.from({ length: total }).map((_, i) => {
        const isActive = i === step;
        const isPast = i < step;
        return (
          <View
            key={i}
            style={[
              styles.dot,
              isActive && styles.dotActive,
              isPast && styles.dotPast,
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  backSlot: { width: 44, alignItems: "flex-start", justifyContent: "center" },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  backArrow: { fontSize: 18, color: "#FFF", fontWeight: "600", marginTop: -1 },

  progressWrap: { flex: 1, alignItems: "center" },
  dots: { flexDirection: "row", gap: 6 },
  dot: {
    width: 22,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  dotActive: { backgroundColor: Colors.gold, width: 28 },
  dotPast: { backgroundColor: "rgba(244,168,50,0.45)" },

  content: { paddingHorizontal: 24, paddingTop: 16, flexGrow: 1 },
  contentCentered: { justifyContent: "center" },

  footer: {
    paddingHorizontal: 24,
    paddingTop: 12,
    backgroundColor: "transparent",
  },
});

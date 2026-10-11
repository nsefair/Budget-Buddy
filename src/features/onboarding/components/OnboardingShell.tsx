/**
 * OnboardingShell — the consistent chrome around every onboarding step.
 *
 * Provides:
 *   • Calm surface with a soft brand glow (matches Bud)
 *   • Segmented progress; the current segment fills in on each step
 *   • Optional back button
 *   • Safe-area aware padding
 *   • Slide-in transition that follows the direction of travel
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
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { GrowBar, useReducedMotion } from "@/animations";
import { Motion } from "@/constants/tokens";

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

  // Slide-in + cross-fade each time `step` changes, from the side the user is
  // heading toward. Reduce Motion users get a static swap.
  const reducedMotion = useReducedMotion();
  const slide = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(1)).current;
  const previousStep = useRef(step);

  useEffect(() => {
    const direction = step < previousStep.current ? -1 : 1;
    previousStep.current = step;
    if (reducedMotion) {
      slide.setValue(0);
      fade.setValue(1);
      return;
    }
    slide.setValue(SCREEN_WIDTH * 0.08 * direction);
    fade.setValue(0);
    Animated.parallel([
      Animated.timing(slide, {
        toValue: 0,
        duration: Motion.slow,
        useNativeDriver: true,
      }),
      Animated.timing(fade, {
        toValue: 1,
        duration: Motion.slow,
        useNativeDriver: true,
      }),
    ]).start();
  }, [step, reducedMotion, slide, fade]);

  return (
    <View style={styles.page}>
      <LinearGradient
        pointerEvents="none"
        colors={[Colors.accentAlpha14, Colors.accentAlpha05, "transparent"]}
        style={styles.glow}
      />
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
              <Icon name="arrow-left" size={18} color={Colors.navy} strokeWidth={2.4} />
            </Pressable>
          )}
        </View>

        {!hideProgress && (
          <View style={styles.progressWrap}>
            <ProgressSegments step={step} total={totalSteps} />
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
            opacity: fade,
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
    </View>
  );
}

// ─── Progress segments ──────────────────────────────────────────────────────

function ProgressSegments({ step, total }: { step: number; total: number }) {
  return (
    <View
      style={styles.segments}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`Step ${step + 1} of ${total}`}
    >
      {Array.from({ length: total }).map((_, i) => (
        <GrowBar
          key={i}
          progress={i <= step ? 1 : 0}
          color={Colors.gold}
          trackColor={Colors.navy100}
          height={3}
          duration={i === step ? 520 : 0}
          style={styles.segment}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: Colors.surface },
  glow: { position: "absolute", top: 0, left: 0, right: 0, height: 380 },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 8,
    zIndex: 2,
  },
  backSlot: { width: 44, alignItems: "flex-start", justifyContent: "center" },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },

  progressWrap: { flex: 1, paddingHorizontal: 8 },
  segments: { flexDirection: "row", gap: 4 },
  segment: { flex: 1 },

  content: { paddingHorizontal: 24, paddingTop: 16, flexGrow: 1, zIndex: 1 },
  contentCentered: { justifyContent: "center" },

  footer: {
    paddingHorizontal: 24,
    paddingTop: 12,
    backgroundColor: "transparent",
    zIndex: 2,
  },
});

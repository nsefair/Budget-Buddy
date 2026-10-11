/**
 * GradientHeader — the shared calm header for top-level tabs.
 *
 * Matches Bud: the page surface with a soft brand glow, a small mark +
 * eyebrow, and a large title. Budget, Goals, and Quests use it so the tabs
 * read as one design language.
 */

import React from "react";
import { StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BrandLogo } from "@/components/BrandLogo";
import { Colors } from "@/constants/colors";
import { Spacing, Type } from "@/constants/tokens";

interface GradientHeaderProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function GradientHeader({
  eyebrow,
  title,
  subtitle,
  right,
  style,
}: GradientHeaderProps) {
  const insets = useSafeAreaInsets();
  // Skip an eyebrow that only repeats the title ("GOALS" above "Goals").
  const showEyebrow = Boolean(eyebrow) && eyebrow!.toLowerCase() !== title.toLowerCase();

  return (
    <View style={[styles.header, { paddingTop: insets.top + 12 }, style]}>
      <LinearGradient
        pointerEvents="none"
        colors={[Colors.accentAlpha14, Colors.accentAlpha05, "transparent"]}
        style={styles.glow}
      />
      <View style={styles.brandRow}>
        <BrandLogo variant="mark" markSize={26} />
        {showEyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
      </View>
      <View style={styles.row}>
        <View style={styles.left}>
          <Text style={styles.title} accessibilityRole="header" maxFontSizeMultiplier={1.3}>
            {title}
          </Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {right ? <View style={styles.right}>{right}</View> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  glow: { position: "absolute", top: 0, left: 0, right: 0, height: 360 },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 22 },
  eyebrow: { ...Type.eyebrow, fontSize: 10, color: Colors.muted },
  row: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: Spacing.sm,
  },
  left: { flex: 1 },
  right: { paddingBottom: 4 },
  title: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: "800",
    letterSpacing: -0.8,
    color: Colors.navy,
  },
  subtitle: { ...Type.body, marginTop: 4, color: Colors.muted },
});

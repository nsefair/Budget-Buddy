/**
 * GradientHeader — the shared dark brand header for top-level tabs.
 *
 * Today, Bud, and Buds established the pattern (brand gradient, centered
 * wordmark, on-dark title row). Budget and Quests use this component so all
 * five tabs read as one design language.
 */

import React from "react";
import { StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BrandHeader } from "@/components/BrandLogo";
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

  return (
    <LinearGradient
      colors={[Colors.brandGradientStart, Colors.brandGradientMid]}
      style={[styles.header, { paddingTop: insets.top + 12 }, style]}
    >
      <BrandHeader dark style={styles.brand} />
      <View style={styles.row}>
        <View style={styles.left}>
          {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
          <Text style={styles.title} accessibilityRole="header" maxFontSizeMultiplier={1.4}>
            {title}
          </Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {right ? <View style={styles.right}>{right}</View> : null}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  brand: { marginBottom: Spacing.sm },
  row: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: Spacing.sm,
  },
  left: { flex: 1 },
  right: { paddingBottom: 2 },
  eyebrow: {
    ...Type.eyebrow,
    color: Colors.gold,
    marginBottom: 5,
  },
  title: {
    ...Type.h1,
    color: Colors.brandOnDark,
  },
  subtitle: {
    ...Type.caption,
    color: Colors.brandOnDarkMuted,
    marginTop: 4,
  },
});

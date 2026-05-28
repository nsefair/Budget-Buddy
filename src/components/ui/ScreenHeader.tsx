/**
 * ScreenHeader — the eyebrow + title pattern repeated on every tab.
 *
 * Standardizes spacing, type weight and contrast so screens feel related.
 * Use at the top of any tab/screen body.
 */

import React from "react";
import { StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";

import { Colors } from "@/constants/colors";
import { Spacing, Type } from "@/constants/tokens";

interface ScreenHeaderProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function ScreenHeader({
  eyebrow,
  title,
  subtitle,
  right,
  style,
}: ScreenHeaderProps) {
  return (
    <View style={[styles.row, style]}>
      <View style={styles.left}>
        {eyebrow ? (
          <Text style={styles.eyebrow} accessibilityRole="text">
            {eyebrow}
          </Text>
        ) : null}
        <Text
          style={styles.title}
          accessibilityRole="header"
          maxFontSizeMultiplier={1.4}
        >
          {title}
        </Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  left: { flex: 1 },
  right: { paddingBottom: 2 },
  eyebrow: {
    ...Type.eyebrow,
    color: Colors.gold,
    marginBottom: 6,
  },
  title: {
    ...Type.display,
    color: Colors.navy,
  },
  subtitle: {
    ...Type.caption,
    color: Colors.muted,
    marginTop: 6,
  },
});

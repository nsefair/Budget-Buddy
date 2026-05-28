/**
 * Card — consistent surface for content groups.
 *
 * Replaces dozens of inline `{ backgroundColor: Colors.card, borderRadius: 16, ... }`
 * blocks so every card across the app shares the same rhythm and shadow.
 *
 * Variants:
 *   default — light surface, sm shadow (most common)
 *   raised  — md shadow for emphasis (hero stats, primary CTA group)
 *   subtle  — no shadow, just border (nested cards / quiet groupings)
 */

import React from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";

import { Colors } from "@/constants/colors";
import { Radius, Shadow, Spacing } from "@/constants/tokens";

type CardVariant = "default" | "raised" | "subtle";

interface CardProps {
  variant?: CardVariant;
  padding?: keyof typeof Spacing | number;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

export function Card({
  variant = "default",
  padding = "md",
  style,
  children,
}: CardProps) {
  const padValue =
    typeof padding === "number" ? padding : Spacing[padding];

  return (
    <View
      style={[
        styles.base,
        { padding: padValue },
        variant === "raised" && Shadow.md,
        variant === "default" && Shadow.sm,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
});

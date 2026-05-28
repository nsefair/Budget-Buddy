/**
 * EmptyState — friendly placeholder shown when a list/section has no data.
 *
 * Voice rule (Dev Review §02): never shame, never tell the user "no data
 * available". Always reframe as something positive in progress.
 */

import React from "react";
import { StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";

import { Colors } from "@/constants/colors";
import { Icon, type IconName } from "@/components/Icon";
import { Radius, Spacing, Type } from "@/constants/tokens";

interface EmptyStateProps {
  icon?: IconName;
  title: string;
  body?: string;
  style?: StyleProp<ViewStyle>;
}

export function EmptyState({
  icon = "sparkles",
  title,
  body,
  style,
}: EmptyStateProps) {
  return (
    <View style={[styles.box, style]} accessibilityRole="summary">
      <View style={styles.iconWrap}>
        <Icon name={icon} size={20} color={Colors.gold} strokeWidth={2.2} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {body ? <Text style={styles.body}>{body}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    alignItems: "center",
    backgroundColor: Colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    gap: Spacing.sm,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.accentAlpha10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.accentAlpha20,
    marginBottom: Spacing.xxs,
  },
  title: {
    ...Type.h3,
    color: Colors.navy,
    textAlign: "center",
  },
  body: {
    ...Type.body,
    color: Colors.muted,
    textAlign: "center",
  },
});

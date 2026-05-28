/**
 * SectionHeader — title + optional action link used inside scroll content.
 *
 * Pairs with Card to give every "Recent transactions / Goals / Bills" section
 * the same rhythm.
 */

import React from "react";
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import * as Haptics from "expo-haptics";

import { Colors } from "@/constants/colors";
import { Motion, Spacing, Type } from "@/constants/tokens";

interface SectionHeaderProps {
  title: string;
  hint?: string;
  action?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
}

export function SectionHeader({
  title,
  hint,
  action,
  onAction,
  style,
}: SectionHeaderProps) {
  return (
    <View style={[styles.row, style]}>
      <View style={styles.left}>
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
      {action && onAction ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${action}, ${title}`}
          onPress={() => {
            Haptics.selectionAsync();
            onAction();
          }}
          style={({ pressed }) => [
            styles.action,
            pressed && { opacity: 0.6 },
          ]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.actionText}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  left: { flex: 1 },
  title: {
    ...Type.h3,
    color: Colors.navy,
  },
  hint: {
    ...Type.caption,
    color: Colors.muted,
    marginTop: 2,
  },
  action: {
    paddingVertical: 4,
    paddingHorizontal: 4,
    // CSS-equivalent of `transition: opacity 150ms`
    // (RN handles via Pressable's pressed state)
    minHeight: 32,
    justifyContent: "center",
  },
  actionText: {
    ...Type.bodyStrong,
    color: Colors.gold,
  },
});

export { Motion as _SectionHeaderMotion };

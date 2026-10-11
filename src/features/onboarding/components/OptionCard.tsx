/**
 * OptionCard — selectable row used by goal / why / situation / age screens.
 *
 * Onboarding is built with cards, not selects, and never with emojis — every
 * visual is a Lucide icon set against a tinted tile.
 *
 * Motion:
 *   • Rows cascade in by `index` when a step appears.
 *   • Press: gentle scale-down + spring back.
 *   • Selected: the row inverts to solid ink with an accent check.
 *   Colors switch as plain styles (never animated), which keeps adaptive
 *   colors away from Reanimated/Moti. Honors Reduce Motion.
 */

import React from "react";
import { StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";

import { FadeInUp, PressableScale } from "@/animations";
import { Icon, type IconName } from "@/components/Icon";
import { Colors } from "@/constants/colors";
import { Radius, Spacing } from "@/constants/tokens";

interface Props {
  icon?: IconName;
  label: string;
  sub?: string;
  selected: boolean;
  onPress: () => void;
  /** Compact = no sub, smaller padding (used for age/situation pickers) */
  compact?: boolean;
  /** Position in its list, for the cascade-in entrance. */
  index?: number;
}

export function OptionCard({
  icon,
  label,
  sub,
  selected,
  onPress,
  compact,
  index = 0,
}: Props) {
  const handlePress = () => {
    Haptics.selectionAsync();
    onPress();
  };

  return (
    <FadeInUp delay={220 + index * 55} distance={10}>
      <PressableScale
        scaleTo={0.98}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        accessibilityLabel={sub && !compact ? `${label}. ${sub}` : label}
        onPress={handlePress}
      >
        <View style={[styles.card, compact && styles.cardCompact, selected && styles.cardSelected]}>
          {icon ? (
            <View
              style={[
                styles.iconBox,
                compact && styles.iconBoxCompact,
                selected && styles.iconBoxSelected,
              ]}
            >
              <Icon
                name={icon}
                size={compact ? 14 : 17}
                color={selected ? Colors.onAccent : Colors.gold}
                strokeWidth={2.4}
              />
            </View>
          ) : null}

          <View style={styles.copy}>
            <Text
              style={[styles.label, selected && styles.labelSelected]}
              maxFontSizeMultiplier={1.4}
            >
              {label}
            </Text>
            {sub && !compact ? (
              <Text style={[styles.sub, selected && styles.subSelected]}>{sub}</Text>
            ) : null}
          </View>

          <View style={[styles.check, selected && styles.checkSelected]}>
            {selected ? (
              <Icon name="check" size={12} color={Colors.onAccent} strokeWidth={3} />
            ) : null}
          </View>
        </View>
      </PressableScale>
    </FadeInUp>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    minHeight: 56,
    paddingHorizontal: Spacing.md - 2,
    paddingVertical: 12,
    borderRadius: Radius.lg,
    backgroundColor: Colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  cardCompact: { minHeight: 48, paddingVertical: 10 },
  // Inverted: ink row on light, light row on dark.
  cardSelected: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.accentAlpha12,
  },
  iconBoxCompact: { width: 28, height: 28, borderRadius: 8 },
  iconBoxSelected: { backgroundColor: Colors.gold },
  copy: { flex: 1 },
  label: { fontSize: 15, fontWeight: "700", color: Colors.navy },
  labelSelected: { color: Colors.card },
  sub: { fontSize: 12, lineHeight: 17, marginTop: 2, color: Colors.muted },
  subSelected: { color: Colors.navy200 },
  check: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  checkSelected: { backgroundColor: Colors.gold, borderColor: Colors.gold },
});

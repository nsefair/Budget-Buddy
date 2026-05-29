/**
 * OptionCard — selectable card used by goal / why / situation / age screens.
 *
 * Onboarding is built with cards, not selects, and never with emojis — every
 * visual is a Lucide icon set against a tinted tile.
 *
 * Motion (Moti / Reanimated):
 *   • Press: gentle scale-down + spring back.
 *   • Selected: card lifts a little, border + bg fade to accent, icon tile
 *     morphs (soft → solid), check pops in with rotation, ring pulses once.
 *   • Honors AccessibilityInfo.isReduceMotionEnabled().
 */

import React, { useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { MotiView } from "moti";

import { Icon, type IconName } from "@/components/Icon";
import { Colors } from "@/constants/colors";
import { Radius, Spacing } from "@/constants/tokens";
import { useReducedMotion } from "@/animations";

interface Props {
  icon?: IconName;
  label: string;
  sub?: string;
  selected: boolean;
  onPress: () => void;
  /** Compact = no sub, smaller padding (used for age/situation pickers) */
  compact?: boolean;
}

export function OptionCard({
  icon,
  label,
  sub,
  selected,
  onPress,
  compact,
}: Props) {
  const reduced = useReducedMotion();
  // Track press separately from selected so they compose.
  const [pressed, setPressed] = React.useState(false);
  // Bump counter — increments every time `selected` becomes true so we can
  // replay the ring pulse on each fresh selection.
  const bumpKey = useRef(0);
  if (selected) {
    bumpKey.current = bumpKey.current; // no-op; just keeps the ref live
  }

  const handlePress = () => {
    Haptics.selectionAsync();
    onPress();
  };

  const baseTransition = { type: "timing" as const, duration: 220 };
  const springTransition = { type: "spring" as const, damping: 16, stiffness: 220 };

  return (
    <MotiView
      animate={{
        scale: reduced ? 1 : pressed ? 0.97 : 1,
      }}
      transition={reduced ? { duration: 0 } : springTransition}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected }}
        accessibilityLabel={label}
        onPress={handlePress}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
      >
        <MotiView
          animate={{
            borderColor: selected ? Colors.gold : Colors.accentAlpha20,
            backgroundColor: selected
              ? Colors.accentAlpha15
              : Colors.accentAlpha05,
            translateY: selected && !reduced ? -1 : 0,
          }}
          transition={reduced ? { duration: 0 } : baseTransition}
          style={[styles.card, compact && styles.cardCompact]}
        >
          {/* Subtle ring pulse on the icon tile when freshly selected */}
          {icon && (
            <View style={styles.iconWrap}>
              {selected && !reduced && (
                <MotiView
                  key={`ring-${label}`}
                  from={{ opacity: 0.55, scale: 1 }}
                  animate={{ opacity: 0, scale: 1.45 }}
                  transition={{ type: "timing", duration: 600 }}
                  style={[
                    styles.ring,
                    compact ? styles.ringCompact : null,
                  ]}
                />
              )}
              <MotiView
                animate={{
                  backgroundColor: selected
                    ? Colors.gold
                    : Colors.accentAlpha12,
                  borderColor: selected
                    ? Colors.gold
                    : Colors.accentAlpha30,
                  scale: selected && !reduced ? 1.04 : 1,
                }}
                transition={reduced ? { duration: 0 } : baseTransition}
                style={[styles.iconBox, compact && styles.iconBoxCompact]}
              >
                <Icon
                  name={icon}
                  size={compact ? 14 : 18}
                  color={selected ? Colors.onAccent : Colors.gold}
                  strokeWidth={2.4}
                />
              </MotiView>
            </View>
          )}

          <View style={{ flex: 1 }}>
            <MotiView
              animate={{ translateX: selected && !reduced ? 2 : 0 }}
              transition={reduced ? { duration: 0 } : baseTransition}
            >
              <Text
                style={[styles.label, selected && styles.labelSelected]}
                maxFontSizeMultiplier={1.4}
              >
                {label}
              </Text>
              {sub && !compact ? (
                <Text style={styles.sub}>{sub}</Text>
              ) : null}
            </MotiView>
          </View>

          {/* Check chip — spring + rotate when it appears */}
          <MotiView
            animate={{
              backgroundColor: selected ? Colors.gold : "transparent",
              borderColor: selected ? Colors.gold : Colors.border,
            }}
            transition={reduced ? { duration: 0 } : baseTransition}
            style={styles.check}
          >
            <MotiView
              animate={{
                scale: selected ? 1 : 0,
                rotate: selected ? "0deg" : "-60deg",
                opacity: selected ? 1 : 0,
              }}
              transition={
                reduced
                  ? { duration: 0 }
                  : { type: "spring", damping: 12, stiffness: 320 }
              }
            >
              <Icon name="check" size={12} color={Colors.onAccent} strokeWidth={3} />
            </MotiView>
          </MotiView>
        </MotiView>
      </Pressable>
    </MotiView>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm + 2,
    borderWidth: 1.5,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md - 2,
    paddingVertical: 13,
  },
  cardCompact: { paddingVertical: 11 },
  iconWrap: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBoxCompact: { width: 28, height: 28, borderRadius: 8 },
  ring: {
    position: "absolute",
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.gold,
  },
  ringCompact: {
    width: 28,
    height: 28,
    borderRadius: 8,
  },
  label: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.navy,
    letterSpacing: 0,
  },
  labelSelected: { color: Colors.gold },
  sub: {
    fontSize: 12,
    color: Colors.muted,
    marginTop: 2,
    lineHeight: 17,
  },
  check: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
});

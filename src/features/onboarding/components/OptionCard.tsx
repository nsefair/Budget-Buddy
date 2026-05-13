/**
 * OptionCard — selectable card used by goal / why / situation / age screens.
 *
 * Per the design mandate, onboarding is built with cards, not selects, and
 * never with emojis — every visual is a Lucide icon set against a tinted tile.
 */

import React, { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { Icon, type IconName } from "@/components/Icon";
import { Colors } from "@/constants/colors";

interface Props {
  icon?: IconName;
  label: string;
  sub?: string;
  selected: boolean;
  onPress: () => void;
  /** Compact = no sub, smaller padding (used for age/situation pickers) */
  compact?: boolean;
}

export function OptionCard({ icon, label, sub, selected, onPress, compact }: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  const borderAnim = useRef(new Animated.Value(selected ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(borderAnim, {
      toValue: selected ? 1 : 0,
      damping: 18,
      stiffness: 220,
      useNativeDriver: false,
    }).start();
  }, [selected, borderAnim]);

  const handlePress = () => {
    Haptics.selectionAsync();
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.97, duration: 80, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, damping: 12, stiffness: 260, useNativeDriver: true }),
    ]).start();
    onPress();
  };

  const borderColor = borderAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["rgba(255,255,255,0.08)", Colors.gold],
  });

  const bgColor = borderAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["rgba(255,255,255,0.04)", "rgba(244,168,50,0.10)"],
  });

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable onPress={handlePress}>
        <Animated.View
          style={[
            styles.card,
            compact && styles.cardCompact,
            { borderColor, backgroundColor: bgColor },
          ]}
        >
          {icon && (
            <View
              style={[
                styles.iconBox,
                compact && styles.iconBoxCompact,
                selected && styles.iconBoxSelected,
              ]}
            >
              <Icon
                name={icon}
                size={compact ? 14 : 18}
                color={selected ? Colors.navy : Colors.gold}
                strokeWidth={2.4}
              />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={[styles.label, selected && styles.labelSelected]}>
              {label}
            </Text>
            {sub && !compact && <Text style={styles.sub}>{sub}</Text>}
          </View>
          <View style={[styles.check, selected && styles.checkActive]}>
            {selected && <Icon name="check" size={12} color={Colors.navy} strokeWidth={3} />}
          </View>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderWidth: 1.5,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  cardCompact: { paddingVertical: 11 },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(244,168,50,0.12)",
    borderWidth: 1,
    borderColor: "rgba(244,168,50,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  iconBoxCompact: { width: 28, height: 28, borderRadius: 8 },
  iconBoxSelected: {
    backgroundColor: Colors.gold,
    borderColor: Colors.gold,
  },
  label: { fontSize: 15, fontWeight: "700", color: "#FFF", letterSpacing: 0 },
  labelSelected: { color: Colors.gold },
  sub: { fontSize: 12, color: Colors.muted, marginTop: 2, lineHeight: 17 },
  check: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  checkActive: {
    backgroundColor: Colors.gold,
    borderColor: Colors.gold,
  },
});

/**
 * GrowBar — a progress track whose fill grows in from the left.
 *
 *   <GrowBar progress={0.62} color={Colors.gold} replayKey={focusCount} />
 *
 * Only the fill width animates; track and fill colors stay static styles.
 * Pass `delay` to stagger rows. Honors Reduce Motion.
 */

import React from "react";
import { Animated, StyleProp, View, ViewStyle } from "react-native";

import { Colors } from "@/constants/colors";
import { useEntranceProgress } from "@/animations/useEntranceProgress";

interface GrowBarProps {
  /** 0…1; values outside are clamped. */
  progress: number;
  color: string;
  trackColor?: string;
  height?: number;
  delay?: number;
  duration?: number;
  replayKey?: unknown;
  style?: StyleProp<ViewStyle>;
}

export function GrowBar({
  progress,
  color,
  trackColor = Colors.navy50,
  height = 6,
  delay,
  duration,
  replayKey,
  style,
}: GrowBarProps) {
  const target = Math.max(0, Math.min(1, progress || 0));
  const fill = useEntranceProgress(target, { replayKey, delay, duration });
  const width = fill.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] });

  return (
    <View
      style={[
        { height, borderRadius: height / 2, backgroundColor: trackColor, overflow: "hidden" },
        style,
      ]}
    >
      <Animated.View
        style={{ width, height: "100%", borderRadius: height / 2, backgroundColor: color }}
      />
    </View>
  );
}

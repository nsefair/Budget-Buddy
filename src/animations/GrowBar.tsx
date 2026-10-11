/**
 * GrowBar — a progress track whose fill grows in.
 *
 *   <GrowBar progress={0.62} color={Colors.gold} replayKey={focusCount} />
 *
 * Only the fill size animates; track and fill colors stay static styles.
 * `vertical` grows a chart bar up from the bottom (set the track's height via
 * `style`). Pass `delay` to stagger rows. Honors Reduce Motion.
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
  /** Bar thickness: height when horizontal, width when vertical. */
  height?: number;
  delay?: number;
  duration?: number;
  replayKey?: unknown;
  vertical?: boolean;
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
  vertical = false,
  style,
}: GrowBarProps) {
  const target = Math.max(0, Math.min(1, progress || 0));
  const fill = useEntranceProgress(target, { replayKey, delay, duration });
  const size = fill.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] });

  if (vertical) {
    // `height` is the bar thickness here; the track's length comes from `style`.
    return (
      <View
        style={[
          { width: height, borderRadius: height / 2, backgroundColor: trackColor, overflow: "hidden", justifyContent: "flex-end" },
          style,
        ]}
      >
        <Animated.View
          style={{ height: size, width: "100%", borderRadius: height / 2, backgroundColor: color }}
        />
      </View>
    );
  }

  return (
    <View
      style={[
        { height, borderRadius: height / 2, backgroundColor: trackColor, overflow: "hidden" },
        style,
      ]}
    >
      <Animated.View
        style={{ width: size, height: "100%", borderRadius: height / 2, backgroundColor: color }}
      />
    </View>
  );
}

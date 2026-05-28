/**
 * Shimmer — skeleton-style placeholder for async data.
 *
 * Skill rule (ux-guidelines): show feedback for any wait > 300 ms.
 * Use as a child during the loading state of cards/lists.
 *
 *   <Shimmer style={{ height: 16, width: 120 }} />
 */

import React, { useEffect, useRef } from "react";
import { Animated, StyleProp, StyleSheet, View, ViewStyle } from "react-native";

import { Colors } from "@/constants/colors";
import { Radius } from "@/constants/tokens";
import { useReducedMotion } from "@/animations/useReducedMotion";

interface ShimmerProps {
  style?: StyleProp<ViewStyle>;
  radius?: number;
}

export function Shimmer({ style, radius = Radius.sm }: ShimmerProps) {
  const reduced = useReducedMotion();
  const driver = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduced) return;
    const loop = Animated.loop(
      Animated.timing(driver, {
        toValue: 1,
        duration: 1200,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [reduced, driver]);

  const opacity = driver.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.4, 0.85, 0.4],
  });

  return (
    <View
      style={[styles.base, { borderRadius: radius }, style]}
      accessibilityRole="progressbar"
      accessibilityLabel="Loading"
    >
      <Animated.View
        style={[StyleSheet.absoluteFill, { backgroundColor: Colors.navy100, opacity }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: Colors.navy50,
    overflow: "hidden",
  },
});

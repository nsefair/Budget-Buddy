/**
 * FadeInUp — entrance animation building block.
 *
 * Renders children, then fades + lifts them into place on mount.
 * Use `delay` to stagger several FadeInUps for a cascade entrance.
 *
 *   <FadeInUp>...</FadeInUp>
 *   <FadeInUp delay={80}>...</FadeInUp>
 *   <FadeInUp delay={160}>...</FadeInUp>
 *
 * Honors Reduce Motion (renders static).
 */

import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleProp, ViewStyle } from "react-native";

import { Motion } from "@/constants/tokens";
import { useReducedMotion } from "@/animations/useReducedMotion";

interface FadeInUpProps {
  delay?: number;
  duration?: number;
  distance?: number;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

export function FadeInUp({
  delay = 0,
  duration = Motion.slow,
  distance = 14,
  style,
  children,
}: FadeInUpProps) {
  const reduced = useReducedMotion();
  const progress = useRef(new Animated.Value(reduced ? 1 : 0)).current;

  useEffect(() => {
    if (reduced) {
      progress.setValue(1);
      return;
    }
    Animated.timing(progress, {
      toValue: 1,
      delay,
      duration,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
      useNativeDriver: true,
    }).start();
  }, [reduced, progress, delay, duration]);

  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [distance, 0],
  });

  return (
    <Animated.View
      style={[style, { opacity: progress, transform: [{ translateY }] }]}
    >
      {children}
    </Animated.View>
  );
}

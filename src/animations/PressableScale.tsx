/**
 * PressableScale — adds a satisfying scale-down on press to any tappable.
 *
 * Use anywhere a Pressable feels flat. Forwards every Pressable prop.
 * Respects Reduce Motion.
 */

import React, { useRef } from "react";
import {
  Animated,
  Pressable,
  PressableProps,
  StyleProp,
  ViewStyle,
} from "react-native";

import { useReducedMotion } from "@/animations/useReducedMotion";

interface PressableScaleProps extends PressableProps {
  scaleTo?: number;
  style?: StyleProp<ViewStyle>;
}

export function PressableScale({
  scaleTo = 0.97,
  style,
  children,
  onPressIn,
  onPressOut,
  ...rest
}: PressableScaleProps) {
  const reduced = useReducedMotion();
  const scale = useRef(new Animated.Value(1)).current;

  const handleIn: PressableProps["onPressIn"] = (event) => {
    if (!reduced) {
      Animated.spring(scale, {
        toValue: scaleTo,
        damping: 18,
        stiffness: 320,
        useNativeDriver: true,
      }).start();
    }
    onPressIn?.(event);
  };

  const handleOut: PressableProps["onPressOut"] = (event) => {
    if (!reduced) {
      Animated.spring(scale, {
        toValue: 1,
        damping: 18,
        stiffness: 320,
        useNativeDriver: true,
      }).start();
    }
    onPressOut?.(event);
  };

  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <Pressable onPressIn={handleIn} onPressOut={handleOut} {...rest}>
        {children}
      </Pressable>
    </Animated.View>
  );
}

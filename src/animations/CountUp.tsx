/**
 * CountUp — animates a number from 0 (or `from`) to `value`.
 *
 * Perfect for hero metrics: net worth, XP, savings rate. Feels premium
 * without being noisy. Skips animation when Reduce Motion is on, or for
 * very small deltas.
 *
 *   <CountUp value={netWorth} format={(n) => formatCurrency(n)} />
 */

import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleProp, Text, TextStyle } from "react-native";

import { Motion } from "@/constants/tokens";
import { useReducedMotion } from "@/animations/useReducedMotion";

interface CountUpProps {
  value: number;
  from?: number;
  duration?: number;
  format?: (n: number) => string;
  style?: StyleProp<TextStyle>;
  accessibilityLabel?: string;
}

export function CountUp({
  value,
  from = 0,
  duration = Motion.hero,
  format = (n) => Math.round(n).toString(),
  style,
  accessibilityLabel,
}: CountUpProps) {
  const reduced = useReducedMotion();
  const driver = useRef(new Animated.Value(reduced ? value : from)).current;
  const [display, setDisplay] = useState(format(reduced ? value : from));

  useEffect(() => {
    const id = driver.addListener(({ value: v }) => setDisplay(format(v)));
    return () => driver.removeListener(id);
  }, [driver, format]);

  useEffect(() => {
    if (reduced) {
      driver.setValue(value);
      setDisplay(format(value));
      return;
    }
    Animated.timing(driver, {
      toValue: value,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [value, reduced, driver, duration, format]);

  return (
    <Text
      style={style}
      accessibilityRole="text"
      accessibilityLabel={accessibilityLabel ?? format(value)}
    >
      {display}
    </Text>
  );
}

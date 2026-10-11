/**
 * CountUp — animates a number from 0 (or `from`) to `value`.
 *
 * Perfect for hero metrics: net worth, XP, savings rate. Feels premium
 * without being noisy. Skips animation when Reduce Motion is on, or for
 * very small deltas.
 *
 *   <CountUp value={netWorth} format={(n) => formatCurrency(n)} />
 *
 * Pass `replayKey` (e.g. from useFocusReplay) to roll in again from `from`
 * when a screen regains focus, and `fit` to keep large amounts on one line.
 * VoiceOver always hears the final value.
 */

import React, { useEffect, useRef, useState } from "react";
import { StyleProp, StyleSheet, Text, TextStyle } from "react-native";

import { Motion } from "@/constants/tokens";
import { useReducedMotion } from "@/animations/useReducedMotion";

interface CountUpProps {
  value: number;
  from?: number;
  duration?: number;
  format?: (n: number) => string;
  style?: StyleProp<TextStyle>;
  accessibilityLabel?: string;
  /** Change to replay the count from `from`. */
  replayKey?: unknown;
  /** Keep the number on one line, shrinking it to fit its container. */
  fit?: boolean;
}

const defaultFormat = (n: number) => Math.round(n).toString();

// Ease-out cubic — matches the old Animated easing without an Animated.Value,
// which avoids React Native's "onAnimatedValueUpdate with no listeners" warning.
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

export function CountUp({
  value,
  from = 0,
  duration = Motion.hero,
  format = defaultFormat,
  style,
  accessibilityLabel,
  replayKey,
  fit = false,
}: CountUpProps) {
  const reduced = useReducedMotion();

  // Keep the latest format without restarting the animation each render.
  const formatRef = useRef(format);
  formatRef.current = format;

  const [display, setDisplay] = useState(() =>
    formatRef.current(reduced ? value : from)
  );

  // Tracks the last numeric value we animated to, so a changing `value`
  // tweens from where it is now instead of snapping back to `from`.
  const lastValueRef = useRef(reduced ? value : from);
  const lastReplayKey = useRef(replayKey);

  useEffect(() => {
    if (reduced || duration <= 0) {
      lastValueRef.current = value;
      setDisplay(formatRef.current(value));
      return;
    }

    if (lastReplayKey.current !== replayKey) {
      lastReplayKey.current = replayKey;
      lastValueRef.current = from;
    }

    let raf = 0;
    let start: number | null = null;
    const begin = lastValueRef.current;
    const delta = value - begin;

    const tick = (now: number) => {
      if (start === null) start = now;
      const elapsed = now - start;
      const t = Math.min(1, elapsed / duration);
      const current = begin + delta * easeOutCubic(t);
      lastValueRef.current = current;
      setDisplay(formatRef.current(current));
      if (t < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        lastValueRef.current = value;
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // `from` intentionally excluded: only re-run when the target value changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, reduced, duration, replayKey]);

  return (
    <Text
      style={[styles.tabular, style]}
      accessibilityRole="text"
      accessibilityLabel={accessibilityLabel ?? formatRef.current(value)}
      numberOfLines={fit ? 1 : undefined}
      adjustsFontSizeToFit={fit}
      minimumFontScale={fit ? 0.45 : undefined}
    >
      {display}
    </Text>
  );
}

const styles = StyleSheet.create({
  // Equal-width digits keep the number from jittering as it counts.
  tabular: { fontVariant: ["tabular-nums"] },
});

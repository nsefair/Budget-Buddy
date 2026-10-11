/**
 * useEntranceProgress — an Animated.Value that eases from 0 to `target`.
 *
 * Plays on mount and again whenever `replayKey` changes. When only the target
 * changes (fresh data), it eases from where it is instead of restarting.
 * Reduce Motion jumps straight to the target. Drive layout or SVG props with
 * it (JS driver); never animate adaptive colors through it.
 */

import { useEffect, useRef } from "react";
import { Animated, Easing } from "react-native";

import { Motion } from "@/constants/tokens";
import { useReducedMotion } from "@/animations/useReducedMotion";

interface Options {
  replayKey?: unknown;
  delay?: number;
  duration?: number;
}

export function useEntranceProgress(
  target: number,
  { replayKey, delay = 0, duration = Motion.hero }: Options = {}
): Animated.Value {
  const reduced = useReducedMotion();
  const value = useRef(new Animated.Value(0)).current;
  const lastReplayKey = useRef(replayKey);

  useEffect(() => {
    if (reduced) {
      value.stopAnimation();
      value.setValue(target);
      return;
    }
    if (lastReplayKey.current !== replayKey) {
      lastReplayKey.current = replayKey;
      value.setValue(0);
    }
    const animation = Animated.timing(value, {
      toValue: target,
      delay,
      duration,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [target, replayKey, reduced, delay, duration, value]);

  return value;
}

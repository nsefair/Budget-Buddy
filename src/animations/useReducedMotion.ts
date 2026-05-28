/**
 * useReducedMotion — respect the OS-level "Reduce Motion" preference.
 *
 * Skill rule (ui-ux-pro-max → ux): infinite or decorative motion must be
 * disabled when the user has Reduce Motion turned on. Every animation in
 * the app should check this hook and fall back to a static state.
 */

import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let mounted = true;

    AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (mounted) setReduced(value);
    });

    const sub = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      (value) => {
        if (mounted) setReduced(value);
      }
    );

    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  return reduced;
}

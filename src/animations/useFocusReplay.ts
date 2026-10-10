/**
 * useFocusReplay — a counter that changes each time the screen regains focus.
 *
 * Pass it as `replayKey` to CountUp / GrowBar so numbers and bars re-enter
 * when the user returns to a tab, without replaying on ordinary re-renders.
 * The first focus is skipped because mounting already plays the entrance.
 */

import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";

export function useFocusReplay(): number {
  const [count, setCount] = useState(0);
  const firstFocus = useRef(true);

  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      setCount((value) => value + 1);
    }, [])
  );

  return count;
}

/**
 * RevealWords — a headline whose words fade and rise in one after another.
 *
 *   <RevealWords text="What should we look at today?" style={styles.title} />
 *
 * VoiceOver reads the whole sentence once as a header. Change `replayKey`
 * to play it again. Honors Reduce Motion (renders static).
 */

import React, { useEffect, useMemo } from "react";
import {
  Animated,
  Easing,
  StyleProp,
  StyleSheet,
  TextStyle,
  View,
  ViewStyle,
} from "react-native";

import { useReducedMotion } from "@/animations/useReducedMotion";

interface RevealWordsProps {
  text: string;
  style?: StyleProp<TextStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  delay?: number;
  /** Delay between words, in ms. */
  stagger?: number;
  replayKey?: unknown;
  maxFontSizeMultiplier?: number;
}

export function RevealWords({
  text,
  style,
  containerStyle,
  delay = 0,
  stagger = 60,
  replayKey,
  maxFontSizeMultiplier,
}: RevealWordsProps) {
  const reduced = useReducedMotion();
  const words = useMemo(() => text.split(/\s+/).filter(Boolean), [text]);
  const values = useMemo(() => words.map(() => new Animated.Value(0)), [words]);
  const fontSize = StyleSheet.flatten(style)?.fontSize ?? 16;

  useEffect(() => {
    if (reduced) {
      values.forEach((value) => value.setValue(1));
      return;
    }
    values.forEach((value) => value.setValue(0));
    const animation = Animated.sequence([
      Animated.delay(delay),
      Animated.stagger(
        stagger,
        values.map((value) =>
          Animated.timing(value, {
            toValue: 1,
            duration: 420,
            easing: Easing.bezier(0.22, 1, 0.36, 1),
            useNativeDriver: true,
          })
        )
      ),
    ]);
    animation.start();
    return () => animation.stop();
  }, [values, reduced, replayKey, delay, stagger]);

  return (
    <View
      accessible
      accessibilityRole="header"
      accessibilityLabel={text}
      style={[styles.row, { columnGap: fontSize * 0.26 }, containerStyle]}
    >
      {words.map((word, index) => (
        <Animated.Text
          key={`${index}-${word}`}
          maxFontSizeMultiplier={maxFontSizeMultiplier}
          style={[
            style,
            {
              opacity: values[index],
              transform: [
                {
                  translateY: values[index].interpolate({
                    inputRange: [0, 1],
                    outputRange: [fontSize * 0.3, 0],
                  }),
                },
              ],
            },
          ]}
        >
          {word}
        </Animated.Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap" },
});

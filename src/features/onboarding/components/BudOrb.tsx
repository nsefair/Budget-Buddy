/**
 * BudOrb — the mascot character.
 *
 * Until we have proper character art / Lottie, Bud is rendered as a soft
 * gold orb with a gentle breathing pulse. The orb sizes are tuned for
 * different onboarding moments (hero / inline / floating).
 *
 * When the actual Bud illustration arrives, replace the inner LinearGradient
 * with an Image or LottieView — the public surface (size + animation) stays
 * the same so callers don't need to change.
 */

import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Colors } from "@/constants/colors";

interface Props {
  size?: number;
  /** When true, the orb gently breathes — use for hero moments */
  pulse?: boolean;
  /** Optional shadow override */
  glow?: boolean;
  style?: ViewStyle;
}

export function BudOrb({ size = 88, pulse = true, glow = true, style }: Props) {
  const breath = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!pulse) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, {
          toValue: 1.06,
          duration: 1400,
          useNativeDriver: true,
        }),
        Animated.timing(breath, {
          toValue: 1,
          duration: 1400,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, breath]);

  const orbStyle: ViewStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
    overflow: "hidden",
  };

  return (
    <View style={[styles.wrapper, glow && styles.glow, style]}>
      <Animated.View style={[orbStyle, { transform: [{ scale: breath }] }]}>
        <LinearGradient
          colors={[Colors.gold400, Colors.gold600]}
          start={{ x: 0.2, y: 0.1 }}
          end={{ x: 0.9, y: 0.95 }}
          style={[orbStyle, styles.center]}
        >
          {/* Highlight bubble for character feel */}
          <View
            style={[
              styles.highlight,
              {
                width: size * 0.32,
                height: size * 0.18,
                top: size * 0.12,
                left: size * 0.18,
                borderRadius: size * 0.18,
              },
            ]}
          />
          <Text style={[styles.letter, { fontSize: size * 0.46 }]}>B</Text>
        </LinearGradient>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignSelf: "center" },
  glow: {
    shadowColor: Colors.gold,
    shadowOpacity: 0.45,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 6 },
    elevation: 12,
  },
  center: { alignItems: "center", justifyContent: "center" },
  letter: {
    fontWeight: "800",
    color: Colors.navy,
    letterSpacing: -1,
  },
  highlight: {
    position: "absolute",
    backgroundColor: "rgba(255,255,255,0.45)",
  },
});

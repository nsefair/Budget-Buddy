/**
 * BudOrb — the mascot character.
 *
 * Until we have proper character art / Lottie, Bud uses the Budget Buddy
 * brand mark with a gentle breathing pulse. The public surface stays stable
 * so future character art can replace the image without touching callers.
 */

import React, { useEffect, useRef } from "react";
import { Animated, Image, StyleSheet, View, ViewStyle } from "react-native";
import { Colors } from "@/constants/colors";
import { BRAND_MARK_SOURCE } from "@/components/BrandLogo";

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

  return (
    <View style={[styles.wrapper, glow && styles.glow, style]}>
      <Animated.View style={{ transform: [{ scale: breath }] }}>
        <Image
          source={BRAND_MARK_SOURCE}
          resizeMode="contain"
          style={{ width: size, height: size }}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignSelf: "center" },
  glow: {
    shadowColor: Colors.teal,
    shadowOpacity: 0.45,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 6 },
    elevation: 12,
  },
});

/**
 * BudOrb — the mascot character.
 *
 * Until we have proper character art / Lottie, Bud uses the Budget Buddy
 * brand mark with a gentle breathing pulse. The public surface stays stable
 * so future character art can replace the image without touching callers.
 */

import React from "react";
import { Image, StyleSheet, View, ViewStyle } from "react-native";
import { MotiView } from "moti";
import { Colors } from "@/constants/colors";
import { BRAND_MARK_SOURCE } from "@/components/BrandLogo";
import { useReducedMotion } from "@/animations";

interface Props {
  size?: number;
  /** When true, the orb gently breathes — use for hero moments */
  pulse?: boolean;
  /** Optional shadow override */
  glow?: boolean;
  style?: ViewStyle;
}

export function BudOrb({ size = 88, pulse = true, glow = true, style }: Props) {
  const reduced = useReducedMotion();
  const shouldAnimate = pulse && !reduced;

  return (
    <View style={[styles.wrapper, glow && styles.glow, style]}>
      {/* Soft outer halo that breathes opposite to the orb — depth without noise */}
      {shouldAnimate && (
        <MotiView
          from={{ opacity: 0.0, scale: 1 }}
          animate={{ opacity: 0.35, scale: 1.18 }}
          transition={{
            type: "timing",
            duration: 2200,
            loop: true,
            repeatReverse: true,
          }}
          style={[
            styles.halo,
            { width: size * 1.25, height: size * 1.25, borderRadius: size },
          ]}
        />
      )}

      <MotiView
        from={{ scale: 1, translateY: 0 }}
        animate={
          shouldAnimate
            ? { scale: 1.06, translateY: -2 }
            : { scale: 1, translateY: 0 }
        }
        transition={
          shouldAnimate
            ? {
                type: "timing",
                duration: 1400,
                loop: true,
                repeatReverse: true,
              }
            : { duration: 0 }
        }
      >
        <Image
          source={BRAND_MARK_SOURCE}
          resizeMode="contain"
          style={{ width: size, height: size }}
        />
      </MotiView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignSelf: "center", alignItems: "center", justifyContent: "center" },
  glow: {
    shadowColor: Colors.accent,
    shadowOpacity: 0.4,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 6 },
    elevation: 12,
  },
  halo: {
    position: "absolute",
    backgroundColor: Colors.accentAlpha15,
  },
});

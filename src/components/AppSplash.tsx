/**
 * AppSplash — branded loading screen shown while session restores and fonts load.
 * Replaces the `return null` that would otherwise flash a white screen.
 */

import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Colors } from "@/constants/colors";

export function AppSplash() {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.08, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <LinearGradient colors={["#0E1926", "#1B2B4B"]} style={styles.container}>
      <Animated.View style={[styles.budOrb, { transform: [{ scale: pulse }] }]}>
        <LinearGradient colors={[Colors.gold, "#E08A10"]} style={styles.budOrbGrad}>
          <Text style={styles.budOrbText}>B</Text>
        </LinearGradient>
      </Animated.View>
      <Text style={styles.wordmark}>Budget Buddy</Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", gap: 24 },
  budOrb: {
    width: 96,
    height: 96,
    borderRadius: 48,
    overflow: "hidden",
    shadowColor: Colors.gold,
    shadowOpacity: 0.5,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 4 },
    elevation: 12,
  },
  budOrbGrad: { width: 96, height: 96, alignItems: "center", justifyContent: "center" },
  budOrbText: { fontSize: 44, fontWeight: "800", color: Colors.navy, lineHeight: 52 },
  wordmark: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.muted,
    letterSpacing: 3,
    textTransform: "uppercase",
  },
});

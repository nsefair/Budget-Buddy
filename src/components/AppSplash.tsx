/**
 * AppSplash — branded loading screen shown while session restores and fonts load.
 * Replaces the `return null` that would otherwise flash a white screen.
 */

import React, { useEffect, useRef } from "react";
import { StyleSheet, Animated } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BrandLogo } from "@/components/BrandLogo";

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
      <Animated.View style={{ transform: [{ scale: pulse }] }}>
        <BrandLogo
          direction="column"
          markSize={96}
          textColor="#FFFFFF"
          textStyle={styles.wordmark}
        />
      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", gap: 24 },
  wordmark: {
    fontSize: 13,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 3,
    textTransform: "uppercase",
  },
});

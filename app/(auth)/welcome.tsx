import React, { useEffect, useRef } from "react";
import { View, Text, Pressable, StyleSheet, Animated } from "react-native";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "@/constants/colors";
import { BrandLogo } from "@/components/BrandLogo";

export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();

  // Animated values — RN Animated (works in Expo Go, no dev build needed)
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.85)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const taglineY = useRef(new Animated.Value(20)).current;
  const subtitleOpacity = useRef(new Animated.Value(0)).current;
  const ctaOpacity = useRef(new Animated.Value(0)).current;
  const ctaY = useRef(new Animated.Value(30)).current;
  const budPulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Staggered entrance
    Animated.stagger(120, [
      Animated.parallel([
        Animated.timing(logoOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.spring(logoScale, { toValue: 1, damping: 12, stiffness: 150, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(taglineOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.spring(taglineY, { toValue: 0, damping: 14, stiffness: 120, useNativeDriver: true }),
      ]),
      Animated.timing(subtitleOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.parallel([
        Animated.timing(ctaOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.spring(ctaY, { toValue: 0, damping: 12, stiffness: 100, useNativeDriver: true }),
      ]),
    ]).start();

    // Continuous Bud orb pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(budPulse, { toValue: 1.06, duration: 1800, useNativeDriver: true }),
        Animated.timing(budPulse, { toValue: 1, duration: 1800, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <LinearGradient
      colors={["#0E1926", "#1B2B4B", "#0E2338"]}
      locations={[0, 0.5, 1]}
      style={styles.container}
    >
      {/* Brand wordmark */}
      <Animated.View style={[styles.logoContainer, { opacity: logoOpacity, transform: [{ scale: logoScale }] }]}>
        <BrandLogo
          markSize={30}
          textColor="rgba(255,255,255,0.82)"
          textStyle={styles.logoText}
        />
      </Animated.View>

      {/* Brand hero mark */}
      <View style={styles.orbSection}>
        <View style={styles.orbitRing} />
        <Animated.View style={[styles.budOrb, { transform: [{ scale: budPulse }] }]}>
          <BrandLogo variant="mark" markSize={124} />
        </Animated.View>
      </View>

      {/* Headline */}
      <Animated.View
        style={[
          styles.headlineContainer,
          { opacity: taglineOpacity, transform: [{ translateY: taglineY }] },
        ]}
      >
        <Text style={styles.headline}>Your financial life{"\n"}starts today.</Text>
      </Animated.View>

      <Animated.Text style={[styles.subtitle, { opacity: subtitleOpacity }]}>
        AI coaching. Real habits. A community that holds you accountable.
      </Animated.Text>

      {/* CTAs */}
      <Animated.View
        style={[
          styles.ctaContainer,
          { paddingBottom: insets.bottom + 24, opacity: ctaOpacity, transform: [{ translateY: ctaY }] },
        ]}
      >
        <Pressable
          style={({ pressed }) => [styles.primaryButton, pressed && { opacity: 0.85 }]}
          onPress={() => router.push("/(auth)/register")}
        >
          <LinearGradient
            colors={[Colors.gold, Colors.gold600]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.primaryButtonGradient}
          >
            <Text style={styles.primaryButtonText}>Get Started</Text>
          </LinearGradient>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.secondaryButton, pressed && { opacity: 0.7 }]}
          onPress={() => router.push("/(auth)/login")}
        >
          <Text style={styles.secondaryButtonText}>I already have an account</Text>
        </Pressable>
      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center" },
  logoContainer: { alignItems: "center", marginBottom: 48 },
  logoText: {
    fontSize: 15,
    fontWeight: "800",
    color: "rgba(255,255,255,0.82)",
    letterSpacing: 3,
    textTransform: "uppercase",
  },
  orbSection: {
    width: 160,
    height: 160,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 48,
  },
  orbitRing: {
    position: "absolute",
    width: 148,
    height: 148,
    borderRadius: 74,
    borderWidth: 1,
    borderColor: "rgba(0, 180, 166, 0.24)",
  },
  budOrb: {
    width: 124,
    height: 124,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: Colors.teal,
    shadowOpacity: 0.45,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 4 },
    elevation: 16,
  },
  headlineContainer: { paddingHorizontal: 32, marginBottom: 16 },
  headline: {
    fontSize: 36,
    fontWeight: "800",
    color: "#FFF",
    textAlign: "center",
    lineHeight: 44,
    letterSpacing: 0,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.muted,
    textAlign: "center",
    paddingHorizontal: 48,
    lineHeight: 22,
    marginBottom: 64,
  },
  ctaContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    gap: 12,
  },
  primaryButton: {
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: Colors.gold,
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  primaryButtonGradient: { paddingVertical: 18, alignItems: "center" },
  primaryButtonText: { fontSize: 17, fontWeight: "700", color: Colors.navy, letterSpacing: 0.3 },
  secondaryButton: { paddingVertical: 16, alignItems: "center" },
  secondaryButtonText: { fontSize: 15, fontWeight: "500", color: Colors.muted },
});

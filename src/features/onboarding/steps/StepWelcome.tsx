/**
 * Step 1 — Welcome.
 *
 * Brand hero moment. Bud appears, drops the line: "Your financial life
 * starts today." Per Section 4 of the developer review.
 */

import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { BudOrb } from "../components/BudOrb";
import { Colors } from "@/constants/colors";

interface Props {
  firstName: string;
  onNext: () => void;
}

// onNext is intentionally accepted but unused here — the OnboardingShell
// renders the CTA in its footer. We keep the prop for symmetry with other
// step components and for direct-test use cases.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function StepWelcome({ firstName, onNext: _onNext }: Props) {
  const fade = useRef(new Animated.Value(0)).current;
  const lift = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.spring(lift, {
        toValue: 0,
        damping: 18,
        stiffness: 120,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fade, lift]);

  const greeting = firstName ? `Hey ${firstName}.` : "Hey there.";

  return (
    <View style={styles.container}>
      <BudOrb size={108} pulse />
      <Animated.View
        style={{ opacity: fade, transform: [{ translateY: lift }], alignItems: "center" }}
      >
        <Text style={styles.tag}>BUD</Text>
        <Text style={styles.greeting}>{greeting}</Text>
        <Text style={styles.line}>Your financial life</Text>
        <Text style={styles.lineGold}>starts today.</Text>
        <Text style={styles.body}>
          A few quick questions and I'll have you set up — your goals,
          your first quest, your streak. About three minutes.
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 28,
    paddingTop: 24,
  },
  tag: {
    fontSize: 11,
    fontWeight: "800",
    color: Colors.gold,
    letterSpacing: 3,
    marginTop: 24,
    marginBottom: 14,
  },
  greeting: {
    fontSize: 18,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: 18,
  },
  line: {
    fontSize: 36,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0,
    textAlign: "center",
    lineHeight: 44,
  },
  lineGold: {
    fontSize: 36,
    fontWeight: "800",
    color: Colors.gold,
    letterSpacing: 0,
    textAlign: "center",
    lineHeight: 44,
    marginBottom: 20,
  },
  body: {
    fontSize: 15,
    color: "rgba(255,255,255,0.65)",
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: 16,
  },
});

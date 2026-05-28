/**
 * Step 1 — Welcome.
 *
 * Brand hero moment. Bud appears, drops the line: "Your financial life
 * starts today." Per Section 4 of the developer review.
 */

import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { BudOrb } from "../components/BudOrb";
import { Colors } from "@/constants/colors";
import { FadeInUp } from "@/animations";

interface Props {
  firstName: string;
  onNext: () => void;
}

// onNext is intentionally accepted but unused here — the OnboardingShell
// renders the CTA in its footer. We keep the prop for symmetry with other
// step components and for direct-test use cases.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function StepWelcome({ firstName, onNext: _onNext }: Props) {
  const greeting = firstName ? `Hey ${firstName}.` : "Hey there.";

  return (
    <View style={styles.container}>
      <FadeInUp duration={600} distance={24}>
        <BudOrb size={108} pulse />
      </FadeInUp>
      <View style={{ alignItems: "center" }}>
        <FadeInUp delay={150}>
          <Text style={styles.tag}>BUD</Text>
        </FadeInUp>
        <FadeInUp delay={250}>
          <Text style={styles.greeting}>{greeting}</Text>
        </FadeInUp>
        <FadeInUp delay={350}>
          <Text style={styles.line}>Your financial life</Text>
        </FadeInUp>
        <FadeInUp delay={450}>
          <Text style={styles.lineGold}>starts today.</Text>
        </FadeInUp>
        <FadeInUp delay={600}>
          <Text style={styles.body}>
            A few quick questions and I'll have you set up — your goals,
            your first quest, your streak. About three minutes.
          </Text>
        </FadeInUp>
      </View>
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
    color: Colors.navy,
    marginBottom: 18,
  },
  line: {
    fontSize: 36,
    fontWeight: "800",
    color: Colors.navy,
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
    color: Colors.navyMuted,
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: 16,
  },
});

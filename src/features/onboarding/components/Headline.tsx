/**
 * Headline / Subheadline / BodyText — the consistent typography for all
 * onboarding steps. Centralising these means restyling the whole flow is
 * a single-file change.
 *
 * Plain-text headlines reveal word by word (reference: calm onboarding flow);
 * subheadlines fade in just after. Both honor Reduce Motion.
 */

import React, { ReactNode } from "react";
import { StyleSheet, Text, TextStyle } from "react-native";
import { FadeInUp, RevealWords } from "@/animations";
import { Colors } from "@/constants/colors";

export function Headline({
  children,
  style,
}: {
  children: ReactNode;
  style?: TextStyle;
}) {
  // Interpolated headlines ("Nice to meet you, {name}.") arrive as arrays.
  const parts = React.Children.toArray(children);
  const plainText = parts.every((part) => typeof part === "string" || typeof part === "number")
    ? parts.join("")
    : null;
  if (plainText) {
    return (
      <RevealWords
        text={plainText}
        style={[styles.headline, style]}
        containerStyle={styles.headlineBlock}
        delay={80}
        maxFontSizeMultiplier={1.4}
      />
    );
  }
  return (
    <Text style={[styles.headline, styles.headlineBlock, style]} accessibilityRole="header">
      {children}
    </Text>
  );
}

export function Subheadline({
  children,
  style,
}: {
  children: ReactNode;
  style?: TextStyle;
}) {
  return (
    <FadeInUp delay={260} distance={8}>
      <Text style={[styles.subheadline, style]}>{children}</Text>
    </FadeInUp>
  );
}

export function BodyText({
  children,
  style,
}: {
  children: ReactNode;
  style?: TextStyle;
}) {
  return <Text style={[styles.body, style]}>{children}</Text>;
}

const styles = StyleSheet.create({
  headline: {
    fontSize: 30,
    fontWeight: "800",
    color: Colors.navy,
    letterSpacing: -0.6,
    lineHeight: 36,
  },
  headlineBlock: { marginBottom: 12 },
  subheadline: {
    fontSize: 15,
    color: Colors.navyMuted,
    lineHeight: 22,
    marginBottom: 24,
  },
  body: {
    fontSize: 15,
    color: Colors.muted,
    lineHeight: 23,
    marginBottom: 12,
  },
});

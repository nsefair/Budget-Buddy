/**
 * Headline / Subheadline / BodyText — the consistent typography for all
 * onboarding steps. Centralising these means restyling the whole flow is
 * a single-file change.
 */

import React, { ReactNode } from "react";
import { StyleSheet, Text, TextStyle } from "react-native";
import { Colors } from "@/constants/colors";

export function Headline({
  children,
  style,
}: {
  children: ReactNode;
  style?: TextStyle;
}) {
  return <Text style={[styles.headline, style]}>{children}</Text>;
}

export function Subheadline({
  children,
  style,
}: {
  children: ReactNode;
  style?: TextStyle;
}) {
  return <Text style={[styles.subheadline, style]}>{children}</Text>;
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
    fontSize: 28,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -0.6,
    lineHeight: 36,
    marginBottom: 12,
  },
  subheadline: {
    fontSize: 15,
    color: "rgba(255,255,255,0.72)",
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

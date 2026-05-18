/**
 * Step 2 — Profile.
 *
 * Captures: first name (pre-filled if available), age range, current
 * life situation. Per Section 4 of the developer review, this seeds
 * personalization immediately.
 */

import React from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { BudBubble } from "../components/BudBubble";
import { Headline, Subheadline } from "../components/Headline";
import { OptionCard } from "../components/OptionCard";
import { AGE_RANGES, SITUATIONS } from "../data";
import type { AgeRange, LifeSituation } from "../types";
import { Colors } from "@/constants/colors";

interface Props {
  firstName: string;
  ageRange: AgeRange | null;
  situation: LifeSituation | null;
  onChangeName: (v: string) => void;
  onChangeAge: (v: AgeRange) => void;
  onChangeSituation: (v: LifeSituation) => void;
}

export function StepProfile({
  firstName,
  ageRange,
  situation,
  onChangeName,
  onChangeAge,
  onChangeSituation,
}: Props) {
  return (
    <View style={{ gap: 24 }}>
      <View>
        <BudBubble />
        <Headline>Let's keep it personal.</Headline>
        <Subheadline>
          The more I know, the more this feels built for you — not the average user.
        </Subheadline>
      </View>

      {/* Name */}
      <View>
        <Text style={styles.fieldLabel}>What should I call you?</Text>
        <TextInput
          value={firstName}
          onChangeText={onChangeName}
          placeholder="First name"
          placeholderTextColor={Colors.muted}
          autoCapitalize="words"
          returnKeyType="done"
          style={styles.input}
        />
      </View>

      {/* Age range — chip-style row */}
      <View>
        <Text style={styles.fieldLabel}>Age range</Text>
        <View style={styles.chipRow}>
          {AGE_RANGES.map((a) => {
            const selected = ageRange === a.id;
            return (
              <Text
                key={a.id}
                onPress={() => onChangeAge(a.id)}
                suppressHighlighting
                style={[styles.chip, selected && styles.chipActive]}
              >
                {a.label}
              </Text>
            );
          })}
        </View>
      </View>

      {/* Situation */}
      <View>
        <Text style={styles.fieldLabel}>Where are you in life right now?</Text>
        <View style={{ gap: 10 }}>
          {SITUATIONS.map((s) => (
            <OptionCard
              key={s.id}
              icon={s.icon}
              label={s.label}
              sub={s.sub}
              selected={situation === s.id}
              onPress={() => onChangeSituation(s.id)}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fieldLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.navy,
    letterSpacing: 0.2,
    marginBottom: 10,
  },
  input: {
    backgroundColor: Colors.card,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.navy,
    fontWeight: "500",
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
    color: Colors.navyMuted,
    fontSize: 14,
    fontWeight: "600",
    overflow: "hidden",
  },
  chipActive: {
    backgroundColor: Colors.accentAlpha15,
    borderColor: Colors.gold,
    color: Colors.gold,
  },
});

/**
 * Step 3 — Goal selection (1–3 goals).
 *
 * Per Section 4 of the developer review.
 * If the user picks "custom" we surface a text input so they can name it.
 */

import React from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { BudBubble } from "../components/BudBubble";
import { Headline, Subheadline } from "../components/Headline";
import { OptionCard } from "../components/OptionCard";
import { GOAL_OPTIONS } from "../data";
import type { GoalKind } from "../types";
import { Colors } from "@/constants/colors";

interface Props {
  selected: GoalKind[];
  customLabel: string;
  onToggle: (kind: GoalKind) => void;
  onChangeCustom: (v: string) => void;
}

export function StepGoals({ selected, customLabel, onToggle, onChangeCustom }: Props) {
  const showCustomInput = selected.includes("custom");

  return (
    <View style={{ gap: 12 }}>
      <BudBubble />
      <Headline>What are you working toward?</Headline>
      <Subheadline>
        Pick up to 3. This shapes your quests, your tools, and how I show up
        for you each day.
      </Subheadline>

      <View style={{ gap: 10 }}>
        {GOAL_OPTIONS.map((g) => (
          <OptionCard
            key={g.id}
            emoji={g.emoji}
            label={g.label}
            sub={g.sub}
            selected={selected.includes(g.id)}
            onPress={() => onToggle(g.id)}
          />
        ))}
      </View>

      {showCustomInput && (
        <View style={{ marginTop: 10 }}>
          <Text style={styles.fieldLabel}>Tell me what you're working on</Text>
          <TextInput
            value={customLabel}
            onChangeText={onChangeCustom}
            placeholder='e.g. "Save for a move to Austin"'
            placeholderTextColor="rgba(255,255,255,0.35)"
            style={styles.input}
            maxLength={60}
            returnKeyType="done"
          />
        </View>
      )}

      <Text style={styles.counter}>
        {selected.length} of 3 selected
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fieldLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 10,
  },
  input: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.10)",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: "#FFFFFF",
  },
  counter: {
    fontSize: 12,
    color: Colors.muted,
    marginTop: 8,
    textAlign: "center",
    letterSpacing: 0.4,
  },
});

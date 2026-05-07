/**
 * Step 4 — Emotional Why.
 *
 * Per the developer review, the user's "why" appears across the app
 * (Today tab anchor, retention notifications, year-end recap).
 * This is the single most important moment for emotional connection.
 */

import React from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { BudBubble } from "../components/BudBubble";
import { Headline, Subheadline } from "../components/Headline";
import { OptionCard } from "../components/OptionCard";
import { WHY_OPTIONS } from "../data";
import { Colors } from "@/constants/colors";

interface Props {
  selectedId: string | null;
  customText: string;
  onSelect: (id: string) => void;
  onChangeCustom: (v: string) => void;
}

export function StepWhy({ selectedId, customText, onSelect, onChangeCustom }: Props) {
  const showCustomInput = selectedId === "custom";

  return (
    <View style={{ gap: 12 }}>
      <BudBubble />
      <Headline>The real reason.</Headline>
      <Subheadline>
        I'll remind you of this every day. Be honest — only you ever see it.
      </Subheadline>

      <View style={{ gap: 10 }}>
        {WHY_OPTIONS.map((w) => (
          <OptionCard
            key={w.id}
            emoji={w.emoji}
            label={w.label}
            sub={w.sub}
            selected={selectedId === w.id}
            onPress={() => onSelect(w.id)}
          />
        ))}
      </View>

      {showCustomInput && (
        <View style={{ marginTop: 10 }}>
          <Text style={styles.fieldLabel}>Write your reason</Text>
          <TextInput
            value={customText}
            onChangeText={onChangeCustom}
            placeholder="What does this really mean to you?"
            placeholderTextColor="rgba(255,255,255,0.35)"
            style={styles.input}
            multiline
            maxLength={140}
            returnKeyType="done"
          />
          <Text style={styles.charCount}>{customText.length}/140</Text>
        </View>
      )}
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
    fontSize: 15,
    color: "#FFFFFF",
    minHeight: 90,
    textAlignVertical: "top",
    lineHeight: 22,
  },
  charCount: {
    fontSize: 11,
    color: Colors.muted,
    marginTop: 6,
    textAlign: "right",
  },
});

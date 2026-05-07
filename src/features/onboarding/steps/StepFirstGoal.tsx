/**
 * Step 7 — First goal commitment.
 *
 * Per Section 4: "Before the user even gets to the home screen, they
 * must create a goal or goals." This is the conversion of the abstract
 * goal type into a concrete commitment.
 *
 * Bud auto-suggests a target amount + deadline based on the chosen kind.
 * Users can adjust everything.
 */

import React, { useEffect, useMemo } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { BudBubble } from "../components/BudBubble";
import { Headline, Subheadline } from "../components/Headline";
import { GOAL_OPTIONS } from "../data";
import type { FirstGoal, GoalKind } from "../types";
import { Colors } from "@/constants/colors";

interface Props {
  goalKind: GoalKind;
  customGoalLabel: string;
  goal: FirstGoal | null;
  onChange: (goal: FirstGoal) => void;
}

interface Suggestion {
  defaultName: string;
  suggestedAmount: number;
  amountChips: number[];
  deadlines: { label: string; months: number }[];
  amountLabel: string;
}

const SUGGESTIONS: Record<GoalKind, Suggestion> = {
  emergency_fund: {
    defaultName: "Emergency Fund",
    suggestedAmount: 1000,
    amountChips: [500, 1000, 2000, 5000],
    deadlines: [
      { label: "3 months", months: 3 },
      { label: "6 months", months: 6 },
      { label: "1 year", months: 12 },
    ],
    amountLabel: "Target cushion",
  },
  debt_payoff: {
    defaultName: "Debt Free",
    suggestedAmount: 2000,
    amountChips: [500, 1000, 5000, 10000],
    deadlines: [
      { label: "6 months", months: 6 },
      { label: "1 year", months: 12 },
      { label: "2 years", months: 24 },
    ],
    amountLabel: "Total to pay off",
  },
  stop_overspending: {
    defaultName: "Stay in budget",
    suggestedAmount: 200,
    amountChips: [100, 200, 300, 500],
    deadlines: [
      { label: "1 month", months: 1 },
      { label: "3 months", months: 3 },
      { label: "6 months", months: 6 },
    ],
    amountLabel: "Monthly limit",
  },
  savings_target: {
    defaultName: "My goal",
    suggestedAmount: 1500,
    amountChips: [500, 1500, 3000, 10000],
    deadlines: [
      { label: "3 months", months: 3 },
      { label: "6 months", months: 6 },
      { label: "1 year", months: 12 },
    ],
    amountLabel: "Target amount",
  },
  invest: {
    defaultName: "First investments",
    suggestedAmount: 500,
    amountChips: [100, 500, 1000, 2500],
    deadlines: [
      { label: "3 months", months: 3 },
      { label: "6 months", months: 6 },
      { label: "1 year", months: 12 },
    ],
    amountLabel: "Initial investment",
  },
  income_growth: {
    defaultName: "Grow my income",
    suggestedAmount: 1000,
    amountChips: [500, 1000, 2000, 5000],
    deadlines: [
      { label: "3 months", months: 3 },
      { label: "6 months", months: 6 },
      { label: "1 year", months: 12 },
    ],
    amountLabel: "Extra monthly income target",
  },
  custom: {
    defaultName: "My goal",
    suggestedAmount: 1000,
    amountChips: [500, 1000, 2500, 5000],
    deadlines: [
      { label: "3 months", months: 3 },
      { label: "6 months", months: 6 },
      { label: "1 year", months: 12 },
    ],
    amountLabel: "Target amount",
  },
};

function addMonths(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toISOString();
}

export function StepFirstGoal({
  goalKind,
  customGoalLabel,
  goal,
  onChange,
}: Props) {
  const suggestion = SUGGESTIONS[goalKind];
  const goalMeta = GOAL_OPTIONS.find((g) => g.id === goalKind);
  const defaultName =
    goalKind === "custom" && customGoalLabel
      ? customGoalLabel
      : suggestion.defaultName;

  // Initialize the draft goal once when this step mounts (or kind changes).
  useEffect(() => {
    if (!goal || goal.kind !== goalKind) {
      onChange({
        kind: goalKind,
        name: defaultName,
        targetAmount: suggestion.suggestedAmount,
        alreadySaved: 0,
        deadline: addMonths(suggestion.deadlines[1].months),
        reason: "",
      });
    }
  }, [goalKind]); // eslint-disable-line react-hooks/exhaustive-deps

  const current = goal ?? {
    kind: goalKind,
    name: defaultName,
    targetAmount: suggestion.suggestedAmount,
    alreadySaved: 0,
    deadline: addMonths(suggestion.deadlines[1].months),
    reason: "",
  };

  const setField = <K extends keyof FirstGoal>(key: K, value: FirstGoal[K]) =>
    onChange({ ...current, [key]: value });

  const monthlyPace = useMemo(() => {
    if (!current.deadline) return null;
    const months = Math.max(
      1,
      Math.round(
        (new Date(current.deadline).getTime() - Date.now()) /
          (1000 * 60 * 60 * 24 * 30)
      )
    );
    return Math.round((current.targetAmount - current.alreadySaved) / months);
  }, [current.deadline, current.targetAmount, current.alreadySaved]);

  return (
    <View style={{ gap: 18 }}>
      <BudBubble />
      <Headline>Make it real.</Headline>
      <Subheadline>
        A goal without a number is just a wish. Set one — you can always adjust later.
      </Subheadline>

      {/* Goal title */}
      <View>
        <Text style={styles.fieldLabel}>
          {goalMeta?.emoji} Name your goal
        </Text>
        <TextInput
          value={current.name}
          onChangeText={(v) => setField("name", v)}
          placeholder={defaultName}
          placeholderTextColor="rgba(255,255,255,0.35)"
          style={styles.input}
          maxLength={40}
          returnKeyType="done"
        />
      </View>

      {/* Amount */}
      <View>
        <Text style={styles.fieldLabel}>{suggestion.amountLabel}</Text>
        <View style={styles.amountInputRow}>
          <Text style={styles.dollar}>$</Text>
          <TextInput
            value={String(current.targetAmount)}
            onChangeText={(v) => {
              const n = parseInt(v.replace(/[^0-9]/g, ""), 10) || 0;
              setField("targetAmount", n);
            }}
            keyboardType="number-pad"
            placeholder="0"
            placeholderTextColor="rgba(255,255,255,0.35)"
            style={styles.amountInput}
            maxLength={9}
          />
        </View>
        <View style={styles.chipRow}>
          {suggestion.amountChips.map((c) => {
            const active = current.targetAmount === c;
            return (
              <Pressable
                key={c}
                onPress={() => setField("targetAmount", c)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  ${c.toLocaleString()}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Deadline chips */}
      <View>
        <Text style={styles.fieldLabel}>By when?</Text>
        <View style={styles.chipRow}>
          {suggestion.deadlines.map((d) => {
            const iso = addMonths(d.months);
            const active =
              current.deadline &&
              Math.abs(
                new Date(current.deadline).getTime() - new Date(iso).getTime()
              ) <
                1000 * 60 * 60 * 24 * 5; // within 5 days
            return (
              <Pressable
                key={d.label}
                onPress={() => setField("deadline", iso)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {d.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Why this goal matters */}
      <View>
        <Text style={styles.fieldLabel}>Why does this matter to you?</Text>
        <TextInput
          value={current.reason}
          onChangeText={(v) => setField("reason", v)}
          placeholder="One sentence. Bud will reference this when it counts."
          placeholderTextColor="rgba(255,255,255,0.35)"
          style={[styles.input, { minHeight: 70, textAlignVertical: "top" }]}
          multiline
          maxLength={140}
        />
      </View>

      {/* Pace estimate */}
      {monthlyPace !== null && monthlyPace > 0 && (
        <View style={styles.paceBox}>
          <Text style={styles.paceLabel}>Bud's math</Text>
          <Text style={styles.paceText}>
            That's about{" "}
            <Text style={styles.paceBold}>${monthlyPace.toLocaleString()}/mo</Text>{" "}
            to stay on track. Your first quest will reflect this pace.
          </Text>
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
    lineHeight: 21,
  },
  amountInputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.10)",
    borderRadius: 14,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  dollar: { fontSize: 22, fontWeight: "700", color: Colors.gold, marginRight: 6 },
  amountInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 22,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -0.5,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  chipActive: {
    borderColor: Colors.gold,
    backgroundColor: "rgba(244,168,50,0.15)",
  },
  chipText: { fontSize: 13, fontWeight: "600", color: "rgba(255,255,255,0.78)" },
  chipTextActive: { color: Colors.gold },

  paceBox: {
    backgroundColor: "rgba(244,168,50,0.08)",
    borderWidth: 1,
    borderColor: "rgba(244,168,50,0.25)",
    borderRadius: 14,
    padding: 14,
  },
  paceLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: Colors.gold,
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  paceText: { fontSize: 14, color: "#FFFFFF", lineHeight: 20 },
  paceBold: { fontWeight: "800", color: Colors.gold },
});

/**
 * Goal Detail — full-screen view of a single goal (developer review §Tab 3).
 *
 * Shows the large progress, amount saved / remaining, projected completion
 * based on the monthly commitment, milestone badges (25/50/75/100%), and the
 * action buttons the review calls for. Frontend-only: contribute / edit /
 * share / delete are wired to placeholders until the backend lands.
 */

import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { MotiView } from "moti";

import { Colors } from "@/constants/colors";
import { Icon, type IconName } from "@/components/Icon";
import { FadeInUp } from "@/animations";
import { goalsService } from "@/services/goalsService";
import type { Goal, GoalCategoryKind } from "@/mock/goals";
import { formatCurrency } from "@/utils/security";

const KIND_META: Record<GoalCategoryKind, { label: string; icon: IconName; tint: string }> = {
  emergency_fund: { label: "Safety", icon: "shield", tint: Colors.teal },
  debt_payoff: { label: "Debt", icon: "credit-card", tint: Colors.coral },
  savings_target: { label: "Savings", icon: "piggy-bank", tint: Colors.gold },
  invest: { label: "Investing", icon: "trending-up", tint: Colors.emerald },
  income_growth: { label: "Income", icon: "banknote", tint: Colors.emerald },
  stop_overspending: { label: "Spending", icon: "wallet", tint: Colors.coral },
  custom: { label: "Custom", icon: "target", tint: Colors.teal },
};

const MILESTONES = [25, 50, 75, 100];

export default function GoalDetailScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [goal, setGoal] = useState<Goal | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const g = await goalsService.detail(String(id));
        setGoal(g);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const meta = goal ? KIND_META[goal.kind] : null;

  const progress = useMemo(() => {
    if (!goal || goal.targetAmount === 0) return 0;
    return Math.min(1, goal.alreadySaved / goal.targetAmount);
  }, [goal]);

  const pct = Math.round(progress * 100);
  const remaining = goal ? Math.max(0, goal.targetAmount - goal.alreadySaved) : 0;
  const monthsLeft = goal && goal.monthlyCommit > 0 ? Math.ceil(remaining / goal.monthlyCommit) : null;

  const projected = useMemo(() => {
    if (monthsLeft == null) return null;
    const d = new Date();
    d.setMonth(d.getMonth() + monthsLeft);
    return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  }, [monthsLeft]);

  const back = () => {
    Haptics.selectionAsync();
    router.back();
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color={Colors.gold} />
      </View>
    );
  }

  if (!goal || !meta) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top }]}>
        <Text style={styles.missing}>This goal could not be found.</Text>
        <Pressable onPress={back} style={styles.missingBtn}>
          <Text style={styles.missingBtnText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={back} hitSlop={10} style={styles.iconBtn}>
          <Icon name="arrow-left" size={18} color={Colors.navy} strokeWidth={2.4} />
        </Pressable>
        <Text style={styles.topTitle} numberOfLines={1}>{goal.name}</Text>
        <Pressable onPress={() => placeholder()} hitSlop={10} style={styles.iconBtn}>
          <Icon name="settings" size={17} color={Colors.navy} strokeWidth={2.2} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 28 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero progress ring-ish header */}
        <FadeInUp>
          <View style={[styles.hero, { borderColor: `${meta.tint}40` }]}>
            <View style={[styles.kindIcon, { backgroundColor: `${meta.tint}1A`, borderColor: `${meta.tint}55` }]}>
              <Icon name={meta.icon} size={22} color={meta.tint} strokeWidth={2.2} />
            </View>
            <Text style={[styles.kindLabel, { color: meta.tint }]}>{meta.label.toUpperCase()}</Text>

            <Text style={styles.bigPct}>{pct}%</Text>
            <Text style={styles.bigAmount}>
              {formatCurrency(goal.alreadySaved)}{" "}
              <Text style={styles.bigAmountMuted}>of {formatCurrency(goal.targetAmount)}</Text>
            </Text>

            <View style={styles.barTrack}>
              <MotiView
                from={{ width: "0%" }}
                animate={{ width: `${pct}%` }}
                transition={{ type: "timing", duration: 800, delay: 150 }}
                style={[styles.barFill, { backgroundColor: meta.tint }]}
              />
            </View>

            <Text style={styles.reason}>“{goal.reason}”</Text>
          </View>
        </FadeInUp>

        {/* Key numbers */}
        <FadeInUp delay={80}>
          <View style={styles.numbersRow}>
            <NumberCell label="Remaining" value={formatCurrency(remaining, { compact: true })} />
            <View style={styles.numDivider} />
            <NumberCell label="Monthly" value={formatCurrency(goal.monthlyCommit, { compact: true })} />
            <View style={styles.numDivider} />
            <NumberCell label="On track for" value={projected ?? "—"} />
          </View>
        </FadeInUp>

        {/* Milestones */}
        <FadeInUp delay={140}>
          <Text style={styles.sectionLabel}>MILESTONES</Text>
          <View style={styles.milestoneRow}>
            {MILESTONES.map((m) => {
              const reached = pct >= m;
              return (
                <View
                  key={m}
                  style={[
                    styles.milestone,
                    reached && { backgroundColor: `${meta.tint}1A`, borderColor: `${meta.tint}80` },
                  ]}
                >
                  <Icon
                    name={reached ? "badge-check" : "lock"}
                    size={16}
                    color={reached ? meta.tint : Colors.muted}
                    strokeWidth={2.4}
                  />
                  <Text style={[styles.milestoneText, reached && { color: meta.tint }]}>{m}%</Text>
                </View>
              );
            })}
          </View>
        </FadeInUp>

        {/* Bud note */}
        <FadeInUp delay={200}>
          <View style={styles.budNote}>
            <Icon name="sparkles" size={15} color={Colors.teal} strokeWidth={2.4} />
            <Text style={styles.budNoteText}>
              {monthsLeft != null
                ? `At ${formatCurrency(goal.monthlyCommit)}/mo, you're about ${monthsLeft} ${
                    monthsLeft === 1 ? "month" : "months"
                  } from the finish line. Every contribution moves the date up.`
                : "Add a monthly amount and Bud can project your finish date."}
            </Text>
          </View>
        </FadeInUp>

        {/* Actions */}
        <FadeInUp delay={260}>
          <View style={styles.actionStack}>
            <Pressable
              style={({ pressed }) => [styles.primaryBtn, pressed && styles.primaryBtnPressed]}
              onPress={() => placeholder(Haptics.ImpactFeedbackStyle.Medium)}
            >
              <View style={styles.primaryBtnLeft}>
                <Text style={styles.primaryBtnText}>Log a contribution</Text>
              </View>
            </Pressable>

            <View style={styles.secondaryRow}>
              <SecondaryBtn icon="settings" label="Edit" onPress={() => placeholder()} />
              <SecondaryBtn icon="users" label="Share to Buds" onPress={() => placeholder()} />
            </View>

            <Pressable
              style={({ pressed }) => [styles.deleteBtn, pressed && { opacity: 0.85 }]}
              onPress={() => placeholder()}
            >
              <Icon name="alert-circle" size={16} color={Colors.coral} strokeWidth={2.4} />
              <Text style={styles.deleteBtnText}>Delete goal</Text>
            </Pressable>
          </View>
        </FadeInUp>
      </ScrollView>
    </View>
  );
}

function placeholder(style?: Haptics.ImpactFeedbackStyle) {
  if (style) Haptics.impactAsync(style);
  else Haptics.selectionAsync();
  // Wired to the backend in a later pass.
}

function NumberCell({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.numCell}>
      <Text style={styles.numValue} numberOfLines={1}>{value}</Text>
      <Text style={styles.numLabel}>{label}</Text>
    </View>
  );
}

function SecondaryBtn({
  icon,
  label,
  onPress,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.secondaryBtn, pressed && styles.secondaryBtnPressed]}
      onPress={onPress}
    >
      <Icon name={icon} size={16} color={Colors.navy} strokeWidth={2.2} />
      <Text style={styles.secondaryBtnText} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  center: { alignItems: "center", justifyContent: "center", gap: 14 },
  missing: { fontSize: 15, fontWeight: "700", color: Colors.navyMuted },
  missingBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: Colors.gold,
  },
  missingBtnText: { fontSize: 14, fontWeight: "800", color: Colors.onGreen },

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.navy50,
  },
  topTitle: { flex: 1, fontSize: 17, fontWeight: "800", color: Colors.navy, textAlign: "center" },

  scroll: { paddingHorizontal: 20, paddingTop: 6 },

  hero: {
    alignItems: "center",
    backgroundColor: Colors.card,
    borderRadius: 22,
    borderWidth: 1,
    paddingVertical: 26,
    paddingHorizontal: 20,
    marginBottom: 16,
    shadowColor: Colors.navy,
    shadowOpacity: 0.05,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  kindIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  kindLabel: { marginTop: 10, fontSize: 11, fontWeight: "800", letterSpacing: 1.4 },
  bigPct: { marginTop: 10, fontSize: 52, fontWeight: "800", color: Colors.navy, letterSpacing: -1.5 },
  bigAmount: { marginTop: 2, fontSize: 16, fontWeight: "800", color: Colors.navy },
  bigAmountMuted: { color: Colors.muted, fontWeight: "600" },
  barTrack: {
    alignSelf: "stretch",
    height: 10,
    borderRadius: 6,
    backgroundColor: Colors.border,
    overflow: "hidden",
    marginTop: 18,
  },
  barFill: { height: 10, borderRadius: 6 },
  reason: {
    marginTop: 16,
    fontSize: 14,
    fontStyle: "italic",
    color: Colors.navyMuted,
    textAlign: "center",
    lineHeight: 20,
  },

  numbersRow: {
    flexDirection: "row",
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 18,
    paddingVertical: 16,
    marginBottom: 22,
  },
  numCell: { flex: 1, alignItems: "center", gap: 5, paddingHorizontal: 4 },
  numDivider: { width: 1, backgroundColor: Colors.border, marginVertical: 4 },
  numValue: { fontSize: 16, fontWeight: "800", color: Colors.navy, letterSpacing: -0.2 },
  numLabel: { fontSize: 11, fontWeight: "600", color: Colors.muted },

  sectionLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: Colors.muted,
    letterSpacing: 1.2,
    marginBottom: 12,
    marginLeft: 4,
  },
  milestoneRow: { flexDirection: "row", gap: 10, marginBottom: 22 },
  milestone: {
    flex: 1,
    alignItems: "center",
    gap: 6,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  milestoneText: { fontSize: 13, fontWeight: "800", color: Colors.muted },

  budNote: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    backgroundColor: Colors.accentAlpha08,
    borderWidth: 1,
    borderColor: Colors.accentAlpha15,
    borderRadius: 16,
    padding: 14,
    marginBottom: 24,
  },
  budNoteText: { flex: 1, fontSize: 13, fontWeight: "600", color: Colors.navy, lineHeight: 19 },

  actionStack: {
    gap: 12,
    marginBottom: 8,
  },
  primaryBtn: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 56,
    backgroundColor: Colors.accent,
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 18,
    shadowColor: Colors.accent,
    shadowOpacity: 0.28,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  primaryBtnPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  primaryBtnLeft: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: "900",
    color: Colors.onAccent,
    letterSpacing: 0,
  },

  secondaryRow: { flexDirection: "row", gap: 12 },
  secondaryBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 72,
    paddingVertical: 13,
    paddingHorizontal: 10,
    borderRadius: 16,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  secondaryBtnPressed: { backgroundColor: Colors.navy50 },
  secondaryBtnText: { fontSize: 14, fontWeight: "800", color: Colors.navy },

  deleteBtn: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 14,
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.22)",
  },
  deleteBtnText: { fontSize: 14, fontWeight: "800", color: Colors.coral },
});

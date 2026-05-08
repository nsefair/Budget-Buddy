/**
 * Goals Tab — matches the CEO's vision drawing.
 *
 *   • Top stats: Total Saved · Active Goals · Monthly Committed
 *   • "+ Add New Goal" CTA
 *   • Goal cards — duration pill, reason quote, progress bar, monthly + deadline
 *
 * All copy passes the dev-guide voice rules:
 *   no shame, no childish emojis, supportive coach tone.
 */

import React, { useEffect, useMemo, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { Colors } from "@/constants/colors";
import { Icon, type IconName } from "@/components/Icon";
import { goalsService } from "@/services/goalsService";
import {
  type Goal,
  type GoalCategoryKind,
  type GoalDuration,
  type GoalsSummary,
} from "@/mock/goals";
import { formatCurrency, secureLog } from "@/utils/security";

const TAB_BAR_HEIGHT = 80;

// ─── Static metadata for goal kinds ──────────────────────────────────────────
const KIND_META: Record<
  GoalCategoryKind,
  { label: string; icon: IconName; tint: string }
> = {
  emergency_fund: { label: "Safety", icon: "shield", tint: Colors.teal },
  debt_payoff: { label: "Debt", icon: "credit-card", tint: Colors.coral },
  savings_target: { label: "Savings", icon: "piggy-bank", tint: Colors.gold },
  invest: { label: "Investing", icon: "trending-up", tint: Colors.emerald },
  income_growth: { label: "Income", icon: "banknote", tint: Colors.emerald },
  stop_overspending: { label: "Discipline", icon: "target", tint: Colors.gold },
  custom: { label: "Custom", icon: "sparkles", tint: Colors.gold },
};

const DURATION_META: Record<
  GoalDuration,
  { label: string; tint: string }
> = {
  short: { label: "SHORT-TERM", tint: Colors.teal },
  medium: { label: "MEDIUM-TERM", tint: Colors.gold },
  long: { label: "LONG-TERM", tint: "#9AAECF" },
};

export default function GoalsScreen() {
  const insets = useSafeAreaInsets();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [summary, setSummary] = useState<GoalsSummary | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const { goals, summary } = await goalsService.list();
      setGoals(goals);
      setSummary(summary);
    } catch (e) {
      secureLog.error("goals.list failed", e);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 16, paddingBottom: TAB_BAR_HEIGHT + 24 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.gold}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.eyebrow}>YOUR GOALS</Text>
          <Text style={styles.title}>What you're building.</Text>
        </View>

        {/* Summary — three top stats from the CEO drawing */}
        {summary && <SummaryRow summary={summary} />}

        {/* Add new goal CTA */}
        <Pressable
          style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.85 }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            // TODO: route to goal creation flow when built
          }}
        >
          <Icon name="plus" size={18} color={Colors.gold} strokeWidth={2.4} />
          <Text style={styles.addBtnText}>Add a new goal</Text>
        </Pressable>

        {/* Goal cards */}
        <View style={styles.grid}>
          {goals.map((g) => (
            <GoalCard key={g.id} goal={g} />
          ))}
        </View>

        {goals.length === 0 && (
          <View style={styles.emptyCard}>
            <Icon name="target" size={28} color={Colors.gold} />
            <Text style={styles.emptyTitle}>No active goals yet</Text>
            <Text style={styles.emptyBody}>
              Bud will help you turn the next milestone into a real, trackable goal.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ─── Summary cards row ──────────────────────────────────────────────────────

function SummaryRow({ summary }: { summary: GoalsSummary }) {
  return (
    <View style={styles.summaryRow}>
      <SummaryCell
        label="Total saved"
        value={formatCurrency(summary.totalSaved, { compact: true })}
        sub={`of ${formatCurrency(summary.totalTargetAcrossActive, { compact: true })} target`}
      />
      <SummaryCell label="Active" value={String(summary.activeCount)} sub="goals" />
      <SummaryCell
        label="Committed"
        value={formatCurrency(summary.monthlyCommittedTotal, { compact: true })}
        sub="per month"
      />
    </View>
  );
}

function SummaryCell({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <View style={styles.summaryCell}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summarySub}>{sub}</Text>
    </View>
  );
}

// ─── Goal card ──────────────────────────────────────────────────────────────

function GoalCard({ goal }: { goal: Goal }) {
  const meta = KIND_META[goal.kind];
  const duration = DURATION_META[goal.duration];

  const progress = useMemo(() => {
    if (goal.targetAmount === 0) return 0;
    return Math.min(1, goal.alreadySaved / goal.targetAmount);
  }, [goal.alreadySaved, goal.targetAmount]);

  const deadlineLabel = useMemo(() => {
    const d = new Date(goal.deadline);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }, [goal.deadline]);

  return (
    <Pressable
      style={({ pressed }) => [styles.goalCard, pressed && { opacity: 0.92 }]}
      onPress={() => Haptics.selectionAsync()}
    >
      {/* Top — kind icon + name + percent */}
      <View style={styles.goalTop}>
        <View style={[styles.kindIcon, { backgroundColor: `${meta.tint}1A`, borderColor: `${meta.tint}55` }]}>
          <Icon name={meta.icon} size={16} color={meta.tint} strokeWidth={2.2} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.goalName} numberOfLines={1}>{goal.name}</Text>
          <Text style={[styles.durationLabel, { color: duration.tint }]}>
            {duration.label}
          </Text>
        </View>
        <Text style={styles.goalPercent}>{Math.round(progress * 100)}%</Text>
      </View>

      {/* Reason */}
      <Text style={styles.goalReason} numberOfLines={2}>
        “{goal.reason}”
      </Text>

      {/* Progress amount + bar */}
      <View style={styles.amountRow}>
        <Text style={styles.amountSaved}>
          {formatCurrency(goal.alreadySaved)}
        </Text>
        <Text style={styles.amountTarget}>
          / {formatCurrency(goal.targetAmount)}
        </Text>
      </View>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${progress * 100}%`, backgroundColor: meta.tint }]} />
      </View>

      {/* Bottom — monthly + deadline */}
      <View style={styles.bottomRow}>
        <BottomCell
          label="Monthly"
          value={formatCurrency(goal.monthlyCommit)}
          icon="banknote"
        />
        <View style={styles.bottomDivider} />
        <BottomCell label="Deadline" value={deadlineLabel} icon="calendar" />
      </View>
    </Pressable>
  );
}

function BottomCell({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: IconName;
}) {
  return (
    <View style={styles.bottomCell}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Icon name={icon} size={11} color={Colors.muted} strokeWidth={2.2} />
        <Text style={styles.bottomLabel}>{label}</Text>
      </View>
      <Text style={styles.bottomValue}>{value}</Text>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  scroll: { paddingHorizontal: 18 },

  header: { marginBottom: 18 },
  eyebrow: {
    fontSize: 11,
    fontWeight: "800",
    color: Colors.gold,
    letterSpacing: 1.6,
    marginBottom: 6,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: Colors.navy,
    letterSpacing: -0.6,
  },

  summaryRow: {
    flexDirection: "row",
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 18,
    padding: 14,
    marginBottom: 14,
    shadowColor: Colors.navy,
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  summaryCell: { flex: 1, paddingHorizontal: 6, alignItems: "flex-start" },
  summaryLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: Colors.muted,
    letterSpacing: 1.1,
    marginBottom: 6,
    textTransform: "uppercase",
  },
  summaryValue: {
    fontSize: 19,
    fontWeight: "800",
    color: Colors.navy,
    letterSpacing: -0.3,
  },
  summarySub: { fontSize: 11, color: Colors.muted, marginTop: 3 },

  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "rgba(244,168,50,0.10)",
    borderWidth: 1.5,
    borderColor: "rgba(244,168,50,0.4)",
    borderStyle: "dashed",
    borderRadius: 14,
    paddingVertical: 14,
    marginBottom: 16,
  },
  addBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.gold,
    letterSpacing: 0.2,
  },

  grid: { gap: 12 },

  goalCard: {
    backgroundColor: Colors.card,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: Colors.navy,
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  goalTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
  },
  kindIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  goalName: {
    fontSize: 17,
    fontWeight: "800",
    color: Colors.navy,
    letterSpacing: -0.3,
  },
  durationLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2,
    marginTop: 2,
  },
  goalPercent: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.navy,
    letterSpacing: -0.3,
  },

  goalReason: {
    fontSize: 13,
    color: Colors.navyMuted,
    fontStyle: "italic",
    lineHeight: 19,
    marginBottom: 14,
  },

  amountRow: { flexDirection: "row", alignItems: "baseline", gap: 4, marginBottom: 8 },
  amountSaved: { fontSize: 19, fontWeight: "800", color: Colors.navy, letterSpacing: -0.4 },
  amountTarget: { fontSize: 13, fontWeight: "600", color: Colors.muted },

  barTrack: {
    height: 6,
    borderRadius: 4,
    backgroundColor: Colors.border,
    overflow: "hidden",
    marginBottom: 14,
  },
  barFill: { height: 6, borderRadius: 4 },

  bottomRow: {
    flexDirection: "row",
    backgroundColor: "rgba(27,43,75,0.04)",
    borderRadius: 12,
    padding: 12,
  },
  bottomCell: { flex: 1, gap: 4 },
  bottomDivider: { width: 1, backgroundColor: Colors.border, marginHorizontal: 12 },
  bottomLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: Colors.muted,
    letterSpacing: 0.8,
  },
  bottomValue: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.navy,
    letterSpacing: -0.1,
  },

  emptyCard: {
    alignItems: "center",
    backgroundColor: Colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 32,
    gap: 10,
  },
  emptyTitle: { fontSize: 16, fontWeight: "800", color: Colors.navy },
  emptyBody: { fontSize: 13, color: Colors.muted, textAlign: "center", lineHeight: 19 },
});

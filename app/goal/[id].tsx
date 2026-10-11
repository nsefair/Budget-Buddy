/**
 * Goal Detail — one goal in the card language of the Goals tab.
 *
 * A calm glow header with the goal's kind, name, and reason; the saved
 * amount rolling in with muted cents over a thin bar that grows; remaining,
 * monthly, and projected tiles; milestones (25/50/75/100%); Bud's note; and
 * the same actions as before (contribute, edit, delete).
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
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";

import { Colors } from "@/constants/colors";
import { Icon, type IconName } from "@/components/Icon";
import { CountUp, FadeInUp, GrowBar, useFocusReplay } from "@/animations";
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
const DANGER_TINT = "rgba(239, 68, 68, 0.1)";

export default function GoalDetailScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  // The saved amount and bar re-enter whenever this screen regains focus.
  const replay = useFocusReplay();
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
  const projected = useMemo(() => {
    if (!goal?.projectedCompletionDate) return null;
    const d = new Date(goal.projectedCompletionDate);
    return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  }, [goal?.projectedCompletionDate]);
  const deadline = useMemo(() => {
    if (!goal?.deadline) return null;
    const d = new Date(goal.deadline);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }, [goal?.deadline]);

  const back = () => {
    Haptics.selectionAsync();
    router.back();
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color={Colors.navyMuted} />
      </View>
    );
  }

  if (!goal || !meta) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top }]}>
        <Text style={styles.missing}>This goal could not be found.</Text>
        <Pressable
          accessibilityRole="button"
          onPress={back}
          style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
        >
          <Text style={styles.secondaryBtnText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <LinearGradient
            pointerEvents="none"
            colors={[Colors.accentAlpha14, Colors.accentAlpha05, "transparent"]}
            style={styles.glow}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to goals"
            hitSlop={8}
            onPress={back}
            style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
          >
            <Icon name="arrow-left" size={18} color={Colors.navy} strokeWidth={2.4} />
          </Pressable>

          <FadeInUp>
            <View style={styles.kindRow}>
              <View style={[styles.kindTile, { backgroundColor: `${meta.tint}1F` }]}>
                <Icon name={meta.icon} size={15} color={meta.tint} strokeWidth={2.3} />
              </View>
              <Text style={styles.eyebrow}>
                {meta.label.toUpperCase()}
                {goal.linkedAccountId ? " · AUTO TRACKING" : ""}
              </Text>
            </View>
            <Text style={styles.title} accessibilityRole="header" maxFontSizeMultiplier={1.3}>
              {goal.name}
            </Text>
            {goal.reason ? <Text style={styles.reason}>“{goal.reason}”</Text> : null}
          </FadeInUp>
        </View>

        <View style={styles.body}>
          {/* Saved so far */}
          <FadeInUp delay={60}>
            <View
              style={styles.card}
              accessible
              accessibilityLabel={`${formatCurrency(goal.alreadySaved)} saved of ${formatCurrency(goal.targetAmount)}${deadline ? ` by ${deadline}` : ""}, ${pct} percent.`}
            >
              <View style={styles.savedTop}>
                <Text style={styles.cardEyebrow}>SAVED</Text>
                <Text style={styles.percent}>{pct}%</Text>
              </View>
              <CountUp
                value={goal.alreadySaved}
                from={goal.alreadySaved * 0.9}
                replayKey={replay}
                format={formatCurrency}
                fit
                style={styles.saved}
                centsStyle={styles.savedCents}
              />
              <Text style={styles.target}>
                of {formatCurrency(goal.targetAmount)}
                {deadline ? ` by ${deadline}` : ""}
              </Text>
              <GrowBar
                progress={progress}
                color={meta.tint}
                trackColor={Colors.navy50}
                height={8}
                delay={120}
                duration={700}
                replayKey={replay}
                style={styles.bar}
              />
              <View style={styles.cells}>
                <Cell label="Remaining" value={formatCurrency(remaining, { compact: true })} />
                <Cell label="Monthly" value={formatCurrency(goal.monthlyCommit, { compact: true })} />
                <Cell label="On track for" value={projected ?? "—"} />
              </View>
            </View>
          </FadeInUp>

          {/* Milestones */}
          <FadeInUp delay={120}>
            <Text style={styles.groupTitle} accessibilityRole="header">
              Milestones
            </Text>
            <View style={[styles.card, styles.milestones]}>
              {MILESTONES.map((m) => {
                const reached = pct >= m;
                return (
                  <View
                    key={m}
                    style={styles.milestone}
                    accessible
                    accessibilityLabel={`${m} percent, ${reached ? "reached" : "not reached yet"}`}
                  >
                    <View
                      style={[
                        styles.milestoneTile,
                        reached ? { backgroundColor: `${meta.tint}1F` } : styles.milestoneTileOpen,
                      ]}
                    >
                      <Icon
                        name={reached ? "check" : "lock"}
                        size={15}
                        color={reached ? meta.tint : Colors.muted}
                        strokeWidth={2.6}
                      />
                    </View>
                    <Text style={[styles.milestoneText, reached && styles.milestoneTextReached]}>
                      {m}%
                    </Text>
                  </View>
                );
              })}
            </View>
          </FadeInUp>

          {/* Bud note */}
          <FadeInUp delay={180}>
            <View style={[styles.card, styles.note]}>
              <View style={styles.noteTile}>
                <Icon name="sparkles" size={15} color={Colors.gold} strokeWidth={2.4} />
              </View>
              <View style={styles.noteCopy}>
                <Text style={styles.cardEyebrow}>BUD</Text>
                <Text style={styles.noteText}>
                  {goal.trailing30DayContribution && projected
                    ? `Your last 30 days added ${formatCurrency(goal.trailing30DayContribution)}. At that pace, you're tracking toward ${projected}.`
                    : goal.linkedAccountId
                      ? "Automatic tracking is on. New transfers into the linked savings account will build your 30-day pace."
                      : "Log a contribution to start building your 30-day pace, or link a savings account from Edit goal."}
                </Text>
              </View>
            </View>
          </FadeInUp>

          {/* Actions */}
          <FadeInUp delay={240}>
            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
              onPress={() => openGoalAction(goal.id, "contribute", Haptics.ImpactFeedbackStyle.Medium)}
            >
              <Text style={styles.primaryBtnText}>Log a contribution</Text>
            </Pressable>
          </FadeInUp>

          <FadeInUp delay={300}>
            <View style={styles.actionsCard}>
              <ActionRow icon="pencil" label="Edit goal" onPress={() => openGoalAction(goal.id, "edit")} />
              <View style={styles.rowDivider} />
              <ActionRow
                icon="trash"
                label="Delete goal"
                danger
                accessibilityHint="Asks you to confirm before deleting"
                onPress={() => openGoalAction(goal.id, "delete")}
              />
            </View>
          </FadeInUp>
        </View>
      </ScrollView>
    </View>
  );
}

function openGoalAction(
  goalId: string,
  action: "contribute" | "edit" | "delete",
  style?: Haptics.ImpactFeedbackStyle,
) {
  if (style) Haptics.impactAsync(style);
  else Haptics.selectionAsync();
  router.push(`/goal-action?goalId=${encodeURIComponent(goalId)}&action=${action}`);
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.cell}>
      <Text style={styles.cellLabel}>{label}</Text>
      <Text style={styles.cellValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
        {value}
      </Text>
    </View>
  );
}

function ActionRow({
  icon,
  label,
  danger = false,
  accessibilityHint,
  onPress,
}: {
  icon: IconName;
  label: string;
  danger?: boolean;
  accessibilityHint?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <View style={[styles.rowTile, { backgroundColor: danger ? DANGER_TINT : Colors.accentAlpha12 }]}>
        <Icon name={icon} size={17} color={danger ? Colors.coral : Colors.gold} strokeWidth={2.3} />
      </View>
      <Text style={[styles.rowLabel, danger && styles.rowLabelDanger]}>{label}</Text>
      {danger ? null : (
        <Icon name="chevron-right" size={16} color={Colors.muted} strokeWidth={2.2} />
      )}
    </Pressable>
  );
}

const ROW_TILE = 36;
const ROW_INSET = 16;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  center: { alignItems: "center", justifyContent: "center", gap: 14 },
  pressed: { opacity: 0.8 },
  missing: { fontSize: 15, fontWeight: "700", color: Colors.navyMuted },

  // Header — the tabs' calm glow with back, kind, name, and reason.
  header: { paddingHorizontal: 20 },
  glow: { position: "absolute", top: 0, left: 0, right: 0, height: 360 },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    backgroundColor: Colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  kindRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  kindTile: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  eyebrow: { flexShrink: 1, fontSize: 10, fontWeight: "800", letterSpacing: 1.6, color: Colors.muted },
  title: {
    marginTop: 10,
    fontSize: 34,
    lineHeight: 40,
    fontWeight: "800",
    letterSpacing: -0.8,
    color: Colors.navy,
  },
  reason: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
    fontStyle: "italic",
    color: Colors.muted,
  },

  body: { paddingHorizontal: 18, paddingTop: 22, gap: 12 },
  card: {
    padding: 18,
    borderRadius: 22,
    backgroundColor: Colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  cardEyebrow: { fontSize: 10, fontWeight: "800", letterSpacing: 1.6, color: Colors.muted },

  // Saved card (matches the Goals card's amount, bar, and soft tiles)
  savedTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  percent: { fontSize: 14, fontWeight: "800", color: Colors.navy, fontVariant: ["tabular-nums"] },
  saved: {
    marginTop: 6,
    fontSize: 34,
    fontWeight: "800",
    letterSpacing: -1,
    color: Colors.navy,
  },
  // Cents sit quieter than dollars.
  savedCents: { color: Colors.muted, fontWeight: "700" },
  target: { marginTop: 2, fontSize: 13, fontWeight: "600", color: Colors.muted },
  bar: { marginTop: 16 },
  cells: { flexDirection: "row", gap: 8, marginTop: 16 },
  cell: {
    flex: 1,
    minWidth: 0,
    gap: 4,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: Colors.navy50,
  },
  cellLabel: { fontSize: 11, fontWeight: "600", color: Colors.muted },
  cellValue: { fontSize: 15, fontWeight: "800", color: Colors.navy, fontVariant: ["tabular-nums"] },

  // Milestones
  groupTitle: {
    marginTop: 12,
    marginBottom: 8,
    marginLeft: 4,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: Colors.muted,
  },
  milestones: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 22 },
  milestone: { alignItems: "center", gap: 6 },
  milestoneTile: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  milestoneTileOpen: { backgroundColor: Colors.navy50 },
  milestoneText: { fontSize: 12, fontWeight: "700", color: Colors.muted, fontVariant: ["tabular-nums"] },
  milestoneTextReached: { color: Colors.navy },

  // Bud note
  note: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  noteTile: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.accentAlpha12,
  },
  noteCopy: { flex: 1, minWidth: 0, gap: 4 },
  noteText: { fontSize: 14, lineHeight: 21, fontWeight: "500", color: Colors.navy },

  // Actions — Today's primary button, then quiet rows like Profile's menu.
  primaryBtn: {
    minHeight: 52,
    marginTop: 8,
    paddingHorizontal: 16,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.gold,
  },
  primaryBtnText: { fontSize: 16, fontWeight: "700", color: Colors.onAccent },
  secondaryBtn: {
    minHeight: 48,
    paddingHorizontal: 20,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  secondaryBtnText: { fontSize: 15, fontWeight: "700", color: Colors.navy },
  actionsCard: {
    overflow: "hidden",
    borderRadius: 22,
    backgroundColor: Colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 60,
    paddingHorizontal: ROW_INSET,
    paddingVertical: 10,
  },
  rowPressed: { backgroundColor: Colors.navy50 },
  rowTile: {
    width: ROW_TILE,
    height: ROW_TILE,
    borderRadius: ROW_TILE / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  rowLabel: { flex: 1, fontSize: 15, fontWeight: "700", color: Colors.navy },
  rowLabelDanger: { color: Colors.coral },
  // Hairlines start under the text, like grouped iOS lists.
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: ROW_INSET + ROW_TILE + 12,
    backgroundColor: Colors.border,
  },
});

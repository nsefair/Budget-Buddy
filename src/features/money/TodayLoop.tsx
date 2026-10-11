/**
 * The daily loop on Today (launch guide): yesterday's result with one tap to
 * put an underspend toward a goal, the last seven days, and the goal itself.
 *
 * Every figure comes from the server's stored mornings and allocations; days
 * without a stored morning show as empty, never guessed. Over days look calm,
 * never red: "handled", not punished.
 */

import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";

import { GrowBar } from "@/animations";
import { Icon, type IconName } from "@/components/Icon";
import { Colors } from "@/constants/colors";
import type { Goal } from "@/mock/goals";
import type { MoneyDayResult, MoneyYesterday } from "@/services/moneyService";
import { formatCurrency } from "@/utils/security";
import { money } from "./input";

const wholeDollars = (value: number) => `$${Math.round(value).toLocaleString("en-US")}`;
// Whole-dollar amounts drop the ".00"; anything else keeps its cents.
const dollars = (cents: number) => (cents % 100 === 0 ? wholeDollars(cents / 100) : money(cents));

const dayKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

// ─── Yesterday ──────────────────────────────────────────────────────────────

export function YesterdayCard({
  yesterday,
  goal,
  movedGoalName,
  moving,
  message,
  onMove,
}: {
  yesterday: MoneyYesterday;
  goal?: Goal;
  movedGoalName?: string;
  moving: boolean;
  message: string;
  onMove: (goal: Goal, cents: number) => void;
}) {
  const under = yesterday.morningCents - yesterday.spentCents;
  const content: { icon: IconName; tone: "brand" | "neutral"; title: string; sub: string } =
    yesterday.allocatedCents > 0
      ? {
          icon: "check-circle",
          tone: "brand",
          title: `Moved ${dollars(yesterday.allocatedCents)} to ${movedGoalName ?? "your goal"}`,
          sub: under > 0 ? `From yesterday's ${dollars(under)} under.` : "From yesterday's underspend.",
        }
      : yesterday.status === "under"
        ? { icon: "check", tone: "brand", title: `Yesterday: ${dollars(under)} under`, sub: `Spent ${dollars(Math.max(0, yesterday.spentCents))} of ${dollars(yesterday.morningCents)}` }
        : yesterday.status === "over"
          ? { icon: "activity", tone: "neutral", title: `Yesterday: ${dollars(-under)} over`, sub: "Spread across the days left. Handled." }
          : { icon: "check", tone: "brand", title: "Yesterday: right on your number", sub: `Spent ${dollars(yesterday.spentCents)}` };
  const canMove = Boolean(goal) && yesterday.allocatedCents === 0 && yesterday.movableCents > 0;

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={[styles.tile, content.tone === "brand" ? styles.tileBrand : styles.tileNeutral]}>
          <Icon name={content.icon} size={16} color={content.tone === "brand" ? Colors.gold : Colors.navyMuted} strokeWidth={2.4} />
        </View>
        <View style={styles.copy}>
          <Text style={styles.title}>{content.title}</Text>
          <Text style={styles.sub}>{content.sub}</Text>
        </View>
      </View>
      {canMove && goal ? (
        <Pressable
          accessibilityRole="button"
          accessibilityHint="Sets this amount aside for the goal. No money leaves your bank."
          disabled={moving}
          onPress={() => onMove(goal, yesterday.movableCents)}
          style={({ pressed }) => [styles.moveButton, (pressed || moving) && styles.pressed]}
        >
          {moving ? (
            <ActivityIndicator color={Colors.navy} />
          ) : (
            <>
              <Text style={styles.moveText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
                Put {dollars(yesterday.movableCents)} toward {goal.name}
              </Text>
              <Icon name="chevron-right" size={16} color={Colors.navy} strokeWidth={2.4} />
            </>
          )}
        </Pressable>
      ) : null}
      {!!message && <Text accessibilityRole="alert" style={styles.message}>{message}</Text>}
    </View>
  );
}

// ─── Last 7 days ────────────────────────────────────────────────────────────

export function WeekDots({ today, days }: { today: string; days: MoneyDayResult[] }) {
  const base = new Date(`${today}T12:00:00`);
  const keys = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(base);
    date.setDate(base.getDate() - (6 - index));
    return dayKey(date);
  });
  const byDate = new Map(days.map((day) => [day.date, day]));
  const finished = keys.slice(0, 6).map((key) => byDate.get(key)).filter((day): day is MoneyDayResult => Boolean(day));
  const underCount = finished.filter((day) => day.status !== "over").length;
  const summary = finished.length > 0 ? `${underCount} of ${finished.length} under` : "Your week starts today";

  return (
    <View style={styles.card} accessible accessibilityLabel={`Last 7 days: ${summary}.`}>
      <View style={styles.headerRow}>
        <Text style={styles.eyebrow}>LAST 7 DAYS</Text>
        <Text style={styles.headerValue}>{summary}</Text>
      </View>
      <View style={styles.dots}>
        {keys.map((key, index) => {
          const isToday = index === 6;
          const day = byDate.get(key);
          const label = isToday ? "Today" : new Date(`${key}T12:00:00`).toLocaleDateString("en-US", { weekday: "narrow" });
          return (
            <View key={key} style={styles.dotSlot}>
              <View
                style={[
                  styles.dot,
                  isToday
                    ? styles.dotToday
                    : !day
                      ? styles.dotEmpty
                      : day.status === "over"
                        ? styles.dotOver
                        : styles.dotUnder,
                ]}
              />
              <Text style={[styles.dotLabel, isToday && styles.dotLabelToday]}>{label}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ─── Goal ───────────────────────────────────────────────────────────────────

export function GoalBar({ goal, replayKey }: { goal: Goal; replayKey: number }) {
  const progress = goal.targetAmount > 0 ? Math.min(1, goal.alreadySaved / goal.targetAmount) : 0;
  const deadline = new Date(goal.deadline);
  const due = Number.isNaN(deadline.getTime())
    ? ""
    : ` · ${deadline.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${goal.name}: ${formatCurrency(goal.alreadySaved)} of ${formatCurrency(goal.targetAmount)}. Opens the goal.`}
      onPress={() => router.push(`/goal/${goal.id}`)}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.headerRow}>
        <Text style={styles.goalName} numberOfLines={1}>{goal.name}</Text>
        <Text style={styles.goalAmount} numberOfLines={1}>
          {formatCurrency(goal.alreadySaved)} of {formatCurrency(goal.targetAmount)}{due}
        </Text>
      </View>
      <GrowBar progress={progress} color={Colors.gold} trackColor={Colors.navy50} height={8} delay={120} replayKey={replayKey} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { padding: 18, gap: 14, backgroundColor: Colors.card, borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border },
  pressed: { opacity: 0.7 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  tile: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  tileBrand: { backgroundColor: Colors.accentAlpha12 },
  tileNeutral: { backgroundColor: Colors.navy50 },
  copy: { flex: 1, minWidth: 0 },
  title: { fontSize: 16, fontWeight: "800", color: Colors.navy },
  sub: { marginTop: 2, fontSize: 13, color: Colors.muted },
  // The one green thing in this card is an outline, not a fill (launch guide).
  moveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 48,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Colors.gold,
  },
  moveText: { flexShrink: 1, fontSize: 15, fontWeight: "700", color: Colors.navy },
  message: { fontSize: 13, color: Colors.navyMuted },

  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  eyebrow: { fontSize: 10, fontWeight: "800", letterSpacing: 1.6, color: Colors.muted },
  headerValue: { fontSize: 13, fontWeight: "700", color: Colors.navy },
  dots: { flexDirection: "row", justifyContent: "space-between" },
  dotSlot: { alignItems: "center", gap: 6, minWidth: 36 },
  dot: { width: 28, height: 28, borderRadius: 14 },
  dotUnder: { backgroundColor: Colors.gold },
  dotOver: { backgroundColor: Colors.navy100 },
  dotEmpty: { borderWidth: 1.5, borderColor: Colors.border },
  dotToday: { borderWidth: 1.5, borderColor: Colors.gold, borderStyle: "dashed" },
  dotLabel: { fontSize: 11, fontWeight: "600", color: Colors.muted },
  dotLabelToday: { color: Colors.navy, fontWeight: "700" },

  goalName: { flex: 1, fontSize: 16, fontWeight: "800", color: Colors.navy },
  goalAmount: { flexShrink: 1, fontSize: 13, fontWeight: "600", color: Colors.muted, fontVariant: ["tabular-nums"] },
});

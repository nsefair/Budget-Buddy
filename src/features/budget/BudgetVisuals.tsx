import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, G } from "react-native-svg";

import { CountUp, GrowBar, useEntranceProgress } from "@/animations";
import { Icon, hasIcon } from "@/components/Icon";
import { Colors } from "@/constants/colors";
import type { BudgetCategory, BudgetMonthOption, Transaction } from "@/mock/budget";
import { formatCurrency } from "@/utils/security";

const DONUT_SIZE = 166;
const DONUT_STROKE = 22;
const DONUT_RADIUS = (DONUT_SIZE - DONUT_STROKE) / 2;
const DONUT_CIRCUMFERENCE = 2 * Math.PI * DONUT_RADIUS;
const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// Some category colors (e.g. Housing's navy) disappear on dark surfaces.
export function readableTint(hex: string) {
  const value = parseInt(hex.replace("#", "").slice(0, 6), 16);
  if (Number.isNaN(value)) return Colors.navyMuted;
  const [r, g, b] = [(value >> 16) & 255, (value >> 8) & 255, value & 255];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 70 ? Colors.navyMuted : hex;
}

/**
 * CategoryIcon — the round tinted tile used for categories and transactions.
 * Without a category it shows a neutral in/out arrow (e.g. income).
 */
export function CategoryIcon({
  category,
  incoming = false,
  size = 36,
}: {
  category?: Pick<BudgetCategory, "icon" | "color">;
  incoming?: boolean;
  size?: number;
}) {
  const tile = { width: size, height: size, borderRadius: size / 2 };
  if (!category) {
    return (
      <View style={[styles.categoryIcon, tile, incoming && styles.categoryIconIncoming]}>
        <Icon
          name={incoming ? "arrow-down-right" : "arrow-up-right"}
          size={size * 0.4}
          color={incoming ? Colors.emerald : Colors.navyMuted}
          strokeWidth={2.3}
        />
      </View>
    );
  }
  return (
    <View style={[styles.categoryIcon, tile, { backgroundColor: `${category.color}1F` }]}>
      <Icon
        name={hasIcon(category.icon) ? category.icon : "receipt"}
        size={size * 0.44}
        color={readableTint(category.color)}
        strokeWidth={2.3}
      />
    </View>
  );
}
const BAR_TRACK_HEIGHT = 112;
const compactCurrency = (value: number) => formatCurrency(value, { compact: true });

type DonutSegment = {
  id: string;
  name: string;
  value: number;
  color: string;
};

function donutSegments(categories: BudgetCategory[]): DonutSegment[] {
  const ordered = categories
    .filter((category) => category.spent > 0)
    .sort((left, right) => right.spent - left.spent);

  if (ordered.length <= 5) {
    return ordered.map((category) => ({
      id: category.id,
      name: category.name,
      value: category.spent,
      color: category.color,
    }));
  }

  const primary = ordered.slice(0, 5).map((category) => ({
    id: category.id,
    name: category.name,
    value: category.spent,
    color: category.color,
  }));
  const other = ordered.slice(5).reduce((sum, category) => sum + category.spent, 0);

  return [
    ...primary,
    { id: "other", name: "Other", value: other, color: Colors.navy300 },
  ];
}

export function SpendingDonutChart({
  categories,
  totalSpent,
  replayKey,
}: {
  categories: BudgetCategory[];
  totalSpent: number;
  replayKey?: unknown;
}) {
  // A card-colored ring on top un-draws clockwise to reveal the segments.
  const reveal = useEntranceProgress(1, { replayKey, duration: 820 });
  const coverOffset = reveal.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -DONUT_CIRCUMFERENCE],
  });
  const segments = useMemo(() => donutSegments(categories), [categories]);
  const spokenSummary = segments
    .map((segment) => `${segment.name}, ${Math.round((segment.value / totalSpent) * 100)} percent`)
    .join(". ");
  let consumed = 0;

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Spending categories. ${spokenSummary}`}
      style={styles.donutLayout}
    >
      <View style={styles.donutWrap}>
        <Svg width={DONUT_SIZE} height={DONUT_SIZE}>
          <Circle
            cx={DONUT_SIZE / 2}
            cy={DONUT_SIZE / 2}
            r={DONUT_RADIUS}
            fill="none"
            stroke={Colors.border}
            strokeWidth={DONUT_STROKE}
          />
          <G rotation="-90" origin={`${DONUT_SIZE / 2}, ${DONUT_SIZE / 2}`}>
            {segments.map((segment) => {
              const share = totalSpent > 0 ? segment.value / totalSpent : 0;
              const length = Math.max(0, share * DONUT_CIRCUMFERENCE - 2.5);
              const offset = consumed * DONUT_CIRCUMFERENCE;
              consumed += share;

              return (
                <Circle
                  key={segment.id}
                  cx={DONUT_SIZE / 2}
                  cy={DONUT_SIZE / 2}
                  r={DONUT_RADIUS}
                  fill="none"
                  stroke={segment.color}
                  strokeWidth={DONUT_STROKE}
                  strokeDasharray={[length, DONUT_CIRCUMFERENCE - length]}
                  strokeDashoffset={-offset}
                />
              );
            })}
            <AnimatedCircle
              cx={DONUT_SIZE / 2}
              cy={DONUT_SIZE / 2}
              r={DONUT_RADIUS}
              fill="none"
              stroke={Colors.card}
              strokeWidth={DONUT_STROKE + 4}
              strokeDasharray={`${DONUT_CIRCUMFERENCE}`}
              strokeDashoffset={coverOffset}
            />
          </G>
        </Svg>
        <View pointerEvents="none" style={styles.donutCenter}>
          <Text style={styles.donutEyebrow}>SPENT</Text>
          <CountUp
            value={totalSpent}
            from={totalSpent * 0.6}
            replayKey={replayKey}
            format={compactCurrency}
            fit
            style={styles.donutTotal}
          />
          <Text style={styles.donutCaption}>this month</Text>
        </View>
      </View>

      <View style={styles.donutLegend}>
        {segments.map((segment) => {
          const percent = totalSpent > 0 ? Math.round((segment.value / totalSpent) * 100) : 0;
          return (
            <View key={segment.id} style={styles.donutLegendRow}>
              <View style={[styles.donutSwatch, { backgroundColor: segment.color }]} />
              <View style={styles.donutLegendCopy}>
                <Text numberOfLines={1} style={styles.donutLegendName}>
                  {segment.name}
                </Text>
                <Text style={styles.donutLegendAmount}>
                  {formatCurrency(segment.value, { compact: true })}
                </Text>
              </View>
              <Text style={styles.donutLegendPercent}>{percent}%</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

/**
 * MonthSpendBars — spending per month as tall rounded bars (reference: calm
 * finance charts). Fills rise from the bottom, staggered; tapping a bar
 * selects that month. Heights are relative to the highest month shown.
 */
export function MonthSpendBars({
  months,
  selectedMonthId,
  onSelect,
  replayKey,
}: {
  months: BudgetMonthOption[];
  selectedMonthId: string;
  onSelect: (monthId: string) => void;
  replayKey?: unknown;
}) {
  const scroller = useRef<ScrollView>(null);
  const peak = Math.max(1, ...months.map((month) => month.totalSpent));

  return (
    <ScrollView
      ref={scroller}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.barsRow}
      onContentSizeChange={() => scroller.current?.scrollToEnd({ animated: false })}
    >
      {months.map((month, index) => {
        const selected = month.id === selectedMonthId;
        return (
          <Pressable
            key={month.id}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={`${month.label}: ${formatCurrency(month.totalSpent)} spent`}
            onPress={() => onSelect(month.id)}
            style={styles.barSlot}
          >
            <Text
              style={[styles.barValue, selected && styles.barValueActive]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
            >
              {compactCurrency(month.totalSpent)}
            </Text>
            <GrowBar
              vertical
              progress={month.totalSpent / peak}
              color={selected ? Colors.gold : Colors.accentAlpha35}
              trackColor={Colors.navy50}
              height={34}
              delay={index * 60}
              duration={640}
              replayKey={replayKey}
              style={styles.barTrack}
            />
            <Text style={[styles.barLabel, selected && styles.barLabelActive]}>
              {month.shortLabel}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function monthParts(monthId: string) {
  const [yearValue, monthValue] = monthId.split("-").map(Number);
  return {
    year: Number.isFinite(yearValue) ? yearValue : new Date().getFullYear(),
    monthIndex: Number.isFinite(monthValue) ? monthValue - 1 : new Date().getMonth(),
  };
}

function dayKey(year: number, monthIndex: number, day: number) {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function isIncoming(transaction: Transaction) {
  const category = `${transaction.categoryId} ${transaction.category}`.toLowerCase();
  return transaction.amount < 0 || category.includes("income") || category.includes("paycheck");
}

function activityLabel(items: Transaction[]) {
  if (items.length === 0) return "No transactions";
  const outgoing = items.filter((item) => !isIncoming(item)).length;
  const incoming = items.filter(isIncoming).length;
  const recurring = items.filter((item) => item.isRecurring).length;
  return [
    outgoing ? `${outgoing} outgoing` : "",
    incoming ? `${incoming} incoming` : "",
    recurring ? `${recurring} recurring` : "",
  ]
    .filter(Boolean)
    .join(", ");
}

export function TransactionCalendar({
  monthId,
  monthLabel,
  transactions,
  categories = [],
}: {
  monthId: string;
  monthLabel: string;
  transactions: Transaction[];
  categories?: BudgetCategory[];
}) {
  const { year, monthIndex } = useMemo(() => monthParts(monthId), [monthId]);
  const transactionsByDay = useMemo(() => {
    const grouped = new Map<string, Transaction[]>();
    transactions.forEach((transaction) => {
      const key = transaction.date.slice(0, 10);
      grouped.set(key, [...(grouped.get(key) ?? []), transaction]);
    });
    return grouped;
  }, [transactions]);
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const firstWeekday = new Date(year, monthIndex, 1).getDay();
  const cells = Array.from({ length: 42 }, (_, index) => {
    const day = index - firstWeekday + 1;
    return day > 0 && day <= daysInMonth ? day : null;
  });
  const today = new Date();
  const todayKey = dayKey(today.getFullYear(), today.getMonth(), today.getDate());
  const [selectedKey, setSelectedKey] = useState("");

  useEffect(() => {
    const currentMonthId = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
    const firstActivity = [...transactionsByDay.keys()].sort()[0];
    setSelectedKey(
      monthId === currentMonthId
        ? todayKey
        : firstActivity ?? dayKey(year, monthIndex, 1),
    );
  }, [monthId, monthIndex, todayKey, transactionsByDay, year]);

  const selectedTransactions = transactionsByDay.get(selectedKey) ?? [];
  const selectedDate = selectedKey
    ? new Date(`${selectedKey}T12:00:00`)
    : new Date(year, monthIndex, 1);
  const activityDays = transactionsByDay.size;
  const recurringCount = transactions.filter((transaction) => transaction.isRecurring).length;

  return (
    <View style={styles.calendarContent}>
      <View style={styles.calendarSummary}>
        <View style={styles.calendarSummaryItem}>
          <View style={styles.calendarSummaryIcon}>
            <Icon name="calendar" size={15} color={Colors.navyMuted} strokeWidth={2.3} />
          </View>
          <View>
            <Text style={styles.calendarSummaryValue}>{activityDays}</Text>
            <Text style={styles.calendarSummaryLabel}>active days</Text>
          </View>
        </View>
        <View style={styles.calendarSummaryItem}>
          <View style={styles.calendarSummaryIcon}>
            <Icon name="activity" size={15} color={Colors.navyMuted} strokeWidth={2.3} />
          </View>
          <View>
            <Text style={styles.calendarSummaryValue}>{recurringCount}</Text>
            <Text style={styles.calendarSummaryLabel}>recurring</Text>
          </View>
        </View>
      </View>

      <View style={styles.calendarLegend}>
        <CalendarLegend color={Colors.coral} label="Spent" />
        <CalendarLegend color={Colors.gold} label="Recurring" ring />
        <CalendarLegend color={Colors.emerald} label="Money in" />
      </View>

      <View style={styles.weekdayRow}>
        {WEEKDAYS.map((weekday, index) => (
          <Text key={`${weekday}-${index}`} style={styles.weekdayLabel}>
            {weekday}
          </Text>
        ))}
      </View>

      <View style={styles.calendarGrid}>
        {cells.map((day, index) => {
          if (day === null) {
            return <View key={`empty-${index}`} style={styles.dayCell} />;
          }

          const key = dayKey(year, monthIndex, day);
          const items = transactionsByDay.get(key) ?? [];
          const selected = key === selectedKey;
          const hasSpending = items.some((item) => !isIncoming(item));
          const hasIncoming = items.some(isIncoming);
          const hasRecurring = items.some((item) => item.isRecurring);

          return (
            <View key={key} style={styles.dayCell}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${monthLabel} ${day}. ${activityLabel(items)}`}
                accessibilityState={{ selected }}
                hitSlop={2}
                onPress={() => setSelectedKey(key)}
                style={({ pressed }) => [
                  styles.dayButton,
                  key === todayKey && styles.todayButton,
                  selected && styles.selectedDayButton,
                  pressed && styles.dayButtonPressed,
                ]}
              >
                <Text style={[styles.dayNumber, selected && styles.selectedDayNumber]}>{day}</Text>
                <View style={styles.dayMarkers}>
                  {hasSpending ? <View style={[styles.dayDot, { backgroundColor: Colors.coral }]} /> : null}
                  {hasRecurring ? <View style={[styles.dayDot, styles.dayRecurringDot]} /> : null}
                  {hasIncoming ? <View style={[styles.dayDot, { backgroundColor: Colors.emerald }]} /> : null}
                </View>
              </Pressable>
            </View>
          );
        })}
      </View>

      <View style={styles.selectedDayPanel}>
        <View style={styles.selectedDayHeader}>
          <View>
            <Text style={styles.selectedDayEyebrow}>DAY DETAILS</Text>
            <Text style={styles.selectedDayTitle}>
              {selectedDate.toLocaleDateString("en-US", {
                weekday: "long",
                month: "short",
                day: "numeric",
              })}
            </Text>
          </View>
          {selectedTransactions.length ? (
            <View style={styles.activityCountBadge}>
              <Text style={styles.activityCountText}>{selectedTransactions.length}</Text>
            </View>
          ) : null}
        </View>

        {selectedTransactions.length === 0 ? (
          <View style={styles.noActivityRow}>
            <Icon name="check-circle" size={17} color={Colors.navyMuted} strokeWidth={2.3} />
            <Text style={styles.noActivityText}>No money moved on this day.</Text>
          </View>
        ) : (
          <View style={styles.dayTransactionList}>
            {selectedTransactions.map((transaction) => {
              const incoming = isIncoming(transaction);
              return (
                <View key={transaction.id} style={styles.dayTransactionRow}>
                  <CategoryIcon
                    category={incoming ? undefined : categories.find((category) => category.id === transaction.categoryId)}
                    incoming={incoming}
                    size={34}
                  />
                  <View style={styles.dayTransactionCopy}>
                    <Text numberOfLines={1} style={styles.dayTransactionMerchant}>
                      {transaction.merchant}
                    </Text>
                    <View style={styles.dayTransactionMeta}>
                      <Text numberOfLines={1} style={styles.dayTransactionCategory}>
                        {transaction.category}
                      </Text>
                      {transaction.isRecurring ? (
                        <Text style={styles.recurringBadgeText}>· Recurring</Text>
                      ) : null}
                    </View>
                  </View>
                  <Text
                    style={[
                      styles.dayTransactionAmount,
                      incoming && styles.dayTransactionIncome,
                    ]}
                  >
                    {incoming ? "+" : "−"}
                    {formatCurrency(Math.abs(transaction.amount))}
                  </Text>
                </View>
              );
            })}
          </View>
        )}
      </View>
    </View>
  );
}

function CalendarLegend({ color, label, ring = false }: { color: string; label: string; ring?: boolean }) {
  return (
    <View style={styles.calendarLegendItem}>
      <View
        style={[
          styles.calendarLegendDot,
          ring ? { borderColor: color, borderWidth: 2 } : { backgroundColor: color },
        ]}
      />
      <Text style={styles.calendarLegendText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  categoryIcon: { alignItems: "center", justifyContent: "center", backgroundColor: Colors.navy50 },
  categoryIconIncoming: { backgroundColor: Colors.emerald50 },
  barsRow: {
    flexGrow: 1,
    justifyContent: "space-between",
    gap: 6,
    paddingTop: 4,
    paddingBottom: 2,
  },
  barSlot: { minWidth: 48, alignItems: "center", gap: 8 },
  barTrack: { height: BAR_TRACK_HEIGHT },
  barValue: { fontSize: 11, fontWeight: "700", color: Colors.muted, fontVariant: ["tabular-nums"] },
  barValueActive: { color: Colors.navy },
  barLabel: { fontSize: 12, fontWeight: "600", color: Colors.muted },
  barLabelActive: { color: Colors.navy, fontWeight: "800" },
  donutLayout: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  donutWrap: {
    width: DONUT_SIZE,
    height: DONUT_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  donutCenter: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 34,
  },
  donutEyebrow: { fontSize: 10, fontWeight: "800", letterSpacing: 1.4, color: Colors.muted },
  donutTotal: { marginTop: 2, fontSize: 24, fontWeight: "800", color: Colors.navy, letterSpacing: -0.7 },
  donutCaption: { marginTop: 1, fontSize: 11, fontWeight: "600", color: Colors.muted },
  donutLegend: { flex: 1, gap: 10 },
  donutLegendRow: {
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  donutSwatch: { width: 10, height: 10, borderRadius: 5 },
  donutLegendCopy: { flex: 1, minWidth: 0 },
  donutLegendName: { fontSize: 12, fontWeight: "700", color: Colors.navy },
  donutLegendAmount: { marginTop: 1, fontSize: 11, fontWeight: "600", color: Colors.muted },
  donutLegendPercent: { fontSize: 12, fontWeight: "800", color: Colors.navy, fontVariant: ["tabular-nums"] },

  calendarContent: { gap: 14 },
  calendarSummary: { flexDirection: "row", gap: 8 },
  calendarSummaryItem: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 14, backgroundColor: Colors.navy50 },
  calendarSummaryIcon: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: Colors.card },
  calendarSummaryValue: { fontSize: 18, fontWeight: "800", color: Colors.navy, fontVariant: ["tabular-nums"] },
  calendarSummaryLabel: { fontSize: 11, fontWeight: "600", color: Colors.muted },
  calendarLegend: { flexDirection: "row", justifyContent: "center", gap: 16 },
  calendarLegendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  calendarLegendDot: { width: 8, height: 8, borderRadius: 99 },
  calendarLegendText: { fontSize: 11, fontWeight: "600", color: Colors.muted },
  weekdayRow: { flexDirection: "row" },
  weekdayLabel: {
    width: "14.2857%",
    textAlign: "center",
    fontSize: 9,
    fontWeight: "900",
    color: Colors.muted,
  },
  calendarGrid: { flexDirection: "row", flexWrap: "wrap" },
  dayCell: { width: "14.2857%", minHeight: 43, padding: 2 },
  dayButton: { flex: 1, alignItems: "center", justifyContent: "center", borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: "transparent", paddingVertical: 5 },
  todayButton: { borderColor: Colors.navy200 },
  selectedDayButton: { borderColor: Colors.greenSurfaceStrong, backgroundColor: Colors.greenSurfaceStrong },
  dayButtonPressed: { opacity: 0.72, transform: [{ scale: 0.96 }] },
  dayNumber: { fontSize: 13, fontWeight: "600", color: Colors.navyMuted, fontVariant: ["tabular-nums"] },
  selectedDayNumber: { color: Colors.navy, fontWeight: "800" },
  dayMarkers: { height: 6, marginTop: 3, flexDirection: "row", alignItems: "center", gap: 2 },
  dayDot: { width: 5, height: 5, borderRadius: 3 },
  dayRecurringDot: { borderWidth: 1.2, borderColor: Colors.gold, backgroundColor: "transparent" },
  selectedDayPanel: { padding: 14, borderRadius: 18, backgroundColor: Colors.navy50 },
  selectedDayHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  selectedDayEyebrow: { fontSize: 10, fontWeight: "800", letterSpacing: 1.4, color: Colors.muted },
  selectedDayTitle: { marginTop: 3, fontSize: 15, fontWeight: "800", color: Colors.navy },
  activityCountBadge: { minWidth: 28, height: 28, borderRadius: 14, paddingHorizontal: 8, alignItems: "center", justifyContent: "center", backgroundColor: Colors.card },
  activityCountText: { fontSize: 12, fontWeight: "800", color: Colors.navy },
  noActivityRow: { marginTop: 12, flexDirection: "row", alignItems: "center", gap: 8 },
  noActivityText: { fontSize: 13, fontWeight: "600", color: Colors.navyMuted },
  dayTransactionList: { marginTop: 12, gap: 12 },
  dayTransactionRow: { minWidth: 0, flexDirection: "row", alignItems: "center", gap: 10 },
  dayTransactionCopy: { flex: 1, minWidth: 0 },
  dayTransactionMerchant: { fontSize: 13, fontWeight: "700", color: Colors.navy },
  dayTransactionMeta: { marginTop: 2, flexDirection: "row", alignItems: "center", gap: 5 },
  dayTransactionCategory: { flexShrink: 1, fontSize: 11, fontWeight: "600", color: Colors.muted },
  recurringBadgeText: { fontSize: 11, fontWeight: "600", color: Colors.muted },
  dayTransactionAmount: { flexShrink: 0, fontSize: 13, fontWeight: "800", color: Colors.navy, fontVariant: ["tabular-nums"] },
  dayTransactionIncome: { color: Colors.emerald },
});

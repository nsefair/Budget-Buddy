import React, { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, G } from "react-native-svg";

import { Icon } from "@/components/Icon";
import { Colors } from "@/constants/colors";
import type { BudgetCategory, Transaction } from "@/mock/budget";
import { formatCurrency } from "@/utils/security";

const DONUT_SIZE = 166;
const DONUT_STROKE = 22;
const DONUT_RADIUS = (DONUT_SIZE - DONUT_STROKE) / 2;
const DONUT_CIRCUMFERENCE = 2 * Math.PI * DONUT_RADIUS;
const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

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
}: {
  categories: BudgetCategory[];
  totalSpent: number;
}) {
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
              const length = Math.max(0, share * DONUT_CIRCUMFERENCE - 3);
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
                  strokeLinecap="round"
                />
              );
            })}
          </G>
        </Svg>
        <View pointerEvents="none" style={styles.donutCenter}>
          <Text style={styles.donutEyebrow}>SPENT</Text>
          <Text adjustsFontSizeToFit numberOfLines={1} style={styles.donutTotal}>
            {formatCurrency(totalSpent, { compact: true })}
          </Text>
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

function isIncome(transaction: Transaction) {
  const category = `${transaction.categoryId} ${transaction.category}`.toLowerCase();
  return transaction.amount < 0 || category.includes("income") || category.includes("paycheck");
}

function activityLabel(items: Transaction[]) {
  if (items.length === 0) return "No transactions";
  const outgoing = items.filter((item) => !isIncome(item)).length;
  const incoming = items.filter(isIncome).length;
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
}: {
  monthId: string;
  monthLabel: string;
  transactions: Transaction[];
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
            <Icon name="calendar" size={15} color={Colors.gold} strokeWidth={2.4} />
          </View>
          <View>
            <Text style={styles.calendarSummaryValue}>{activityDays}</Text>
            <Text style={styles.calendarSummaryLabel}>active days</Text>
          </View>
        </View>
        <View style={styles.calendarSummaryDivider} />
        <View style={styles.calendarSummaryItem}>
          <View style={[styles.calendarSummaryIcon, styles.calendarRecurringIcon]}>
            <Icon name="activity" size={15} color={Colors.amber} strokeWidth={2.4} />
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
        <CalendarLegend color={Colors.emerald} label="Income" />
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
          const hasSpending = items.some((item) => !isIncome(item));
          const hasIncoming = items.some(isIncome);
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
            <Icon name="check-circle" size={17} color={Colors.teal} strokeWidth={2.3} />
            <Text style={styles.noActivityText}>No money moved on this day.</Text>
          </View>
        ) : (
          <View style={styles.dayTransactionList}>
            {selectedTransactions.map((transaction) => {
              const incoming = isIncome(transaction);
              return (
                <View key={transaction.id} style={styles.dayTransactionRow}>
                  <View
                    style={[
                      styles.dayTransactionIcon,
                      incoming ? styles.incomeIcon : styles.spendingIcon,
                    ]}
                  >
                    <Icon
                      name={incoming ? "arrow-down-right" : "receipt"}
                      size={14}
                      color={incoming ? Colors.emerald : Colors.coral}
                      strokeWidth={2.4}
                    />
                  </View>
                  <View style={styles.dayTransactionCopy}>
                    <Text numberOfLines={1} style={styles.dayTransactionMerchant}>
                      {transaction.merchant}
                    </Text>
                    <View style={styles.dayTransactionMeta}>
                      <Text numberOfLines={1} style={styles.dayTransactionCategory}>
                        {transaction.category}
                      </Text>
                      {transaction.isRecurring ? (
                        <View style={styles.recurringBadge}>
                          <Text style={styles.recurringBadgeText}>RECURRING</Text>
                        </View>
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
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 34,
  },
  donutEyebrow: {
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 1.2,
    color: Colors.gold,
  },
  donutTotal: {
    marginTop: 2,
    fontSize: 22,
    fontWeight: "900",
    color: Colors.navy,
    letterSpacing: -0.7,
  },
  donutCaption: {
    marginTop: 1,
    fontSize: 9,
    fontWeight: "700",
    color: Colors.muted,
  },
  donutLegend: { flex: 1, gap: 8 },
  donutLegendRow: {
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  donutSwatch: { width: 8, height: 8, borderRadius: 99 },
  donutLegendCopy: { flex: 1, minWidth: 0 },
  donutLegendName: { fontSize: 10, fontWeight: "800", color: Colors.navyMuted },
  donutLegendAmount: { marginTop: 1, fontSize: 9, fontWeight: "700", color: Colors.muted },
  donutLegendPercent: { fontSize: 10, fontWeight: "900", color: Colors.navy },

  calendarContent: { gap: 14 },
  calendarSummary: {
    minHeight: 66,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 15,
    borderWidth: 1,
    borderColor: Colors.greenBorder,
    backgroundColor: Colors.greenSurface,
    paddingHorizontal: 14,
  },
  calendarSummaryItem: { flex: 1, flexDirection: "row", alignItems: "center", gap: 9 },
  calendarSummaryDivider: { width: 1, height: 30, marginHorizontal: 12, backgroundColor: Colors.greenBorder },
  calendarSummaryIcon: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.accentAlpha25,
    backgroundColor: Colors.accentAlpha08,
  },
  calendarRecurringIcon: { borderColor: "rgba(245, 158, 11, 0.28)", backgroundColor: "rgba(245, 158, 11, 0.10)" },
  calendarSummaryValue: { fontSize: 17, fontWeight: "900", color: Colors.navy },
  calendarSummaryLabel: { marginTop: 1, fontSize: 9, fontWeight: "800", color: Colors.navyMuted },
  calendarLegend: { flexDirection: "row", justifyContent: "center", gap: 16 },
  calendarLegendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  calendarLegendDot: { width: 8, height: 8, borderRadius: 99 },
  calendarLegendText: { fontSize: 9, fontWeight: "800", color: Colors.muted },
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
  dayButton: {
    flex: 1,
    minHeight: 39,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 11,
    borderWidth: 1,
    borderColor: "transparent",
  },
  todayButton: { borderColor: Colors.greenBorder },
  selectedDayButton: { borderColor: Colors.gold, backgroundColor: Colors.greenSurfaceStrong },
  dayButtonPressed: { opacity: 0.72, transform: [{ scale: 0.96 }] },
  dayNumber: { fontSize: 11, fontWeight: "800", color: Colors.navyMuted },
  selectedDayNumber: { color: Colors.navy, fontWeight: "900" },
  dayMarkers: { height: 6, marginTop: 3, flexDirection: "row", alignItems: "center", gap: 2 },
  dayDot: { width: 4, height: 4, borderRadius: 99 },
  dayRecurringDot: { borderWidth: 1.2, borderColor: Colors.gold, backgroundColor: "transparent" },
  selectedDayPanel: {
    borderRadius: 15,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    padding: 13,
  },
  selectedDayHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  selectedDayEyebrow: { fontSize: 8, fontWeight: "900", letterSpacing: 1.1, color: Colors.gold },
  selectedDayTitle: { marginTop: 3, fontSize: 13, fontWeight: "900", color: Colors.navy },
  activityCountBadge: {
    minWidth: 26,
    height: 26,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 99,
    backgroundColor: Colors.gold,
  },
  activityCountText: { fontSize: 11, fontWeight: "900", color: Colors.onAccent },
  noActivityRow: { marginTop: 12, flexDirection: "row", alignItems: "center", gap: 8 },
  noActivityText: { fontSize: 11, fontWeight: "700", color: Colors.navyMuted },
  dayTransactionList: { marginTop: 11, gap: 9 },
  dayTransactionRow: { minWidth: 0, flexDirection: "row", alignItems: "center", gap: 9 },
  dayTransactionIcon: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9,
    borderWidth: 1,
  },
  spendingIcon: { borderColor: "rgba(239, 68, 68, 0.22)", backgroundColor: "rgba(239, 68, 68, 0.08)" },
  incomeIcon: { borderColor: Colors.emerald100, backgroundColor: Colors.emerald50 },
  dayTransactionCopy: { flex: 1, minWidth: 0 },
  dayTransactionMerchant: { fontSize: 11, fontWeight: "800", color: Colors.navy },
  dayTransactionMeta: { marginTop: 2, flexDirection: "row", alignItems: "center", gap: 5 },
  dayTransactionCategory: { flexShrink: 1, fontSize: 9, fontWeight: "600", color: Colors.muted },
  recurringBadge: { borderRadius: 5, borderWidth: 1, borderColor: "rgba(245, 158, 11, 0.28)", paddingHorizontal: 4, paddingVertical: 2 },
  recurringBadgeText: { fontSize: 6.5, fontWeight: "900", letterSpacing: 0.5, color: Colors.amber },
  dayTransactionAmount: { fontSize: 11, fontWeight: "900", color: Colors.navy },
  dayTransactionIncome: { color: Colors.emerald },
});

import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Colors } from "@/constants/colors";
import { MOCK_BUDGET_OVERVIEW, MOCK_TRANSACTIONS } from "@/mock/budget";

const TAB_BAR_HEIGHT = 80;

export default function BudgetScreen() {
  const insets = useSafeAreaInsets();
  const [selectedMonth, setSelectedMonth] = useState("May 2026");

  const { totalBudget, totalSpent, income, savingsRate, avgDailySpend, categories } = MOCK_BUDGET_OVERVIEW;
  const remaining = totalBudget - totalSpent;
  const spentPct = Math.min((totalSpent / totalBudget) * 100, 100);

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={["#0E1926", "#1B2B4B"]}
        style={[styles.header, { paddingTop: insets.top + 12 }]}
      >
        <Text style={styles.wordmark}>Budget Buddy</Text>
        <Text style={styles.headerTitle}>Budget</Text>

        {/* Month selector */}
        <View style={styles.monthSelector}>
          <Pressable style={styles.monthArrow}>
            <Text style={styles.monthArrowText}>‹</Text>
          </Pressable>
          <Text style={styles.monthText}>{selectedMonth}</Text>
          <Pressable style={styles.monthArrow}>
            <Text style={styles.monthArrowText}>›</Text>
          </Pressable>
        </View>

        {/* Overview stats */}
        <View style={styles.overviewRow}>
          <View style={styles.overviewStat}>
            <Text style={styles.overviewStatLabel}>Income</Text>
            <Text style={[styles.overviewStatValue, { color: Colors.emerald }]}>
              ${income.toLocaleString()}
            </Text>
          </View>
          <View style={styles.overviewStatDivider} />
          <View style={styles.overviewStat}>
            <Text style={styles.overviewStatLabel}>Spent</Text>
            <Text style={[styles.overviewStatValue, { color: Colors.coral }]}>
              ${totalSpent.toLocaleString()}
            </Text>
          </View>
          <View style={styles.overviewStatDivider} />
          <View style={styles.overviewStat}>
            <Text style={styles.overviewStatLabel}>Remaining</Text>
            <Text style={[styles.overviewStatValue, { color: remaining > 0 ? "#FFF" : Colors.coral }]}>
              ${remaining.toLocaleString()}
            </Text>
          </View>
        </View>

        {/* Main progress bar */}
        <View style={styles.mainProgressTrack}>
          <View style={[styles.mainProgressFill, { width: `${spentPct}%`, backgroundColor: spentPct > 90 ? Colors.coral : spentPct > 75 ? Colors.amber : Colors.emerald }]} />
        </View>
        <Text style={styles.progressLabel}>{Math.round(spentPct)}% of monthly budget used</Text>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Quick stats */}
        <View style={styles.quickStats}>
          <View style={styles.quickStat}>
            <Text style={styles.quickStatValue}>{savingsRate}%</Text>
            <Text style={styles.quickStatLabel}>Savings Rate</Text>
          </View>
          <View style={styles.quickStatDivider} />
          <View style={styles.quickStat}>
            <Text style={styles.quickStatValue}>${avgDailySpend}</Text>
            <Text style={styles.quickStatLabel}>Avg Daily Spend</Text>
          </View>
          <View style={styles.quickStatDivider} />
          <View style={styles.quickStat}>
            <Text style={[styles.quickStatValue, { color: Colors.emerald }]}>
              ${(income - totalSpent).toLocaleString()}
            </Text>
            <Text style={styles.quickStatLabel}>Net Cash Flow</Text>
          </View>
        </View>

        {/* Category breakdown */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Categories</Text>
          <Pressable>
            <Text style={styles.sectionAction}>Edit Budget</Text>
          </Pressable>
        </View>

        <View style={styles.categoriesContainer}>
          {categories.map((cat) => {
            const pct = Math.min((cat.spent / cat.budgetLimit) * 100, 100);
            const isOver = cat.spent > cat.budgetLimit;
            const isNear = pct > 80 && !isOver;
            const barColor = isOver ? Colors.coral : isNear ? Colors.amber : Colors.emerald;

            return (
              <Pressable key={cat.id} style={styles.categoryCard}>
                <View style={styles.categoryRow}>
                  <View style={styles.categoryLeft}>
                    <Text style={styles.categoryIcon}>{cat.icon}</Text>
                    <View>
                      <Text style={styles.categoryName}>{cat.name}</Text>
                      {isOver && (
                        <Text style={styles.overspendBadge}>
                          ${(cat.spent - cat.budgetLimit).toFixed(0)} over
                        </Text>
                      )}
                    </View>
                  </View>
                  <View style={styles.categoryAmounts}>
                    <Text style={[styles.categorySpent, isOver && { color: Colors.coral }]}>
                      ${cat.spent}
                    </Text>
                    <Text style={styles.categoryLimit}> / ${cat.budgetLimit}</Text>
                  </View>
                </View>
                <View style={styles.categoryTrack}>
                  <View
                    style={[
                      styles.categoryFill,
                      { width: `${pct}%`, backgroundColor: barColor },
                    ]}
                  />
                </View>
              </Pressable>
            );
          })}
        </View>

        {/* Recent Transactions */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Transactions</Text>
          <Pressable>
            <Text style={styles.sectionAction}>+ Add Manual</Text>
          </Pressable>
        </View>

        <View style={styles.transactionsList}>
          {MOCK_TRANSACTIONS.map((txn, idx) => (
            <React.Fragment key={txn.id}>
              <Pressable style={styles.txnRow}>
                <View style={styles.txnLeft}>
                  <View style={[styles.txnDot, { backgroundColor: categories.find(c => c.id === txn.categoryId)?.color ?? Colors.muted }]} />
                  <View>
                    <Text style={styles.txnMerchant}>{txn.merchant}</Text>
                    <Text style={styles.txnMeta}>
                      {txn.category}{txn.isRecurring ? " · Recurring" : ""}{txn.isManual ? " · Manual" : ""}
                    </Text>
                  </View>
                </View>
                <View style={styles.txnRight}>
                  <Text style={styles.txnAmount}>-${txn.amount.toFixed(2)}</Text>
                  <Text style={styles.txnDate}>
                    {new Date(txn.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </Text>
                </View>
              </Pressable>
              {idx < MOCK_TRANSACTIONS.length - 1 && (
                <View style={styles.txnDivider} />
              )}
            </React.Fragment>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  header: { paddingHorizontal: 20, paddingBottom: 20 },
  wordmark: { fontSize: 13, fontWeight: "600", color: "rgba(255,255,255,0.4)", letterSpacing: 2, textTransform: "uppercase", textAlign: "center", marginBottom: 4 },
  headerTitle: { fontSize: 28, fontWeight: "800", color: "#FFF", letterSpacing: -0.5, marginBottom: 12 },
  monthSelector: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
  monthArrow: { padding: 8 },
  monthArrowText: { fontSize: 22, color: Colors.gold, fontWeight: "300" },
  monthText: { fontSize: 16, fontWeight: "700", color: "#FFF", flex: 1, textAlign: "center" },
  overviewRow: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  overviewStat: { flex: 1, alignItems: "center" },
  overviewStatLabel: { fontSize: 11, color: Colors.muted, fontWeight: "500", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 },
  overviewStatValue: { fontSize: 20, fontWeight: "800" },
  overviewStatDivider: { width: 1, height: 36, backgroundColor: "rgba(255,255,255,0.1)" },
  mainProgressTrack: { height: 6, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 3, marginBottom: 6 },
  mainProgressFill: { height: 6, borderRadius: 3 },
  progressLabel: { fontSize: 11, color: Colors.muted, textAlign: "right" },
  scrollContent: { paddingHorizontal: 20, gap: 0 },
  quickStats: { flexDirection: "row", backgroundColor: Colors.card, borderRadius: 16, marginTop: 16, marginBottom: 8, overflow: "hidden", shadowColor: Colors.navy, shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  quickStat: { flex: 1, alignItems: "center", paddingVertical: 16 },
  quickStatValue: { fontSize: 18, fontWeight: "800", color: Colors.navy, marginBottom: 3 },
  quickStatLabel: { fontSize: 11, color: Colors.muted, fontWeight: "500" },
  quickStatDivider: { width: 1, backgroundColor: Colors.border, marginVertical: 12 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 20, marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: Colors.navy },
  sectionAction: { fontSize: 13, color: Colors.gold, fontWeight: "600" },
  categoriesContainer: { gap: 8 },
  categoryCard: { backgroundColor: Colors.card, borderRadius: 14, padding: 14, gap: 10, shadowColor: Colors.navy, shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  categoryRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  categoryLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  categoryIcon: { fontSize: 22, width: 32, textAlign: "center" },
  categoryName: { fontSize: 14, fontWeight: "600", color: Colors.navy },
  overspendBadge: { fontSize: 11, color: Colors.coral, fontWeight: "600", marginTop: 2 },
  categoryAmounts: { flexDirection: "row", alignItems: "baseline" },
  categorySpent: { fontSize: 15, fontWeight: "700", color: Colors.navy },
  categoryLimit: { fontSize: 12, color: Colors.muted },
  categoryTrack: { height: 4, backgroundColor: Colors.border, borderRadius: 2 },
  categoryFill: { height: 4, borderRadius: 2 },
  transactionsList: { backgroundColor: Colors.card, borderRadius: 16, overflow: "hidden", shadowColor: Colors.navy, shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  txnRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 13 },
  txnLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  txnDot: { width: 10, height: 10, borderRadius: 5 },
  txnMerchant: { fontSize: 14, fontWeight: "600", color: Colors.navy },
  txnMeta: { fontSize: 11, color: Colors.muted, marginTop: 2 },
  txnRight: { alignItems: "flex-end" },
  txnAmount: { fontSize: 14, fontWeight: "700", color: Colors.navy },
  txnDate: { fontSize: 11, color: Colors.muted, marginTop: 2 },
  txnDivider: { height: 1, backgroundColor: Colors.border, marginHorizontal: 16 },
});

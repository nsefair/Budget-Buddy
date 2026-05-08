/**
 * Budget Tab — Money Truth + Investments + Accounts
 *
 * Matches the CEO's drawing:
 *   • Top 4 stat cards (Income, Spent, Saving Rate, Avg Daily Spend)
 *   • Spending Breakdown (donut substitute via segmented bar)
 *   • Trends placeholder + Budget Detail (category fill bars)
 *   • Recent | Upcoming transactions (segmented)
 *   • Investment Portfolio (holdings)
 *   • Accounts list (checking / credit / savings / investments + Net Cash)
 *
 * No emojis anywhere — every glyph is a Lucide icon. Numbers are the heroes.
 */

import React, { useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

import { Colors } from "@/constants/colors";
import { Icon, type IconName } from "@/components/Icon";
import {
  MOCK_BUDGET_OVERVIEW,
  MOCK_TRANSACTIONS,
  MOCK_HOLDINGS,
  MOCK_INVESTMENT_SUMMARY,
  MOCK_ACCOUNTS,
  MOCK_UPCOMING_BILLS,
  type BudgetCategory,
} from "@/mock/budget";
import { formatCurrency } from "@/utils/security";

const TAB_BAR_HEIGHT = 80;

// Map category id → curated icon for a pro look.
const CATEGORY_ICON: Record<string, IconName> = {
  food: "receipt",
  transport: "activity",
  shopping: "wallet",
  housing: "home",
  entertainment: "star",
  health: "shield",
  personal: "user",
  education: "layers",
};

export default function BudgetScreen() {
  const insets = useSafeAreaInsets();
  const [txnTab, setTxnTab] = useState<"recent" | "upcoming">("recent");

  const overview = MOCK_BUDGET_OVERVIEW;
  const savingsRate = Math.round(overview.savingsRate);
  const recent = MOCK_TRANSACTIONS.slice(0, 4);

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 16, paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.eyebrow}>{overview.month.toUpperCase()}</Text>
          <Text style={styles.title}>Budget</Text>
        </View>

        {/* 4 stat tiles */}
        <View style={styles.statGrid}>
          <StatTile
            label="Monthly income"
            value={formatCurrency(overview.income, { compact: true })}
            icon="banknote"
            tint={Colors.emerald}
          />
          <StatTile
            label="Total spent"
            value={formatCurrency(overview.totalSpent, { compact: true })}
            sub={`of ${formatCurrency(overview.totalBudget, { compact: true })}`}
            icon="receipt"
            tint={Colors.gold}
          />
          <StatTile
            label="Saving rate"
            value={`${savingsRate}%`}
            sub={`${formatCurrency((overview.income * savingsRate) / 100, { compact: true })}/mo`}
            icon="piggy-bank"
            tint={Colors.teal}
          />
          <StatTile
            label="Avg daily spend"
            value={formatCurrency(overview.avgDailySpend)}
            sub="this week"
            icon="line-chart"
            tint={Colors.navyMuted}
          />
        </View>

        {/* Spending breakdown — segmented bar */}
        <Card>
          <CardHeader title="Spending breakdown" hint="By category" />
          <SegmentedBar categories={overview.categories} totalSpent={overview.totalSpent} />
          <View style={styles.legend}>
            {overview.categories.slice(0, 6).map((c) => (
              <View key={c.id} style={styles.legendItem}>
                <View style={[styles.legendSwatch, { backgroundColor: c.color }]} />
                <Text style={styles.legendText} numberOfLines={1}>
                  {c.name}
                </Text>
              </View>
            ))}
          </View>
        </Card>

        {/* Budget detail — category fill bars */}
        <Card>
          <CardHeader title="Budget detail" hint="Per category" />
          <View style={{ gap: 12 }}>
            {overview.categories.map((c) => (
              <CategoryRow key={c.id} category={c} />
            ))}
          </View>
        </Card>

        {/* Transactions — Recent | Upcoming */}
        <Card>
          <CardHeader title="Transactions" />
          <View style={styles.txnTabs}>
            <TabPill label="Recent" active={txnTab === "recent"} onPress={() => setTxnTab("recent")} />
            <TabPill label="Upcoming" active={txnTab === "upcoming"} onPress={() => setTxnTab("upcoming")} />
          </View>

          {txnTab === "recent" ? (
            <View style={styles.txnList}>
              {recent.map((t, i) => (
                <React.Fragment key={t.id}>
                  <TransactionRow
                    merchant={t.merchant}
                    sub={`${t.category}${t.isRecurring ? " · Recurring" : ""}`}
                    amount={-t.amount}
                  />
                  {i < recent.length - 1 && <View style={styles.txnDivider} />}
                </React.Fragment>
              ))}
            </View>
          ) : (
            <View style={styles.txnList}>
              {MOCK_UPCOMING_BILLS.map((b, i) => {
                const days = Math.max(
                  0,
                  Math.ceil((new Date(b.dueAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                );
                return (
                  <React.Fragment key={b.id}>
                    <TransactionRow
                      merchant={b.merchant}
                      sub={`${b.category} · ${days === 0 ? "Today" : days === 1 ? "Tomorrow" : `In ${days} days`}`}
                      amount={-b.amount}
                    />
                    {i < MOCK_UPCOMING_BILLS.length - 1 && <View style={styles.txnDivider} />}
                  </React.Fragment>
                );
              })}
            </View>
          )}
        </Card>

        {/* Investment portfolio */}
        <Card>
          <CardHeader
            title="Investment portfolio"
            right={
              <Text style={styles.totalValue}>
                {formatCurrency(MOCK_INVESTMENT_SUMMARY.totalValue, { compact: true })}
              </Text>
            }
          />
          <View style={{ gap: 10 }}>
            {MOCK_HOLDINGS.map((h) => (
              <View key={h.id} style={styles.holdingRow}>
                <View style={styles.tickerBadge}>
                  <Text style={styles.tickerText}>{h.ticker}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.holdingName}>{h.name}</Text>
                  <Text style={styles.holdingShares}>
                    {h.shares} {h.shares === 1 ? "share" : "shares"}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={styles.holdingValue}>{formatCurrency(h.value)}</Text>
                  <View style={styles.holdingChange}>
                    <Icon
                      name={h.changePct >= 0 ? "trending-up" : "trending-down"}
                      size={11}
                      color={h.changePct >= 0 ? Colors.emerald : Colors.coral}
                    />
                    <Text
                      style={[
                        styles.holdingChangeText,
                        { color: h.changePct >= 0 ? Colors.emerald : Colors.coral },
                      ]}
                    >
                      {h.changePct >= 0 ? "+" : ""}
                      {h.changePct.toFixed(2)}%
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </Card>

        {/* Accounts */}
        <Card>
          <CardHeader title="Accounts" />
          <AccountsBlock />
        </Card>
      </ScrollView>
    </View>
  );
}

// ─── Reusable building blocks ────────────────────────────────────────────────

function Card({ children }: { children: React.ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

function CardHeader({
  title,
  hint,
  right,
}: {
  title: string;
  hint?: string;
  right?: React.ReactNode;
}) {
  return (
    <View style={styles.cardHeader}>
      <View style={{ flex: 1 }}>
        <Text style={styles.cardTitle}>{title}</Text>
        {hint && <Text style={styles.cardHint}>{hint}</Text>}
      </View>
      {right}
    </View>
  );
}

function StatTile({
  label,
  value,
  sub,
  icon,
  tint,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: IconName;
  tint: string;
}) {
  return (
    <View style={styles.statTile}>
      <View style={[styles.statIcon, { backgroundColor: `${tint}1A`, borderColor: `${tint}55` }]}>
        <Icon name={icon} size={14} color={tint} strokeWidth={2.4} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      {sub && <Text style={styles.statSub}>{sub}</Text>}
    </View>
  );
}

function SegmentedBar({
  categories,
  totalSpent,
}: {
  categories: BudgetCategory[];
  totalSpent: number;
}) {
  return (
    <View style={styles.segmentedBar}>
      {categories.map((c) => {
        const w = (c.spent / totalSpent) * 100;
        if (w <= 0) return null;
        return (
          <View
            key={c.id}
            style={{
              width: `${w}%`,
              height: "100%",
              backgroundColor: c.color,
            }}
          />
        );
      })}
    </View>
  );
}

function CategoryRow({ category }: { category: BudgetCategory }) {
  const pct = useMemo(() => {
    if (category.budgetLimit === 0) return 0;
    return Math.min(1.2, category.spent / category.budgetLimit);
  }, [category]);
  const over = pct > 1;
  const fillColor = over
    ? Colors.coral
    : pct > 0.85
    ? Colors.amber
    : category.color;

  const iconName = CATEGORY_ICON[category.id] ?? "wallet";

  return (
    <View>
      <View style={styles.catRow}>
        <View style={styles.catLeft}>
          <View style={[styles.catIcon, { borderColor: `${category.color}55`, backgroundColor: `${category.color}15` }]}>
            <Icon name={iconName} size={13} color={category.color} strokeWidth={2.4} />
          </View>
          <Text style={styles.catName}>{category.name}</Text>
        </View>
        <Text style={styles.catNumbers}>
          {formatCurrency(category.spent, { compact: true })}{" "}
          <Text style={styles.catBudget}>
            / {formatCurrency(category.budgetLimit, { compact: true })}
          </Text>
        </Text>
      </View>
      <View style={styles.catTrack}>
        <View
          style={[
            styles.catFill,
            {
              width: `${Math.min(100, pct * 100)}%`,
              backgroundColor: fillColor,
            },
          ]}
        />
      </View>
    </View>
  );
}

function TabPill({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      style={[styles.tabPill, active && styles.tabPillActive]}
    >
      <Text style={[styles.tabPillText, active && styles.tabPillTextActive]}>{label}</Text>
    </Pressable>
  );
}

function TransactionRow({
  merchant,
  sub,
  amount,
}: {
  merchant: string;
  sub: string;
  amount: number;
}) {
  return (
    <View style={styles.txnRow}>
      <View style={styles.txnLeft}>
        <View style={styles.txnIconBox}>
          <Icon
            name={amount < 0 ? "arrow-down-right" : "arrow-up-right"}
            size={13}
            color={amount < 0 ? Colors.muted : Colors.emerald}
          />
        </View>
        <View>
          <Text style={styles.txnMerchant}>{merchant}</Text>
          <Text style={styles.txnSub}>{sub}</Text>
        </View>
      </View>
      <Text
        style={[
          styles.txnAmount,
          { color: amount < 0 ? Colors.navy : Colors.emerald },
        ]}
      >
        {formatCurrency(amount, { sign: true })}
      </Text>
    </View>
  );
}

function AccountsBlock() {
  const totalAssets = MOCK_ACCOUNTS
    .filter((a) => a.kind !== "credit")
    .reduce((s, a) => s + a.balance, 0);
  const totalDebts = Math.abs(
    MOCK_ACCOUNTS.filter((a) => a.kind === "credit").reduce((s, a) => s + a.balance, 0)
  );
  const netCash = totalAssets - totalDebts;

  const iconForKind: Record<string, IconName> = {
    checking: "wallet",
    savings: "piggy-bank",
    credit: "credit-card",
    investment: "trending-up",
  };

  return (
    <View style={{ gap: 8 }}>
      {MOCK_ACCOUNTS.map((a) => (
        <View key={a.id} style={styles.accountRow}>
          <View style={styles.accountLeft}>
            <View style={styles.accountIconBox}>
              <Icon name={iconForKind[a.kind]} size={13} color={Colors.navyMuted} strokeWidth={2.2} />
            </View>
            <View>
              <Text style={styles.accountName}>{a.name}</Text>
              {a.institution && <Text style={styles.accountInst}>{a.institution}</Text>}
            </View>
          </View>
          <Text
            style={[
              styles.accountAmount,
              a.balance < 0 ? { color: Colors.coral } : null,
            ]}
          >
            {a.balance < 0
              ? `−${formatCurrency(Math.abs(a.balance))}`
              : formatCurrency(a.balance)}
          </Text>
        </View>
      ))}
      <View style={styles.netCashRow}>
        <View style={styles.accountLeft}>
          <View style={[styles.accountIconBox, { backgroundColor: Colors.gold50, borderColor: Colors.gold }]}>
            <Icon name="badge-check" size={13} color={Colors.gold} strokeWidth={2.4} />
          </View>
          <Text style={styles.netCashLabel}>Net cash</Text>
        </View>
        <Text style={styles.netCashAmount}>{formatCurrency(netCash)}</Text>
      </View>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  scroll: { paddingHorizontal: 18, gap: 12 },

  header: { marginBottom: 14 },
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

  statGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 12,
  },
  statTile: {
    flexBasis: "48%",
    flexGrow: 1,
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 4,
  },
  statIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 19,
    fontWeight: "800",
    color: Colors.navy,
    letterSpacing: -0.4,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.navyMuted,
    letterSpacing: 0.4,
  },
  statSub: { fontSize: 10, color: Colors.muted, marginTop: 1 },

  card: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: Colors.navy,
    letterSpacing: -0.2,
  },
  cardHint: { fontSize: 11, color: Colors.muted, marginTop: 2 },

  // Segmented bar
  segmentedBar: {
    flexDirection: "row",
    height: 14,
    borderRadius: 7,
    overflow: "hidden",
    backgroundColor: Colors.border,
    marginBottom: 14,
  },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendSwatch: { width: 8, height: 8, borderRadius: 2 },
  legendText: { fontSize: 11, color: Colors.navyMuted, fontWeight: "600" },

  // Category row
  catRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  catLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  catIcon: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  catName: { fontSize: 13, fontWeight: "700", color: Colors.navy },
  catNumbers: { fontSize: 13, fontWeight: "700", color: Colors.navy },
  catBudget: { color: Colors.muted, fontWeight: "600" },
  catTrack: {
    height: 5,
    borderRadius: 3,
    backgroundColor: Colors.border,
    overflow: "hidden",
  },
  catFill: { height: 5, borderRadius: 3 },

  // Tabs
  txnTabs: {
    flexDirection: "row",
    backgroundColor: Colors.surface,
    borderRadius: 999,
    padding: 4,
    marginBottom: 10,
    alignSelf: "flex-start",
  },
  tabPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
  },
  tabPillActive: { backgroundColor: Colors.navy },
  tabPillText: { fontSize: 12, fontWeight: "700", color: Colors.navyMuted },
  tabPillTextActive: { color: "#FFFFFF" },

  txnList: { gap: 0 },
  txnRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
  },
  txnLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  txnIconBox: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: Colors.navy50,
    alignItems: "center",
    justifyContent: "center",
  },
  txnMerchant: { fontSize: 13, fontWeight: "700", color: Colors.navy },
  txnSub: { fontSize: 11, color: Colors.muted, marginTop: 1 },
  txnAmount: { fontSize: 14, fontWeight: "700" },
  txnDivider: { height: 1, backgroundColor: Colors.border },

  // Holdings
  totalValue: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.navy,
    letterSpacing: -0.3,
  },
  holdingRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  tickerBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: Colors.navy,
  },
  tickerText: {
    fontSize: 11,
    fontWeight: "800",
    color: Colors.gold,
    letterSpacing: 0.6,
  },
  holdingName: { fontSize: 13, fontWeight: "700", color: Colors.navy },
  holdingShares: { fontSize: 11, color: Colors.muted, marginTop: 1 },
  holdingValue: { fontSize: 14, fontWeight: "800", color: Colors.navy },
  holdingChange: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 2 },
  holdingChangeText: { fontSize: 11, fontWeight: "700" },

  // Accounts
  accountRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  accountLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  accountIconBox: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: Colors.navy50,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  accountName: { fontSize: 13, fontWeight: "700", color: Colors.navy },
  accountInst: { fontSize: 11, color: Colors.muted, marginTop: 1 },
  accountAmount: { fontSize: 14, fontWeight: "700", color: Colors.navy },

  netCashRow: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.gold50,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(244,168,50,0.3)",
  },
  netCashLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: Colors.navy,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  netCashAmount: {
    fontSize: 18,
    fontWeight: "800",
    color: Colors.navy,
    letterSpacing: -0.3,
  },
});

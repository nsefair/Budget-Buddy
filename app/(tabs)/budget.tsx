/**
 * Budget Tab — Money Truth + Investments + Accounts
 *
 *   • Net worth and linked accounts
 *   • Spending by month (bars that select the month) + this month's plan
 *   • Categories against their limits (limits are fixed for now)
 *   • Stat tiles, spending breakdown donut, and the money calendar
 *   • Recent | Upcoming transactions (segmented)
 *   • Investment Portfolio (zero until connected)
 *
 * Every visual is icon-system based; categories use tinted icon tiles.
 */

import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { moneyService } from "@/services/moneyService";
import { usePlaidConnection } from "@/hooks/usePlaidConnection";
import * as Haptics from "expo-haptics";
import Svg, { Polyline } from "react-native-svg";

import { CountUp, GrowBar, useFocusReplay } from "@/animations";
import { Colors } from "@/constants/colors";
import { TAB_BAR_HEIGHT } from "@/constants/tokens";
import { BrandHeader } from "@/components/BrandLogo";
import { GradientHeader } from "@/components/ui";
import { Icon, hasIcon, type IconName } from "@/components/Icon";
import type {
  AccountSummary,
  BudgetOverview,
  BudgetCategory,
  BudgetMonthOption,
  Transaction,
  UpcomingBill,
} from "@/mock/budget";
import { IS_MOCK } from "@/api/client";
import {
  budgetService,
  linkedAccountNetWorth,
  type BudgetSuggestionSet,
} from "@/services/budgetService";
import { plaidService } from "@/services/plaidService";
import { goalsService } from "@/services/goalsService";
import type { GoalsSummary } from "@/mock/goals";
import { formatCurrency, secureLog } from "@/utils/security";
import {
  MonthSpendBars,
  SpendingDonutChart,
  TransactionCalendar,
} from "@/features/budget/BudgetVisuals";

const AMBER_WASH = "rgba(245, 158, 11, 0.35)";
const CORAL_WASH = "rgba(239, 68, 68, 0.3)";

// Some category colors (e.g. Housing's navy) disappear on dark surfaces.
function readableTint(hex: string) {
  const value = parseInt(hex.replace("#", "").slice(0, 6), 16);
  if (Number.isNaN(value)) return Colors.navyMuted;
  const [r, g, b] = [(value >> 16) & 255, (value >> 8) & 255, value & 255];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 70 ? Colors.navyMuted : hex;
}

/**
 * Predict upcoming bills from synced recurring transactions: the latest
 * charge per merchant, projected one month forward. Keeps the Upcoming tab
 * on real Plaid data instead of mock fixtures.
 */
function upcomingBillsFrom(transactions: Transaction[]): UpcomingBill[] {
  const latestByMerchant = new Map<string, Transaction>();
  for (const txn of transactions) {
    if (!txn.isRecurring || txn.amount <= 0) continue;
    const existing = latestByMerchant.get(txn.merchant);
    if (!existing || new Date(txn.date) > new Date(existing.date)) {
      latestByMerchant.set(txn.merchant, txn);
    }
  }

  const now = Date.now();
  return [...latestByMerchant.values()]
    .map((txn) => {
      const dueAt = new Date(txn.date);
      dueAt.setMonth(dueAt.getMonth() + 1);
      return {
        id: `upcoming_${txn.id}`,
        merchant: txn.merchant,
        amount: txn.amount,
        dueAt: dueAt.toISOString(),
        category: txn.category,
        isCovered: false,
      };
    })
    .filter((bill) => new Date(bill.dueAt).getTime() >= now - 24 * 3600 * 1000)
    .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime())
    .slice(0, 6);
}

export default function BudgetScreen() {
  const insets = useSafeAreaInsets();
  // Numbers and bars re-enter each time Budget regains focus.
  const replay = useFocusReplay();
  const client = useQueryClient();
  const [txnTab, setTxnTab] = useState<"recent" | "upcoming">("recent");
  const [months, setMonths] = useState<BudgetMonthOption[]>([]);
  const [selectedMonthId, setSelectedMonthId] = useState(() => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`; });
  const [overview, setOverview] = useState<BudgetOverview | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<AccountSummary[]>([]);
  const [goalsSummary, setGoalsSummary] = useState<GoalsSummary | null>(null);
  const [suggestions, setSuggestions] = useState<BudgetSuggestionSet | null>(null);
  const [syncing, setSyncing] = useState(false);

  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const [bankMessage, setBankMessage] = useState("");
  const [recalculating, setRecalculating] = useState(false);
  const actionBusy = useRef(false);
  const loadGeneration = useRef(0);
  const loadBudget = useCallback(async () => {
    const generation = ++loadGeneration.current;
    setLoading(true); setLoadError("");
    try {
      const [nextMonths, nextAccounts, nextOverview, nextTransactions, nextSuggestions, nextGoals] = await Promise.all([
        budgetService.getAvailableMonths(), budgetService.getAccounts(),
        budgetService.getOverview(selectedMonthId), budgetService.getAllTransactions(selectedMonthId),
        budgetService.getSuggestions().catch(() => null), goalsService.list().catch(() => null),
      ]);
      if (generation !== loadGeneration.current) return;
      setMonths(nextMonths); setAccounts(nextAccounts); setOverview(nextOverview); setTransactions(nextTransactions);
      setSuggestions(nextSuggestions); setGoalsSummary(nextGoals?.summary ?? null);
    } catch (error) {
      if (generation === loadGeneration.current) setLoadError("Couldn’t refresh your budget. Please try again.");
      secureLog.warn("budget.load failed", error);
    } finally { if (generation === loadGeneration.current) setLoading(false); }
  }, [selectedMonthId]);

  const connection = usePlaidConnection({ source: "budget", autoLoadStatus: false, onConnected: () => { void loadBudget(); void client.invalidateQueries({ queryKey: ["money"] }); } });
  const { refreshStatus } = connection;
  useFocusEffect(useCallback(() => {
    void loadBudget();
    if (!IS_MOCK) void refreshStatus();
    return () => { loadGeneration.current++; };
  }, [loadBudget, refreshStatus]));

  const syncBank = async () => {
    if (actionBusy.current) return;
    actionBusy.current = true; setSyncing(true); setBankMessage("");
    try {
      const result = await plaidService.sync();
      setBankMessage(result.relinkRequired ? "Reconnect your bank to resume updates." : result.synced ? "Bank synced. Recalculate your daily number below." : result.message ?? "No bank transactions synced yet.");
      await Promise.all([loadBudget(), connection.refreshStatus(), client.invalidateQueries({ queryKey: ["money"] })]);
    } catch { setBankMessage("Bank sync failed. Your last loaded data is shown."); }
    finally { actionBusy.current = false; setSyncing(false); }
  };
  const recalculate = async () => {
    if (actionBusy.current) return;
    actionBusy.current = true; setRecalculating(true); setBankMessage("");
    try {
      await moneyService.today();
      await client.invalidateQueries({ queryKey: ["money"] });
      setBankMessage("Safe to spend recalculated from your synced data. Your morning allowance stays fixed.");
      router.push("/(tabs)/today");
    } catch { setBankMessage("Couldn’t recalculate. Complete your income plan on Today, then try again."); }
    finally { actionBusy.current = false; setRecalculating(false); }
  };

  const selectedMonthIndex = months.findIndex((month) => month.id === selectedMonthId);
  const selectedMonth = selectedMonthIndex >= 0 ? months[selectedMonthIndex] : null;
  const previousMonth = selectedMonthIndex > 0 ? months[selectedMonthIndex - 1] : null;

  if (!overview) {
    return (
      <View style={styles.container}>
        <View style={[styles.loadingState, { paddingTop: insets.top + 24 }]}>
          <BrandHeader style={styles.brandHeader} />
          <Text accessibilityRole={loadError ? "alert" : undefined} style={styles.loadingText}>{loadError || "Loading budget..."}</Text>
          {!!loadError && <Pressable accessibilityRole="button" onPress={() => void loadBudget()} style={styles.viewAllButton}><Text style={styles.viewAllText}>Try again</Text></Pressable>}
        </View>
      </View>
    );
  }

  const savingsRate = Math.round(overview.savingsRate);
  const recent = transactions.slice(0, 4);
  // Bills carry a category name, transactions an id; match either for the icon tile.
  const categoryFor = (key: string) =>
    overview.categories.find((category) => category.id === key || category.name === key);
  const upcomingBills = upcomingBillsFrom(transactions);

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 24 },
        ]}
        refreshControl={<RefreshControl refreshing={loading && !syncing} onRefresh={() => void loadBudget()} />}
        showsVerticalScrollIndicator={false}
      >
        <GradientHeader
          eyebrow="MONEY TRUTH"
          title="Budget"
          right={
            <View style={styles.syncBadge}>
              <Icon
                name={syncing ? "activity" : accounts.length ? "check-circle" : "building"}
                size={13}
                color={Colors.teal}
                strokeWidth={2.4}
              />
              <Text style={styles.syncBadgeText}>
                {syncing ? "Syncing" : connection.status?.connections.some(item => item.status !== "active") ? "Needs attention" : accounts.length ? "Linked" : "No bank yet"}
              </Text>
            </View>
          }
        />

        <View style={styles.body}>
        {!!loadError && <Text accessibilityRole="alert" style={styles.emptyTransactions}>{loadError} Showing the last loaded budget.</Text>}
        {!IS_MOCK && <Card>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
            <Pressable accessibilityRole="button" disabled={syncing || recalculating || connection.linking} onPress={() => {
              if (!connection.hasConnections || connection.status?.connections.some(item => item.status !== "active")) void connection.startLink();
              else void syncBank();
            }} style={styles.viewAllButton}><Text style={styles.viewAllText}>{syncing ? "Syncing…" : connection.linking ? "Connecting…" : !connection.hasConnections ? "Connect bank" : connection.status?.connections.some(item => item.status !== "active") ? "Reconnect bank" : "Sync bank"}</Text></Pressable>
            <Pressable accessibilityRole="button" disabled={syncing || recalculating || connection.linking} onPress={() => void recalculate()} style={styles.viewAllButton}><Text style={styles.viewAllText}>{recalculating ? "Recalculating…" : "Recalculate safe to spend"}</Text></Pressable>
          </View>
          {!!bankMessage && <Text accessibilityRole="alert" style={styles.emptyTransactions}>{bankMessage}</Text>}
        </Card>}
        {/* Net worth + accounts — the Rocket Money-style money truth, top of tab */}
        <NetWorthHero accounts={accounts} transactions={transactions} replayKey={replay} />

        <Card>
          <CardHeader title="Accounts" />
          <AccountsBlock accounts={accounts} />
        </Card>

        <Card>
          <CardHeader title="Spending by month" hint={selectedMonth?.label ?? "This month"} />
          <MonthSpendBars
            months={months}
            selectedMonthId={selectedMonthId}
            onSelect={(monthId) => {
              Haptics.selectionAsync();
              setSelectedMonthId(monthId);
            }}
            replayKey={replay}
          />
          {selectedMonth && <MonthInsight current={selectedMonth} previous={previousMonth} />}
        </Card>

        {/* This month against the plan. Category limits are fixed for now. */}
        <MonthPlanCard
          overview={overview}
          suggestions={suggestions}
          goalsSummary={goalsSummary}
          replayKey={replay}
        />

        <Card>
          <CardHeader title="Categories" hint="Tap one to see its transactions" />
          <View style={styles.catList}>
            {[...overview.categories]
              .sort((a, b) => b.spent - a.spent)
              .map((c, index) => (
                <CategoryRow key={c.id} category={c} month={selectedMonthId} index={index} replayKey={replay} />
              ))}
          </View>
        </Card>

        {/* 4 stat tiles */}
        <View style={styles.statGrid}>
          <StatTile
            label="Received income"
            sub="posted bank deposits"
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
            sub="per day this month"
            icon="line-chart"
            tint={Colors.greenDark}
          />
        </View>

        {/* Spending breakdown — category donut */}
        <Card>
          <CardHeader title="Spending breakdown" hint={overview.month} />
          <SpendingDonutChart
            categories={overview.categories}
            totalSpent={overview.totalSpent}
            replayKey={replay}
          />
        </Card>

        <Card>
          <CardHeader
            title="Money calendar"
            hint="Spot paydays, subscriptions, and spending patterns"
          />
          <TransactionCalendar
            monthId={selectedMonthId}
            monthLabel={overview.month}
            transactions={transactions}
          />
        </Card>

        {/* Transactions — Recent | Upcoming */}
        <Card>
          <CardHeader
            title="Transactions"
            right={
              txnTab === "recent" ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="View all transactions"
                  onPress={() => {
                    Haptics.selectionAsync();
                    router.push({ pathname: "/transactions", params: { month: selectedMonthId } });
                  }}
                  style={({ pressed }) => [
                    styles.viewAllButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.viewAllText}>View all</Text>
                  <Icon name="chevron-right" size={14} color={Colors.gold} strokeWidth={2.5} />
                </Pressable>
              ) : null
            }
          />
          <View style={styles.txnTabs}>
            <TabPill label="Recent" active={txnTab === "recent"} onPress={() => setTxnTab("recent")} />
            <TabPill label="Upcoming" active={txnTab === "upcoming"} onPress={() => setTxnTab("upcoming")} />
          </View>

          {txnTab === "recent" ? (
            <View style={styles.txnList}>
              {recent.length === 0 && (
                <Text style={styles.emptyTransactions}>No transactions for this month yet.</Text>
              )}
              {recent.map((t, i) => (
                <React.Fragment key={t.id}>
                  <TransactionRow
                    merchant={t.merchant}
                    sub={`${t.category}${t.isPending ? " · Pending" : ""}${t.isRecurring ? " · Recurring" : ""}`}
                    amount={-t.amount}
                    category={categoryFor(t.categoryId)}
                  />
                  {i < recent.length - 1 && <View style={styles.txnDivider} />}
                </React.Fragment>
              ))}
            </View>
          ) : (
            <View style={styles.txnList}>
              {upcomingBills.length === 0 && (
                <Text style={styles.emptyTransactions}>
                  No recurring charges detected yet. Bud predicts bills from your
                  synced transactions.
                </Text>
              )}
              {upcomingBills.map((b, i) => {
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
                      category={categoryFor(b.category)}
                    />
                    {i < upcomingBills.length - 1 && <View style={styles.txnDivider} />}
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
                {formatCurrency(0, { compact: true })}
              </Text>
            }
          />
          <View style={styles.emptyInvestment}>
            <View style={styles.emptyInvestmentIcon}>
              <Icon name="trending-up" size={16} color={Colors.navyMuted} strokeWidth={2.3} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.emptyInvestmentTitle}>Investment position</Text>
              <Text style={styles.emptyInvestmentSub}>No connected investment holdings.</Text>
            </View>
            <Text style={styles.emptyInvestmentAmount}>{formatCurrency(0)}</Text>
          </View>
        </Card>
        </View>

      </ScrollView>
    </View>
  );
}

// ─── Net worth hero ──────────────────────────────────────────────────────────

const SPARK_WIDTH = 96;
const SPARK_HEIGHT = 34;

function NetWorthHero({
  accounts,
  transactions,
  replayKey,
}: {
  accounts: AccountSummary[];
  transactions: Transaction[];
  replayKey: number;
}) {
  const netWorth = linkedAccountNetWorth(accounts);

  // Cumulative net cash flow over the month drives the mini trend line.
  const sparkPoints = useMemo(() => {
    const ordered = [...transactions].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    const values: number[] = [0];
    let running = 0;
    for (const txn of ordered) {
      running += -txn.amount; // spending is positive in the data; flip to flow
      values.push(running);
    }
    if (values.length < 2) return null;

    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;
    return values
      .map((value, index) => {
        const x = (index / (values.length - 1)) * SPARK_WIDTH;
        const y = SPARK_HEIGHT - 3 - ((value - min) / span) * (SPARK_HEIGHT - 6);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  }, [transactions]);

  const monthFlow = useMemo(
    () => transactions.reduce((sum, txn) => sum + -txn.amount, 0),
    [transactions]
  );

  return (
    <View style={styles.netWorthHero} accessibilityLabel={`Net worth ${formatCurrency(netWorth)}`}>
      <Text style={styles.netWorthEyebrow}>NET WORTH</Text>
      <View style={styles.netWorthRow}>
        <CountUp
          value={netWorth}
          from={netWorth * 0.9}
          replayKey={replayKey}
          format={formatCurrency}
          fit
          style={styles.netWorthValue}
          centsStyle={styles.netWorthCents}
        />
        {sparkPoints ? (
          <Svg width={SPARK_WIDTH} height={SPARK_HEIGHT}>
            <Polyline
              points={sparkPoints}
              fill="none"
              stroke={Colors.gold}
              strokeWidth={2.4}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        ) : null}
      </View>
      <Text style={styles.netWorthSub}>
        {accounts.length > 0
          ? `${monthFlow >= 0 ? "+" : "−"}${formatCurrency(Math.abs(monthFlow), { compact: true })} this month · ${accounts.length} linked ${accounts.length === 1 ? "account" : "accounts"}`
          : "Connect a bank in Profile to track your balances here."}
      </Text>
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

function MonthInsight({
  current,
  previous,
}: {
  current: BudgetMonthOption;
  previous: BudgetMonthOption | null;
}) {
  const spentRatio = current.totalSpent / current.totalBudget;

  if (!previous) {
    return (
      <View style={styles.monthInsight}>
        <Icon name="sparkles" size={15} color={Colors.teal} strokeWidth={2.4} />
        <Text style={styles.monthInsightText}>
          First month in this view. Future months will compare against it.
        </Text>
      </View>
    );
  }

  const difference = current.totalSpent - previous.totalSpent;
  const isLower = difference < 0;
  const same = Math.abs(difference) < 1;

  return (
    <View style={styles.monthInsight}>
      <Icon
        name={same ? "sparkles" : isLower ? "trending-down" : "trending-up"}
        size={15}
        color={same ? Colors.teal : isLower ? Colors.teal : Colors.gold}
        strokeWidth={2.4}
      />
      <Text style={styles.monthInsightText}>
        {same
          ? `Spending is about the same as ${previous.shortLabel}.`
          : `${formatCurrency(Math.abs(difference), { compact: true })} ${
              isLower ? "less" : "more"
            } than ${previous.shortLabel}.`}
        <Text style={styles.monthInsightMuted}>
          {` ${Math.round(spentRatio * 100)}% of budget used.`}
        </Text>
      </Text>
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
      <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
        {value}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
      {sub && <Text style={styles.statSub}>{sub}</Text>}
    </View>
  );
}

function MonthPlanCard({
  overview,
  suggestions,
  goalsSummary,
  replayKey,
}: {
  overview: BudgetOverview;
  suggestions: BudgetSuggestionSet | null;
  goalsSummary: GoalsSummary | null;
  replayKey: number;
}) {
  const used = overview.totalBudget > 0 ? overview.totalSpent / overview.totalBudget : 0;
  const status = used > 1 ? "over" : used > 0.85 ? "close" : "good";
  const meterFill = { good: Colors.accentAlpha35, close: AMBER_WASH, over: CORAL_WASH }[status];
  const statusLabel = {
    good: "On plan this month",
    close: "Close to your plan",
    over: "Over plan this month",
  }[status];

  return (
    <View style={styles.planCard}>
      <Text style={styles.planEyebrow}>{overview.month.toUpperCase()}</Text>
      <CountUp
        value={overview.totalSpent}
        from={overview.totalSpent * 0.9}
        replayKey={replayKey}
        format={formatCurrency}
        fit
        style={styles.planAmount}
        centsStyle={styles.planCents}
      />
      <Text style={styles.planOf}>
        {overview.totalBudget > 0
          ? `spent of ${formatCurrency(overview.totalBudget)} planned`
          : "spent this month"}
      </Text>

      {overview.totalBudget > 0 ? (
        <View
          style={styles.planMeter}
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel={`${statusLabel}. ${Math.round(used * 100)} percent of the plan used.`}
        >
          <GrowBar
            progress={Math.min(1, used)}
            color={meterFill}
            trackColor={Colors.navy50}
            height={44}
            replayKey={replayKey}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.planMeterLabels} pointerEvents="none">
            <Text style={styles.planMeterStatus}>{statusLabel}</Text>
            <Text style={styles.planMeterPercent}>{Math.round(used * 100)}% used</Text>
          </View>
        </View>
      ) : null}

      {suggestions?.ready ? (
        <>
          <Text style={styles.planGuide}>Bud's 50/30/20 guide · from your last 90 days</Text>
          <View style={styles.planSplit}>
            <PlanCell label="Needs" share="50%" value={suggestions.needsTarget} />
            <PlanCell label="Wants" share="30%" value={suggestions.wantsTarget} />
            <PlanCell label="Save" share="20%" value={suggestions.savingsTarget} />
          </View>
        </>
      ) : null}

      {goalsSummary?.activeCount ? (
        <View style={styles.planGoals}>
          <Icon name="target" size={14} color={Colors.navyMuted} strokeWidth={2.3} />
          <Text style={styles.planGoalsText}>
            {formatCurrency(goalsSummary.monthlyCommittedTotal)} a month committed across{" "}
            {goalsSummary.activeCount} {goalsSummary.activeCount === 1 ? "goal" : "goals"}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function PlanCell({ label, share, value }: { label: string; share: string; value: number }) {
  return (
    <View style={styles.planCell}>
      <Text style={styles.planCellLabel}>
        {label} <Text style={styles.planCellShare}>{share}</Text>
      </Text>
      <Text style={styles.planCellValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
        {formatCurrency(value, { compact: true })}
      </Text>
    </View>
  );
}

function CategoryRow({
  category,
  month,
  index,
  replayKey,
}: {
  category: BudgetCategory;
  month: string;
  index: number;
  replayKey: number;
}) {
  const limit = category.budgetLimit;
  const pct = limit > 0 ? category.spent / limit : 0;
  const over = limit > 0 && category.spent > limit;
  const tint = readableTint(category.color);
  const fillColor = over ? Colors.coral : pct > 0.85 ? Colors.amber : tint;
  const status = limit <= 0
    ? "No limit set"
    : over
      ? `${formatCurrency(category.spent - limit)} over`
      : `${formatCurrency(limit - category.spent)} left`;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${category.name}: ${formatCurrency(category.spent)} spent${limit > 0 ? ` of ${formatCurrency(limit)}` : ""}. ${status}. View transactions.`}
      onPress={() => router.push({ pathname: "/transactions", params: { month, category: category.id } })}
      style={({ pressed }) => [styles.catRow, pressed && styles.pressed]}
    >
      <View style={[styles.catIcon, { backgroundColor: `${category.color}1F` }]}>
        <Icon
          name={hasIcon(category.icon) ? category.icon : "receipt"}
          size={16}
          color={tint}
          strokeWidth={2.3}
        />
      </View>
      <View style={styles.catBody}>
        <View style={styles.catTop}>
          <Text style={styles.catName} numberOfLines={1}>{category.name}</Text>
          <Text style={styles.catSpent}>
            {formatCurrency(category.spent)}
            {limit > 0 ? (
              <Text style={styles.catLimit}>{` / ${formatCurrency(limit)}`}</Text>
            ) : null}
          </Text>
        </View>
        <GrowBar
          progress={pct}
          color={fillColor}
          trackColor={Colors.navy50}
          height={5}
          delay={index * 45}
          replayKey={replayKey}
        />
        <Text style={[styles.catStatus, over && styles.catStatusOver]}>{status}</Text>
      </View>
    </Pressable>
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
  category,
}: {
  merchant: string;
  sub: string;
  amount: number;
  category?: BudgetCategory;
}) {
  return (
    <View style={styles.txnRow}>
      <View style={styles.txnLeft}>
        <View style={[styles.txnIconBox, category && { backgroundColor: `${category.color}1F` }]}>
          {category ? (
            <Icon
              name={hasIcon(category.icon) ? category.icon : "receipt"}
              size={15}
              color={readableTint(category.color)}
              strokeWidth={2.3}
            />
          ) : (
            <Icon
              name={amount < 0 ? "arrow-down-right" : "arrow-up-right"}
              size={13}
              color={amount < 0 ? Colors.muted : Colors.emerald}
            />
          )}
        </View>
        <View style={styles.rowCopy}>
          <Text style={styles.txnMerchant} numberOfLines={1}>{merchant}</Text>
          <Text style={styles.txnSub} numberOfLines={1}>{sub}</Text>
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

function AccountsBlock({ accounts }: { accounts: AccountSummary[] }) {
  const netCash = linkedAccountNetWorth(accounts);

  const iconForKind: Record<string, IconName> = {
    checking: "wallet",
    savings: "piggy-bank",
    credit: "credit-card",
    investment: "trending-up",
  };

  if (accounts.length === 0) {
    return (
      <Text style={styles.emptyTransactions}>
        Connect a bank in Profile to see your linked accounts here.
      </Text>
    );
  }

  return (
    <View style={{ gap: 8 }}>
      {accounts.map((a) => (
        <View key={a.id} style={styles.accountRow}>
          <View style={styles.accountLeft}>
            <View style={styles.accountIconBox}>
              <Icon name={iconForKind[a.kind]} size={13} color={Colors.navyMuted} strokeWidth={2.2} />
            </View>
            <View style={styles.rowCopy}>
              <Text style={styles.accountName} numberOfLines={1}>{a.name}</Text>
              {a.institution && <Text style={styles.accountInst} numberOfLines={1}>{a.institution}</Text>}
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
          <View style={[styles.accountIconBox, { backgroundColor: Colors.greenSurfaceStrong, borderColor: Colors.gold }]}>
            <Icon name="badge-check" size={13} color={Colors.gold} strokeWidth={2.4} />
          </View>
          <Text style={styles.netCashLabel}>Net cash</Text>
        </View>
        <Text style={styles.netCashAmount} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
          {formatCurrency(netCash)}
        </Text>
      </View>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  scroll: {},
  body: { paddingHorizontal: 18, paddingTop: 12, gap: 12 },
  loadingState: {
    flex: 1,
    paddingHorizontal: 18,
  },
  loadingText: {
    marginTop: 18,
    textAlign: "center",
    fontSize: 13,
    fontWeight: "700",
    color: Colors.navyMuted,
  },

  brandHeader: { marginBottom: 18 },
  netWorthHero: {
    borderRadius: 22,
    padding: 18,
    marginBottom: 12,
    backgroundColor: Colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  netWorthEyebrow: {
    fontSize: 10,
    fontWeight: "800",
    color: Colors.muted,
    letterSpacing: 1.6,
    marginBottom: 6,
  },
  netWorthRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  netWorthValue: {
    flex: 1,
    fontSize: 36,
    fontWeight: "800",
    color: Colors.navy,
    letterSpacing: -1,
  },
  // Reference: cents sit quieter than dollars.
  netWorthCents: { color: Colors.muted, fontWeight: "700" },
  netWorthSub: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: "600",
    color: Colors.muted,
  },
  header: {
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
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
    letterSpacing: 0,
  },
  syncBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: Colors.emerald50,
    borderWidth: 1,
    borderColor: Colors.emerald100,
  },
  syncBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: Colors.navy,
  },

  monthInsight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  monthInsightText: {
    flex: 1,
    fontSize: 12,
    fontWeight: "700",
    color: Colors.navy,
    lineHeight: 17,
  },
  monthInsightMuted: {
    color: Colors.navyMuted,
    fontWeight: "600",
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
    letterSpacing: 0,
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
    letterSpacing: 0,
  },
  cardHint: { fontSize: 11, color: Colors.muted, marginTop: 2 },
  viewAllButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: Colors.accentAlpha08,
  },
  viewAllText: { fontSize: 11, fontWeight: "800", color: Colors.gold },

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

  pressed: { opacity: 0.75 },

  // This month's plan
  planCard: {
    marginBottom: 12,
    padding: 18,
    gap: 6,
    borderRadius: 22,
    backgroundColor: Colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  planEyebrow: { fontSize: 10, fontWeight: "800", letterSpacing: 1.6, color: Colors.muted },
  planAmount: { fontSize: 34, fontWeight: "800", letterSpacing: -1, color: Colors.navy },
  planCents: { color: Colors.muted, fontWeight: "700" },
  planOf: { fontSize: 13, fontWeight: "600", color: Colors.muted, marginTop: -2 },
  planMeter: { height: 44, marginTop: 12, justifyContent: "center" },
  planMeterLabels: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  planMeterStatus: { fontSize: 13, fontWeight: "700", color: Colors.navy },
  planMeterPercent: { fontSize: 13, fontWeight: "700", color: Colors.navy, fontVariant: ["tabular-nums"] },
  planGuide: { marginTop: 14, fontSize: 11, fontWeight: "700", color: Colors.muted, letterSpacing: 0.3 },
  planSplit: { flexDirection: "row", gap: 8, marginTop: 4 },
  planCell: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: Colors.navy50,
    gap: 2,
  },
  planCellLabel: { fontSize: 11, fontWeight: "700", color: Colors.navyMuted },
  planCellShare: { color: Colors.muted, fontWeight: "600" },
  planCellValue: { fontSize: 16, fontWeight: "800", color: Colors.navy, fontVariant: ["tabular-nums"] },
  planGoals: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12 },
  planGoalsText: { flex: 1, fontSize: 12, lineHeight: 17, fontWeight: "600", color: Colors.navyMuted },

  // Categories
  catList: { gap: 4 },
  catRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8 },
  catIcon: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  catBody: { flex: 1, minWidth: 0, gap: 6 },
  catTop: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 10 },
  catName: { flex: 1, minWidth: 0, fontSize: 14, fontWeight: "700", color: Colors.navy },
  catSpent: { flexShrink: 0, fontSize: 14, fontWeight: "800", color: Colors.navy, fontVariant: ["tabular-nums"] },
  catLimit: { color: Colors.muted, fontWeight: "600" },
  catStatus: { fontSize: 11, fontWeight: "600", color: Colors.muted },
  catStatusOver: { color: Colors.coral },

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
  tabPillActive: { backgroundColor: Colors.gold },
  tabPillText: { fontSize: 12, fontWeight: "700", color: Colors.navyMuted },
  tabPillTextActive: { color: Colors.onGreen },

  txnList: { gap: 0 },
  emptyTransactions: {
    paddingVertical: 14,
    fontSize: 13,
    fontWeight: "600",
    color: Colors.muted,
    textAlign: "center",
  },
  txnRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
  },
  txnLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1, minWidth: 0, marginRight: 12 },
  rowCopy: { flex: 1, minWidth: 0 },
  txnIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.navy50,
    alignItems: "center",
    justifyContent: "center",
  },
  txnMerchant: { fontSize: 13, fontWeight: "700", color: Colors.navy },
  txnSub: { fontSize: 11, color: Colors.muted, marginTop: 1 },
  txnAmount: { flexShrink: 0, fontSize: 14, fontWeight: "700" },
  txnDivider: { height: 1, backgroundColor: Colors.border },

  // Investments
  totalValue: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.navy,
    letterSpacing: 0,
  },
  emptyInvestment: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 4,
  },
  emptyInvestmentIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: Colors.navy50,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyInvestmentTitle: { fontSize: 13, fontWeight: "800", color: Colors.navy },
  emptyInvestmentSub: { fontSize: 11, color: Colors.muted, marginTop: 1 },
  emptyInvestmentAmount: { fontSize: 14, fontWeight: "800", color: Colors.navy },

  // Accounts
  accountRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  accountLeft: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 12, marginRight: 12 },
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
  accountAmount: { flexShrink: 0, fontSize: 14, fontWeight: "700", color: Colors.navy },

  netCashRow: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.greenSurface,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.greenBorder,
  },
  netCashLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: Colors.navy,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  netCashAmount: {
    maxWidth: "65%",
    marginLeft: 12,
    fontSize: 18,
    fontWeight: "800",
    color: Colors.navy,
    letterSpacing: 0,
  },
});

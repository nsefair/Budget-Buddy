/**
 * Budget Tab — Money Truth + Investments + Accounts
 *
 * Matches the CEO's drawing:
 *   • Top 4 stat cards (Income, Spent, Saving Rate, Avg Daily Spend)
 *   • Spending Breakdown (interactive visual category donut)
 *   • Monthly transaction calendar for recurring bills and income
 *   • Trends placeholder + Budget Detail (category fill bars)
 *   • Recent | Upcoming transactions (segmented)
 *   • Investment Portfolio (zero until connected)
 *   • Accounts list (checking / credit / savings / investments + Net Cash)
 *
 * Emojis are reserved for spending categories and transaction context.
 * Everything else stays Lucide/icon-system based.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { MotiView } from "moti";
import * as Haptics from "expo-haptics";

import { Colors } from "@/constants/colors";
import { BrandHeader } from "@/components/BrandLogo";
import { ScreenHeader } from "@/components/ui";
import { Icon, type IconName } from "@/components/Icon";
import {
  MOCK_UPCOMING_BILLS,
  type AccountSummary,
  type BudgetOverview,
  type BudgetCategory,
  type BudgetMonthOption,
  type Transaction,
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
  SpendingDonutChart,
  TransactionCalendar,
} from "@/features/budget/BudgetVisuals";

const TAB_BAR_HEIGHT = 80;

const CATEGORY_EMOJI: Record<string, string> = {
  food: "🍔",
  transport: "🚗",
  shopping: "🛍️",
  housing: "🏠",
  entertainment: "🎬",
  health: "💊",
  personal: "✂️",
  education: "📚",
  debt: "💳",
};

function emojiForCategory(value: string) {
  const normalised = value.toLowerCase();
  if (CATEGORY_EMOJI[normalised]) return CATEGORY_EMOJI[normalised];
  if (normalised.includes("food")) return CATEGORY_EMOJI.food;
  if (normalised.includes("transport")) return CATEGORY_EMOJI.transport;
  if (normalised.includes("shop")) return CATEGORY_EMOJI.shopping;
  if (normalised.includes("housing")) return CATEGORY_EMOJI.housing;
  if (normalised.includes("entertainment")) return CATEGORY_EMOJI.entertainment;
  if (normalised.includes("health")) return CATEGORY_EMOJI.health;
  if (normalised.includes("debt") || normalised.includes("credit")) return CATEGORY_EMOJI.debt;
  return "💸";
}

function moneyInput(value: string) {
  const cleaned = value.replace(/[^0-9.]/g, "");
  const [whole, ...decimals] = cleaned.split(".");
  return decimals.length ? `${whole}.${decimals.join("").slice(0, 2)}` : whole;
}

function suggestionDraftsFrom(suggestions: BudgetSuggestionSet) {
  return Object.fromEntries(
    suggestions.categories.map((category) => [
      category.categoryId,
      String(Math.round(category.suggestedLimit * 100) / 100),
    ])
  );
}

export default function BudgetScreen() {
  const insets = useSafeAreaInsets();
  const [txnTab, setTxnTab] = useState<"recent" | "upcoming">("recent");
  const [months, setMonths] = useState<BudgetMonthOption[]>([]);
  const [selectedMonthId, setSelectedMonthId] = useState("");
  const [overview, setOverview] = useState<BudgetOverview | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<AccountSummary[]>([]);
  const [goalsSummary, setGoalsSummary] = useState<GoalsSummary | null>(null);
  const [suggestions, setSuggestions] = useState<BudgetSuggestionSet | null>(null);
  const [suggestionDrafts, setSuggestionDrafts] = useState<Record<string, string>>({});
  const [savingSuggestions, setSavingSuggestions] = useState(false);
  const [suggestionMessage, setSuggestionMessage] = useState("");
  const [editingLimits, setEditingLimits] = useState(false);
  const [limitDrafts, setLimitDrafts] = useState<Record<string, string>>({});
  const [savingLimits, setSavingLimits] = useState(false);
  const [limitMessage, setLimitMessage] = useState("");
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        if (!IS_MOCK) {
          setSyncing(true);
          try {
            await plaidService.sync();
          } catch (error) {
            secureLog.warn("budget.sync failed", error);
          }
        }

        const [availableMonths, nextAccounts, nextSuggestions] = await Promise.all([
          budgetService.getAvailableMonths(),
          budgetService.getAccounts().catch((error) => {
            secureLog.warn("budget.accounts failed", error);
            return [];
          }),
          budgetService.getSuggestions().catch((error) => {
            secureLog.warn(
              "budget.suggestions unavailable",
              error instanceof Error ? error.message : error
            );
            return null;
          }),
        ]);
        if (!alive) return;

        const currentMonth =
          availableMonths.find((month) => month.isCurrent) ??
          availableMonths[availableMonths.length - 1];
        setAccounts(nextAccounts);
        if (nextSuggestions) {
          setSuggestions(nextSuggestions);
          setSuggestionDrafts(suggestionDraftsFrom(nextSuggestions));
        }
        setMonths(availableMonths);
        setSelectedMonthId((existing) => existing || currentMonth?.id || "");
      } catch (error) {
        secureLog.error("budget.load failed", error);
      } finally {
        if (alive) setSyncing(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      goalsService
        .list()
        .then((result) => {
          if (alive) setGoalsSummary(result.summary);
        })
        .catch((error) => secureLog.warn("budget.goals-summary failed", error));

      return () => {
        alive = false;
      };
    }, [])
  );

  useEffect(() => {
    if (!selectedMonthId) return;
    let alive = true;

    (async () => {
      try {
        const [nextOverview, nextTransactions] = await Promise.all([
          budgetService.getOverview(selectedMonthId),
          budgetService.getTransactions({ month: selectedMonthId, limit: 200 }),
        ]);
        if (!alive) return;
        setOverview(nextOverview);
        setTransactions(nextTransactions);
      } catch (error) {
        secureLog.error("budget.overview failed", error);
      }
    })();

    return () => {
      alive = false;
    };
  }, [selectedMonthId]);

  const selectedMonthIndex = months.findIndex((month) => month.id === selectedMonthId);
  const selectedMonth = selectedMonthIndex >= 0 ? months[selectedMonthIndex] : null;
  const previousMonth = selectedMonthIndex > 0 ? months[selectedMonthIndex - 1] : null;

  const setMonthByStep = (step: -1 | 1) => {
    const next = months[selectedMonthIndex + step];
    if (!next) return;
    Haptics.selectionAsync();
    setSelectedMonthId(next.id);
  };

  const saveSuggestedBudget = async () => {
    if (!suggestions?.ready || savingSuggestions) return;

    const categories = suggestions.categories.map((category) => ({
      categoryId: category.categoryId,
      amount: Number(suggestionDrafts[category.categoryId] ?? 0),
    }));

    if (categories.some((category) => !Number.isFinite(category.amount) || category.amount < 0)) {
      setSuggestionMessage("Enter a valid limit for every category.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    setSavingSuggestions(true);
    setSuggestionMessage("");
    try {
      await budgetService.applySuggestions(categories);
      const [nextOverview, nextMonths] = await Promise.all([
        budgetService.getOverview(selectedMonthId),
        budgetService.getAvailableMonths(),
      ]);
      setOverview(nextOverview);
      setMonths(nextMonths);
      setSuggestionMessage("Saved. These limits will carry into future months.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      secureLog.error("budget.suggestions.save failed", error);
      setSuggestionMessage("Could not save your budget. Try again in a moment.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSavingSuggestions(false);
    }
  };

  const beginLimitEditing = () => {
    if (!overview) return;
    Haptics.selectionAsync();
    setLimitMessage("");
    setLimitDrafts(
      Object.fromEntries(
        overview.categories.map((category) => [category.id, String(category.budgetLimit)])
      )
    );
    setEditingLimits(true);
  };

  const cancelLimitEditing = () => {
    Haptics.selectionAsync();
    setEditingLimits(false);
    setLimitMessage("");
  };

  const saveCategoryLimits = async () => {
    if (!overview || savingLimits) return;
    const limits = overview.categories.map((category) => ({
      categoryId: category.id,
      amount: Number(limitDrafts[category.id] ?? category.budgetLimit),
    }));
    if (limits.some(({ amount }) => !Number.isFinite(amount) || amount < 0)) {
      setLimitMessage("Enter a valid amount for every category.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    setSavingLimits(true);
    setLimitMessage("");
    try {
      await budgetService.applySuggestions(limits);
      const [nextOverview, nextMonths] = await Promise.all([
        budgetService.getOverview(selectedMonthId),
        budgetService.getAvailableMonths(),
      ]);
      setOverview(nextOverview);
      setMonths(nextMonths);
      setEditingLimits(false);
      setLimitMessage("Your category limits are saved for future months.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      secureLog.error("budget.category-limits.save failed", error);
      setLimitMessage("Could not save category limits. Try again in a moment.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSavingLimits(false);
    }
  };

  if (!overview) {
    return (
      <View style={styles.container}>
        <View style={[styles.loadingState, { paddingTop: insets.top + 24 }]}>
          <BrandHeader style={styles.brandHeader} />
          <Text style={styles.loadingText}>Loading budget...</Text>
        </View>
      </View>
    );
  }

  const savingsRate = Math.round(overview.savingsRate);
  const recent = transactions.slice(0, 4);

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 16, paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <BrandHeader style={styles.brandHeader} />

        <ScreenHeader
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
                {syncing ? "Syncing" : accounts.length ? "Synced" : "No bank yet"}
              </Text>
            </View>
          }
        />

        <MonthNavigator
          months={months}
          selectedMonthId={selectedMonthId}
          onSelect={(monthId) => {
            Haptics.selectionAsync();
            setSelectedMonthId(monthId);
          }}
          onPrevious={() => setMonthByStep(-1)}
          onNext={() => setMonthByStep(1)}
          canPrevious={selectedMonthIndex > 0}
          canNext={selectedMonthIndex >= 0 && selectedMonthIndex < months.length - 1}
        />

        {selectedMonth && (
          <MonthInsight current={selectedMonth} previous={previousMonth} />
        )}

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
            tint={Colors.greenDark}
          />
        </View>

        {/* Spending breakdown — category donut */}
        <Card>
          <CardHeader title="Spending breakdown" hint={overview.month} />
          <SpendingDonutChart
            categories={overview.categories}
            totalSpent={overview.totalSpent}
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

        {suggestions && (
          <RecommendationCard
            suggestions={suggestions}
            drafts={suggestionDrafts}
            saving={savingSuggestions}
            message={suggestionMessage}
            goalsSummary={goalsSummary}
            onChange={(categoryId, value) => {
              setSuggestionMessage("");
              setSuggestionDrafts((current) => ({
                ...current,
                [categoryId]: moneyInput(value),
              }));
            }}
            onReset={() => {
              Haptics.selectionAsync();
              setSuggestionMessage("");
              setSuggestionDrafts(suggestionDraftsFrom(suggestions));
            }}
            onSave={saveSuggestedBudget}
          />
        )}

        {/* Budget detail — category fill bars */}
        <Card>
          <CardHeader
            title="Budget detail"
            hint={editingLimits ? "Set your monthly caps" : "Per category"}
            right={
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={editingLimits ? "Cancel editing budget limits" : "Edit budget limits"}
                onPress={editingLimits ? cancelLimitEditing : beginLimitEditing}
                style={({ pressed }) => [
                  styles.editLimitsButton,
                  pressed && styles.recommendationPressed,
                ]}
              >
                <Icon
                  name={editingLimits ? "x" : "settings"}
                  size={13}
                  color={Colors.gold}
                  strokeWidth={2.4}
                />
                <Text style={styles.editLimitsText}>{editingLimits ? "Cancel" : "Edit limits"}</Text>
              </Pressable>
            }
          />
          <View style={{ gap: 12 }}>
            {overview.categories.map((c) => (
              <CategoryRow
                key={c.id}
                category={c}
                editing={editingLimits}
                draftValue={limitDrafts[c.id] ?? String(c.budgetLimit)}
                onChangeDraft={(value) => {
                  setLimitMessage("");
                  setLimitDrafts((current) => ({
                    ...current,
                    [c.id]: moneyInput(value),
                  }));
                }}
              />
            ))}
          </View>
          {limitMessage ? (
            <Text
              style={[
                styles.recommendationMessage,
                limitMessage.startsWith("Your") && styles.recommendationMessageSuccess,
              ]}
            >
              {limitMessage}
            </Text>
          ) : null}
          {editingLimits ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Save budget category limits"
              disabled={savingLimits}
              onPress={saveCategoryLimits}
              style={({ pressed }) => [
                styles.saveLimitsButton,
                savingLimits && styles.recommendationDisabled,
                pressed && !savingLimits && styles.recommendationPressed,
              ]}
            >
              {savingLimits ? (
                <ActivityIndicator size="small" color={Colors.onAccent} />
              ) : (
                <Text style={styles.saveLimitsText}>Save category limits</Text>
              )}
            </Pressable>
          ) : null}
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
                    pressed && styles.recommendationPressed,
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
                    sub={`${t.category}${t.isRecurring ? " · Recurring" : ""}`}
                    amount={-t.amount}
                    emoji={emojiForCategory(t.categoryId)}
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
                      emoji={emojiForCategory(b.category)}
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

        {/* Accounts */}
        <Card>
          <CardHeader title="Accounts" />
          <AccountsBlock accounts={accounts} />
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

function MonthNavigator({
  months,
  selectedMonthId,
  canPrevious,
  canNext,
  onPrevious,
  onNext,
  onSelect,
}: {
  months: BudgetMonthOption[];
  selectedMonthId: string;
  canPrevious: boolean;
  canNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onSelect: (monthId: string) => void;
}) {
  const selectedMonth = months.find((month) => month.id === selectedMonthId);

  return (
    <View style={styles.monthPanel}>
      {/* Big month label flanked by airy circular arrows */}
      <View style={styles.monthPanelTop}>
        <Pressable
          disabled={!canPrevious}
          onPress={onPrevious}
          hitSlop={8}
          style={({ pressed }) => [
            styles.monthArrow,
            !canPrevious && styles.monthArrowDisabled,
            pressed && canPrevious && styles.monthArrowPressed,
          ]}
        >
          <Icon name="arrow-left" size={17} color={canPrevious ? Colors.navy : Colors.muted} strokeWidth={2.4} />
        </Pressable>

        <View style={styles.monthTitleWrap}>
          <Text style={styles.monthEyebrow}>VIEWING</Text>
          <Text style={styles.monthTitle}>{selectedMonth?.label ?? "This month"}</Text>
        </View>

        <Pressable
          disabled={!canNext}
          onPress={onNext}
          hitSlop={8}
          style={({ pressed }) => [
            styles.monthArrow,
            !canNext && styles.monthArrowDisabled,
            pressed && canNext && styles.monthArrowPressed,
          ]}
        >
          <Icon name="chevron-right" size={18} color={canNext ? Colors.navy : Colors.muted} strokeWidth={2.4} />
        </Pressable>
      </View>

      {/* Segmented month picker with an animated active pill */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.monthChips}
      >
        {months.map((month) => {
          const active = month.id === selectedMonthId;
          return (
            <Pressable
              key={month.id}
              onPress={() => onSelect(month.id)}
              style={styles.monthChipWrap}
            >
              <MotiView
                animate={{
                  backgroundColor: active ? Colors.gold : Colors.surface,
                  borderColor: active ? Colors.gold : Colors.border,
                  scale: active ? 1 : 0.97,
                }}
                transition={{ type: "timing", duration: 220 }}
                style={styles.monthChip}
              >
                <Text style={[styles.monthChipText, active && styles.monthChipTextActive]}>
                  {month.shortLabel}
                </Text>
              </MotiView>
            </Pressable>
          );
        })}
      </ScrollView>
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
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      {sub && <Text style={styles.statSub}>{sub}</Text>}
    </View>
  );
}

function RecommendationCard({
  suggestions,
  drafts,
  saving,
  message,
  goalsSummary,
  onChange,
  onReset,
  onSave,
}: {
  suggestions: BudgetSuggestionSet;
  drafts: Record<string, string>;
  saving: boolean;
  message: string;
  goalsSummary: GoalsSummary | null;
  onChange: (categoryId: string, value: string) => void;
  onReset: () => void;
  onSave: () => void;
}) {
  return (
    <Card>
      <CardHeader
        title="Bud's starting budget"
        hint="Personalized from your last 90 days"
        right={
          <View style={styles.budBadge}>
            <Icon name="sparkles" size={12} color={Colors.gold} strokeWidth={2.4} />
            <Text style={styles.budBadgeText}>BUD RECOMMENDED</Text>
          </View>
        }
      />

      {!suggestions.ready ? (
        <View style={styles.recommendationEmpty}>
          <Icon name="activity" size={17} color={Colors.teal} strokeWidth={2.4} />
          <Text style={styles.recommendationEmptyText}>
            {suggestions.message ??
              "Bud needs enough income and transaction history before building your starting limits."}
          </Text>
        </View>
      ) : (
        <>
          <Text style={styles.recommendationIntro}>
            Based on {formatCurrency(suggestions.detectedMonthlyIncome)} detected monthly income.
            Adjust any number before saving.
          </Text>

          <View style={styles.ruleGrid}>
            <RuleCell label="Needs · 50%" value={suggestions.needsTarget} />
            <RuleCell label="Wants · 30%" value={suggestions.wantsTarget} />
            <RuleCell label="Save · 20%" value={suggestions.savingsTarget} />
          </View>

          <View style={styles.goalBudgetLink}>
            <View style={styles.goalBudgetIcon}>
              <Icon name="target" size={15} color={Colors.teal} strokeWidth={2.4} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.goalBudgetTitle}>Goals inside the savings plan</Text>
              <Text style={styles.goalBudgetBody}>
                {goalsSummary?.activeCount
                  ? `${formatCurrency(goalsSummary.monthlyCommittedTotal)} per month is committed across ${goalsSummary.activeCount} active ${goalsSummary.activeCount === 1 ? "goal" : "goals"}.`
                  : "Create a goal to assign part of this monthly savings target."}
              </Text>
            </View>
            <Text style={styles.goalBudgetAmount}>
              {formatCurrency(goalsSummary?.monthlyCommittedTotal ?? 0, { compact: true })}
              <Text style={styles.goalBudgetTarget}>
                {` / ${formatCurrency(suggestions.savingsTarget, { compact: true })}`}
              </Text>
            </Text>
          </View>

          <View style={styles.recommendationList}>
            {suggestions.categories.map((category) => (
              <View key={category.categoryId} style={styles.recommendationRow}>
                <View style={styles.recommendationNameWrap}>
                  <View
                    style={[
                      styles.recommendationDot,
                      { backgroundColor: category.color },
                    ]}
                  />
                  <View style={styles.recommendationCopy}>
                    <Text style={styles.recommendationName}>{category.name}</Text>
                    <Text style={styles.recommendationAverage}>
                      90-day average {formatCurrency(category.averageSpend)}
                    </Text>
                  </View>
                </View>
                <View style={styles.recommendationInputWrap}>
                  <Text style={styles.recommendationPrefix}>$</Text>
                  <TextInput
                    accessibilityLabel={`${category.name} monthly limit`}
                    value={drafts[category.categoryId] ?? ""}
                    onChangeText={(value) => onChange(category.categoryId, value)}
                    keyboardType="decimal-pad"
                    selectTextOnFocus
                    style={styles.recommendationInput}
                  />
                </View>
              </View>
            ))}
          </View>

          {message ? (
            <Text
              style={[
                styles.recommendationMessage,
                message.startsWith("Saved") && styles.recommendationMessageSuccess,
              ]}
            >
              {message}
            </Text>
          ) : null}

          <View style={styles.recommendationActions}>
            <Pressable
              onPress={onReset}
              style={({ pressed }) => [
                styles.recommendationSecondary,
                pressed && styles.recommendationPressed,
              ]}
            >
              <Text style={styles.recommendationSecondaryText}>Use Bud's numbers</Text>
            </Pressable>
            <Pressable
              onPress={onSave}
              disabled={saving}
              style={({ pressed }) => [
                styles.recommendationPrimary,
                saving && styles.recommendationDisabled,
                pressed && !saving && styles.recommendationPressed,
              ]}
            >
              {saving ? (
                <ActivityIndicator size="small" color={Colors.onAccent} />
              ) : (
                <Text style={styles.recommendationPrimaryText}>Save my budget</Text>
              )}
            </Pressable>
          </View>
        </>
      )}
    </Card>
  );
}

function RuleCell({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.ruleCell}>
      <Text style={styles.ruleLabel}>{label}</Text>
      <Text style={styles.ruleValue}>{formatCurrency(value, { compact: true })}</Text>
    </View>
  );
}

function CategoryRow({
  category,
  editing,
  draftValue,
  onChangeDraft,
}: {
  category: BudgetCategory;
  editing: boolean;
  draftValue: string;
  onChangeDraft: (value: string) => void;
}) {
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

  const emoji = emojiForCategory(category.id);

  return (
    <View>
      <View style={styles.catRow}>
        <View style={styles.catLeft}>
          <View style={[styles.catIcon, { borderColor: `${category.color}55`, backgroundColor: `${category.color}15` }]}>
            <Text style={styles.catEmoji}>{emoji}</Text>
          </View>
          <View style={styles.catNameWrap}>
            <Text style={styles.catName}>{category.name}</Text>
            {category.source && category.source !== "default" ? (
              <Text
                style={[
                  styles.catSource,
                  category.source === "user_adjusted" && styles.catSourceAdjusted,
                ]}
              >
                {category.source === "bud_recommended" ? "Bud plan" : "Adjusted"}
              </Text>
            ) : null}
          </View>
        </View>
        {editing ? (
          <View style={styles.categoryLimitInputWrap}>
            <Text style={styles.categoryLimitPrefix}>$</Text>
            <TextInput
              accessibilityLabel={`${category.name} budget limit`}
              value={draftValue}
              onChangeText={onChangeDraft}
              keyboardType="decimal-pad"
              selectTextOnFocus
              style={styles.categoryLimitInput}
            />
          </View>
        ) : (
          <Text style={styles.catNumbers}>
            {formatCurrency(category.spent, { compact: true })}{" "}
            <Text style={styles.catBudget}>
              / {formatCurrency(category.budgetLimit, { compact: true })}
            </Text>
          </Text>
        )}
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
  emoji,
}: {
  merchant: string;
  sub: string;
  amount: number;
  emoji?: string;
}) {
  return (
    <View style={styles.txnRow}>
      <View style={styles.txnLeft}>
        <View style={styles.txnIconBox}>
          {emoji ? (
            <Text style={styles.txnEmoji}>{emoji}</Text>
          ) : (
            <Icon
              name={amount < 0 ? "arrow-down-right" : "arrow-up-right"}
              size={13}
              color={amount < 0 ? Colors.muted : Colors.emerald}
            />
          )}
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
          <View style={[styles.accountIconBox, { backgroundColor: Colors.greenSurfaceStrong, borderColor: Colors.gold }]}>
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
    color: Colors.teal,
  },

  monthPanel: {
    backgroundColor: Colors.card,
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 12,
    shadowColor: Colors.navy,
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  monthPanelTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  monthArrow: {
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.navy50,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  monthArrowPressed: {
    backgroundColor: Colors.accentAlpha10,
    transform: [{ scale: 0.94 }],
  },
  monthArrowDisabled: {
    opacity: 0.35,
  },
  monthTitleWrap: { flex: 1, alignItems: "center" },
  monthEyebrow: {
    fontSize: 10,
    fontWeight: "800",
    color: Colors.muted,
    letterSpacing: 1.6,
    marginBottom: 3,
  },
  monthTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: Colors.navy,
    letterSpacing: -0.3,
  },
  monthChips: {
    gap: 10,
    paddingHorizontal: 2,
  },
  monthChipWrap: {},
  monthChip: {
    minWidth: 72,
    alignItems: "center",
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
  },
  monthChipText: {
    fontSize: 13,
    fontWeight: "800",
    color: Colors.navyMuted,
    letterSpacing: 0.3,
  },
  monthChipTextActive: {
    color: Colors.onGreen,
  },
  monthInsight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: Colors.accentAlpha08,
    borderWidth: 1,
    borderColor: Colors.accentAlpha15,
    marginBottom: 12,
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
  editLimitsButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: Colors.accentAlpha08,
    borderWidth: 1,
    borderColor: Colors.accentAlpha25,
  },
  editLimitsText: { fontSize: 11, fontWeight: "800", color: Colors.gold },
  saveLimitsButton: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
    borderRadius: 14,
    backgroundColor: Colors.gold,
  },
  saveLimitsText: { fontSize: 13, fontWeight: "900", color: Colors.onAccent },
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

  // Personalized budget recommendations
  budBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: Colors.accentAlpha08,
    borderWidth: 1,
    borderColor: Colors.accentAlpha25,
  },
  budBadgeText: {
    fontSize: 9,
    fontWeight: "900",
    color: Colors.gold,
    letterSpacing: 0.5,
  },
  recommendationIntro: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.navyMuted,
    lineHeight: 18,
    marginBottom: 12,
  },
  ruleGrid: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  ruleCell: {
    flex: 1,
    padding: 10,
    borderRadius: 12,
    backgroundColor: Colors.greenSurface,
    borderWidth: 1,
    borderColor: Colors.greenBorder,
  },
  ruleLabel: {
    fontSize: 9,
    fontWeight: "800",
    color: Colors.navyMuted,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  ruleValue: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: "900",
    color: Colors.navy,
  },
  goalBudgetLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
    padding: 12,
    borderRadius: 14,
    backgroundColor: Colors.greenSurface,
    borderWidth: 1,
    borderColor: Colors.greenBorder,
  },
  goalBudgetIcon: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: Colors.card,
  },
  goalBudgetTitle: { fontSize: 11, fontWeight: "800", color: Colors.navy },
  goalBudgetBody: {
    marginTop: 2,
    fontSize: 10,
    fontWeight: "600",
    color: Colors.navyMuted,
    lineHeight: 15,
  },
  goalBudgetAmount: { fontSize: 12, fontWeight: "900", color: Colors.navy },
  goalBudgetTarget: { color: Colors.muted, fontWeight: "700" },
  recommendationList: { gap: 9 },
  recommendationRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  recommendationNameWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  recommendationDot: { width: 8, height: 8, borderRadius: 4 },
  recommendationCopy: { flex: 1 },
  recommendationName: { fontSize: 12, fontWeight: "800", color: Colors.navy },
  recommendationAverage: {
    marginTop: 2,
    fontSize: 10,
    fontWeight: "600",
    color: Colors.muted,
  },
  recommendationInputWrap: {
    width: 96,
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    paddingHorizontal: 10,
  },
  recommendationPrefix: { fontSize: 13, fontWeight: "800", color: Colors.gold },
  recommendationInput: {
    flex: 1,
    paddingVertical: 9,
    paddingLeft: 4,
    textAlign: "right",
    fontSize: 13,
    fontWeight: "800",
    color: Colors.navy,
  },
  recommendationMessage: {
    marginTop: 12,
    fontSize: 11,
    fontWeight: "700",
    color: Colors.coral,
    textAlign: "center",
  },
  recommendationMessageSuccess: { color: Colors.teal },
  recommendationActions: { flexDirection: "row", gap: 10, marginTop: 14 },
  recommendationSecondary: {
    flex: 1,
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  recommendationPrimary: {
    flex: 1,
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: Colors.gold,
  },
  recommendationSecondaryText: { fontSize: 12, fontWeight: "800", color: Colors.navy },
  recommendationPrimaryText: { fontSize: 12, fontWeight: "900", color: Colors.onAccent },
  recommendationPressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
  recommendationDisabled: { opacity: 0.6 },
  recommendationEmpty: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 13,
    borderRadius: 14,
    backgroundColor: Colors.greenSurface,
    borderWidth: 1,
    borderColor: Colors.greenBorder,
  },
  recommendationEmptyText: {
    flex: 1,
    fontSize: 12,
    fontWeight: "700",
    color: Colors.navyMuted,
    lineHeight: 18,
  },

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
  catEmoji: { fontSize: 15, lineHeight: 18 },
  catNameWrap: { gap: 2 },
  catName: { fontSize: 13, fontWeight: "700", color: Colors.navy },
  catSource: {
    alignSelf: "flex-start",
    fontSize: 9,
    fontWeight: "800",
    color: Colors.teal,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  catSourceAdjusted: { color: Colors.gold },
  catNumbers: { fontSize: 13, fontWeight: "700", color: Colors.navy },
  catBudget: { color: Colors.muted, fontWeight: "600" },
  categoryLimitInputWrap: {
    width: 104,
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.accentAlpha30,
    backgroundColor: Colors.surface,
  },
  categoryLimitPrefix: { fontSize: 13, fontWeight: "900", color: Colors.gold },
  categoryLimitInput: {
    flex: 1,
    paddingVertical: 9,
    paddingLeft: 4,
    textAlign: "right",
    fontSize: 13,
    fontWeight: "800",
    color: Colors.navy,
  },
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
  txnLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  txnIconBox: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: Colors.navy50,
    alignItems: "center",
    justifyContent: "center",
  },
  txnEmoji: { fontSize: 16, lineHeight: 20 },
  txnMerchant: { fontSize: 13, fontWeight: "700", color: Colors.navy },
  txnSub: { fontSize: 11, color: Colors.muted, marginTop: 1 },
  txnAmount: { fontSize: 14, fontWeight: "700" },
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
    fontSize: 18,
    fontWeight: "800",
    color: Colors.navy,
    letterSpacing: 0,
  },
});

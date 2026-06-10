/**
 * Today Tab — Home Dashboard
 *
 * Matches the CEO's vision drawing:
 *   • Emotional Why anchor at top (the user's reason)
 *   • Stats Card — Net Worth, Health Score, Level + Streak / XP / Savings Rate
 *   • Daily Spend Snapshot — $X of $Y today, top merchant
 *   • Upcoming Bills — recurring charges within 48h
 *   • Recent Transactions — last 4 from Plaid
 *   • Goal Progress Card — most active goal
 *
 * Strict rules followed (developer review §6):
 *   • Emojis are reserved for spending categories and Buds kudos only
 *   • Bud's greeting copy passes the Friend / Cringe / Shame tests
 *   • No prescriptive language ("you should/must/need to")
 *
 * Data layer: each section reads from a service/mock so the swap to the
 * real backend is transparent (controlled by EXPO_PUBLIC_USE_MOCK).
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

import { Colors } from "@/constants/colors";
import { useUser } from "@/hooks/useAuth";
import { BrandHeader, BrandLogo } from "@/components/BrandLogo";
import { Icon } from "@/components/Icon";
import {
  MOCK_UPCOMING_BILLS,
  type AccountSummary,
  type Transaction,
} from "@/mock/budget";
import { MOCK_BUD_GREETING } from "@/mock/bud";
import { MOCK_LEAGUE } from "@/mock/quests";
import { budgetService, linkedAccountNetWorth } from "@/services/budgetService";
import { goalsService } from "@/services/goalsService";
import { todayService, type TodaySummary } from "@/services/todayService";
import type { Goal } from "@/mock/goals";
import { formatCurrency, secureLog } from "@/utils/security";
import { CountUp, FadeInUp } from "@/animations";

const TAB_BAR_HEIGHT = 80;

const SPENDING_EMOJI: Record<string, string> = {
  food: "🍔",
  transport: "🚗",
  shopping: "🛍️",
  housing: "🏠",
  entertainment: "🎬",
  health: "💊",
  personal: "✂️",
  education: "📚",
};

const EMPTY_TODAY_SUMMARY: TodaySummary = {
  totalSpent: 0,
  dailyBudget: 0,
  topCategoryName: "",
  topCategoryAmount: 0,
};

function currentMonthId() {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  return `${now.getFullYear()}-${month}`;
}

export default function TodayScreen() {
  const insets = useSafeAreaInsets();
  const user = useUser();

  const fade = useRef(new Animated.Value(0)).current;
  const lift = useRef(new Animated.Value(16)).current;

  const [activeGoal, setActiveGoal] = useState<Goal | null>(null);
  const [summary, setSummary] = useState<TodaySummary>(EMPTY_TODAY_SUMMARY);
  const [recentTxns, setRecentTxns] = useState<Transaction[]>([]);
  const [linkedAccounts, setLinkedAccounts] = useState<AccountSummary[]>([]);
  const [accountsLoaded, setAccountsLoaded] = useState(false);
  const [savingsRate, setSavingsRate] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const loadActiveGoal = useCallback(async () => {
    try {
      const { goals } = await goalsService.list();
      const sorted = [...goals].sort(
        (a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
      );
      setActiveGoal(sorted[0] ?? null);
    } catch (e) {
      secureLog.error("today.goals failed", e);
    }
  }, []);

  const loadMoneySnapshot = useCallback(async () => {
    try {
      const nextSummary = await todayService.getSummary();
      setSummary(nextSummary);
    } catch (error) {
      secureLog.warn("today.summary failed", error);
    }

    try {
      const nextTransactions = await todayService.getRecentTransactions();
      setRecentTxns(nextTransactions);
    } catch (error) {
      secureLog.warn("today.transactions failed", error);
    }

    try {
      const nextAccounts = await budgetService.getAccounts();
      setLinkedAccounts(nextAccounts);
      setAccountsLoaded(true);
    } catch (error) {
      secureLog.warn("today.accounts failed", error);
    }

    try {
      const currentOverview = await budgetService.getOverview(currentMonthId());
      setSavingsRate(Math.max(0, Math.round(currentOverview.savingsRate)));
    } catch (error) {
      secureLog.warn("today.overview failed", error);
    }
  }, []);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(lift, { toValue: 0, damping: 16, stiffness: 130, useNativeDriver: true }),
    ]).start();
  }, [fade, lift]);

  useEffect(() => {
    loadActiveGoal();
    loadMoneySnapshot();
  }, [loadActiveGoal, loadMoneySnapshot]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([loadActiveGoal(), loadMoneySnapshot()]);
    } finally {
      setRefreshing(false);
    }
  };

  if (!user) return null;

  const greeting = MOCK_BUD_GREETING(user.firstName, user.streak);
  const linkedNetWorth = accountsLoaded
    ? linkedAccountNetWorth(linkedAccounts)
    : user.netWorth;

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 24 },
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
        <Animated.View style={{ opacity: fade, transform: [{ translateY: lift }] }}>
          {/* Hero scrolls with content — avoids a fixed blue strip behind the feed */}
          <LinearGradient
            colors={[Colors.navy800, Colors.navy600, Colors.navy600]}
            locations={[0, 0.55, 1]}
            style={styles.heroGradient}
          >
            <View style={{ paddingTop: insets.top + 12 }}>
              <View style={styles.headerBlock}>
                <View style={styles.brandTopRow}>
                  <View style={styles.brandSide} />
                  <View style={styles.brandCenter}>
                    <BrandHeader dark style={styles.brandHeader} />
                  </View>
                  <View style={styles.brandSide}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Open profile and settings"
                      hitSlop={8}
                      style={({ pressed }) => [styles.profileBtn, pressed && styles.profileBtnPressed]}
                      onPress={() => {
                        Haptics.selectionAsync();
                        router.push("/profile");
                      }}
                    >
                      <Icon name="menu" size={22} color={Colors.brandOnDark} strokeWidth={2.6} />
                    </Pressable>
                  </View>
                </View>
                <View style={styles.greetingRow}>
                  <View style={styles.budAvatar}>
                    <BrandLogo variant="mark" markSize={42} />
                  </View>
                  <Text style={styles.greetingText}>{greeting}</Text>
                </View>
              </View>

              {user.why ? (
                <WhyCard firstName={user.firstName} why={user.why} />
              ) : null}
            </View>
          </LinearGradient>

          <View style={styles.bodyPadding}>
          {/* Stats Card */}
          <FadeInUp delay={60}>
            <StatsCard
              netWorth={linkedNetWorth}
              accountCount={linkedAccounts.length}
              healthScore={user.financialHealthScore || 620}
              level={user.level}
              streak={user.streak}
              xp={user.xp}
              savingsRate={savingsRate}
            />
          </FadeInUp>

          <FadeInUp delay={140}>
            <LeagueSnapshotCard />
          </FadeInUp>

          {/* Daily Spend Snapshot */}
          <FadeInUp delay={220}>
            <DailySpendCard
              summary={summary}
              onPress={() => {
                Haptics.selectionAsync();
                router.push("/(tabs)/budget");
              }}
            />
          </FadeInUp>

          {/* Upcoming Bills */}
          <FadeInUp delay={300}>
            <UpcomingBillsCard />
          </FadeInUp>

          {/* Recent Transactions */}
          <SectionHeader
            title="Recent transactions"
            action="See all"
            onAction={() => router.push("/(tabs)/budget")}
          />
          <View style={styles.txnCard}>
            {recentTxns.length === 0 && (
              <Text style={styles.emptyTransactions}>
                No synced spending transactions yet.
              </Text>
            )}
            {recentTxns.map((t, i) => (
              <React.Fragment key={t.id}>
                <View style={styles.txnRow}>
                  <View style={styles.txnLeft}>
                    <View style={styles.txnIconBox}>
                      <Text style={styles.txnEmoji}>
                        {SPENDING_EMOJI[t.categoryId] ?? "💸"}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.txnMerchant}>{t.merchant}</Text>
                      <Text style={styles.txnCategory}>
                        {t.category}
                        {t.isRecurring ? " · Recurring" : ""}
                      </Text>
                    </View>
                  </View>
                  <Text
                    style={[
                      styles.txnAmount,
                      t.amount < 0 ? { color: Colors.emerald } : null,
                    ]}
                  >
                    {formatCurrency(t.amount < 0 ? Math.abs(t.amount) : -t.amount, { sign: true })}
                  </Text>
                </View>
                {i < recentTxns.length - 1 && <View style={styles.txnDivider} />}
              </React.Fragment>
            ))}
          </View>

          {/* Goal Progress */}
          {activeGoal && (
            <>
              <SectionHeader
                title="Goal in motion"
                action="See all"
                onAction={() => router.push("/(tabs)/goals")}
              />
              <GoalProgressCard goal={activeGoal} />
            </>
          )}
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

// ─── Why card ────────────────────────────────────────────────────────────────

function WhyCard({ firstName, why }: { firstName: string; why: string }) {
  return (
    <View style={styles.whyCard}>
      <View style={styles.whyHeader}>
        <Icon name="sparkles" size={12} color={Colors.gold} />
        <Text style={styles.whyEyebrow}>{firstName.toUpperCase()}'S WHY</Text>
      </View>
      <Text style={styles.whyQuote}>“{why}”</Text>
    </View>
  );
}

// ─── Stats card (CEO drawing — the central hero) ─────────────────────────────

function StatsCard({
  netWorth,
  accountCount,
  healthScore,
  level,
  streak,
  xp,
  savingsRate,
}: {
  netWorth: number;
  accountCount: number;
  healthScore: number;
  level: number;
  streak: number;
  xp: number;
  savingsRate: number;
}) {
  const flameAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(flameAnim, { toValue: 1.12, duration: 900, useNativeDriver: true }),
        Animated.timing(flameAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, [flameAnim]);

  return (
    <View style={styles.statsCard}>
      {/* Top row — Net Worth + Health Score + Level */}
      <View style={styles.statsTopRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.statsEyebrow}>NET WORTH</Text>
          <CountUp
            value={netWorth}
            format={(n) => formatCurrency(n)}
            style={styles.netWorthAmount}
            accessibilityLabel={`Net worth ${formatCurrency(netWorth)}`}
          />
          <View style={styles.netWorthChange}>
            <Icon name="building" size={11} color={Colors.emerald} />
            <Text style={styles.netWorthChangeText}>
              {accountCount > 0
                ? `${accountCount} linked ${accountCount === 1 ? "account" : "accounts"}`
                : "No linked accounts yet"}
            </Text>
          </View>
        </View>

        <View style={styles.healthBox}>
          <Text style={styles.healthLabel}>HEALTH</Text>
          <CountUp value={healthScore} style={styles.healthScore} />
        </View>

        <View style={styles.levelBadge}>
          <LinearGradient colors={[Colors.gold400, Colors.gold600]} style={styles.levelBadgeInner}>
            <Text style={styles.levelBadgeText}>{level}</Text>
          </LinearGradient>
          <Text style={styles.levelLabel}>LEVEL</Text>
        </View>
      </View>

      {/* Divider */}
      <View style={styles.statsDivider} />

      {/* Bottom row — Streak / XP / Savings Rate */}
      <View style={styles.statsBottomRow}>
        <View style={styles.statsCell}>
          <Animated.View style={{ transform: [{ scale: flameAnim }] }}>
            <Icon name="flame" size={18} color={Colors.gold} strokeWidth={2.4} />
          </Animated.View>
          <View>
            <Text style={styles.statsCellValue}>{streak}</Text>
            <Text style={styles.statsCellLabel}>day streak</Text>
          </View>
        </View>
        <View style={styles.statsCell}>
          <Icon name="zap" size={18} color={Colors.teal} strokeWidth={2.4} />
          <View>
            <CountUp
              value={xp}
              format={(n) => Math.round(n).toLocaleString()}
              style={styles.statsCellValue}
            />
            <Text style={styles.statsCellLabel}>XP</Text>
          </View>
        </View>
        <View style={styles.statsCell}>
          <Icon name="piggy-bank" size={18} color={Colors.emerald} strokeWidth={2.2} />
          <View>
            <CountUp
              value={savingsRate}
              format={(n) => `${Math.round(n)}%`}
              style={styles.statsCellValue}
            />
            <Text style={styles.statsCellLabel}>saving rate</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

// ─── Wealth League snapshot ─────────────────────────────────────────────────

function LeagueSnapshotCard() {
  const currentUser = MOCK_LEAGUE.users.find((u) => u.isCurrentUser);
  const nextRank = MOCK_LEAGUE.users[MOCK_LEAGUE.currentUserRank - 2];
  const gap = currentUser && nextRank ? Math.max(0, nextRank.xp - currentUser.xp) : 0;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.leagueSnapshot,
        pressed && { opacity: 0.94 },
      ]}
      onPress={() => {
        Haptics.selectionAsync();
        router.push("/(tabs)/buds");
      }}
    >
      <View style={styles.leagueSnapshotTop}>
        <View style={styles.leagueSnapshotTitleRow}>
          <Icon name="trophy" size={16} color={Colors.gold} strokeWidth={2.4} />
          <Text style={styles.leagueSnapshotTitle}>Wealth League</Text>
        </View>
        <Text style={styles.leagueSnapshotRank}>
          #{MOCK_LEAGUE.currentUserRank}
        </Text>
      </View>
      <Text style={styles.leagueSnapshotBody}>
        {gap > 0
          ? `${gap.toLocaleString()} XP from the advance zone.`
          : "You're inside the advance zone."}
      </Text>
      <View style={styles.leagueMiniTrack}>
        <View style={[styles.leagueMiniFill, { width: "72%" }]} />
      </View>
    </Pressable>
  );
}

// ─── Daily spend ────────────────────────────────────────────────────────────

function DailySpendCard({
  summary,
  onPress,
}: {
  summary: TodaySummary;
  onPress: () => void;
}) {
  const dailyBudget = Math.max(0, summary.dailyBudget);
  const pct = dailyBudget > 0 ? Math.min(100, (summary.totalSpent / dailyBudget) * 100) : 0;
  const status =
    pct >= 100 ? { label: "Over today's limit", color: Colors.coral }
    : pct >= 80 ? { label: "Approaching limit", color: Colors.amber }
    : { label: "On track", color: Colors.emerald };
  const topSpendLabel =
    summary.topCategoryAmount > 0 && summary.topCategoryName
      ? `${summary.topCategoryName} · ${formatCurrency(summary.topCategoryAmount)}`
      : "No spending synced today";

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.dailyCard, pressed && { opacity: 0.94 }]}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>Today</Text>
        <View style={styles.statusPill}>
          <View style={[styles.statusDot, { backgroundColor: status.color }]} />
          <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
        </View>
      </View>
      <Text style={styles.dailyAmount}>
        {formatCurrency(summary.totalSpent)}
        <Text style={styles.dailyAmountLight}> / {formatCurrency(dailyBudget)}</Text>
      </Text>
      <View style={styles.dailyTrack}>
        <View style={[styles.dailyFill, { width: `${pct}%`, backgroundColor: status.color }]} />
      </View>
      <View style={styles.merchantRow}>
        <Text style={styles.merchantLabel}>Top spend</Text>
        <Text style={styles.merchantValue}>{topSpendLabel}</Text>
      </View>
    </Pressable>
  );
}

// ─── Upcoming bills ──────────────────────────────────────────────────────────

function UpcomingBillsCard() {
  if (MOCK_UPCOMING_BILLS.length === 0) return null;

  return (
    <View style={styles.billsCard}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>Upcoming bills</Text>
        <Icon name="bell" size={14} color={Colors.muted} />
      </View>
      {MOCK_UPCOMING_BILLS.map((b, i) => {
        const days = Math.max(
          0,
          Math.ceil((new Date(b.dueAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        );
        const dueLabel = days === 0 ? "Today" : days === 1 ? "Tomorrow" : `In ${days} days`;
        return (
          <React.Fragment key={b.id}>
            <View style={styles.billRow}>
              <View style={styles.billLeft}>
                <View
                  style={[
                    styles.billIndicator,
                    { backgroundColor: b.isCovered ? Colors.emerald50 : Colors.coral50 },
                  ]}
                >
                  <Icon
                    name={b.isCovered ? "shield-check" : "alert-circle"}
                    size={14}
                    color={b.isCovered ? Colors.emerald : Colors.coral}
                  />
                </View>
                <View>
                  <Text style={styles.billMerchant}>{b.merchant}</Text>
                  <Text style={styles.billDue}>{dueLabel}</Text>
                </View>
              </View>
              <Text style={styles.billAmount}>−{formatCurrency(b.amount)}</Text>
            </View>
            {i < MOCK_UPCOMING_BILLS.length - 1 && <View style={styles.billDivider} />}
          </React.Fragment>
        );
      })}
    </View>
  );
}

// ─── Goal progress card ──────────────────────────────────────────────────────

function GoalProgressCard({ goal }: { goal: Goal }) {
  const pct = goal.targetAmount === 0 ? 0 : goal.alreadySaved / goal.targetAmount;
  const remaining = goal.targetAmount - goal.alreadySaved;

  return (
    <Pressable
      style={({ pressed }) => [styles.goalCard, pressed && { opacity: 0.94 }]}
      onPress={() => router.push("/(tabs)/goals")}
    >
      <View style={styles.goalCardTop}>
        <Text style={styles.goalCardName}>{goal.name}</Text>
        <Text style={styles.goalCardPct}>{Math.round(pct * 100)}%</Text>
      </View>
      <Text style={styles.goalCardReason} numberOfLines={2}>
        “{goal.reason}”
      </Text>
      <View style={styles.goalCardTrack}>
        <View style={[styles.goalCardFill, { width: `${pct * 100}%` }]} />
      </View>
      <View style={styles.goalCardBottom}>
        <Text style={styles.goalCardSaved}>{formatCurrency(goal.alreadySaved)}</Text>
        <Text style={styles.goalCardRemaining}>
          {formatCurrency(remaining)} to go
        </Text>
      </View>
    </Pressable>
  );
}

// ─── Section header (shared) ────────────────────────────────────────────────

function SectionHeader({
  title,
  action,
  onAction,
}: {
  title: string;
  action: string;
  onAction: () => void;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Pressable onPress={onAction} hitSlop={10}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Text style={styles.sectionAction}>{action}</Text>
          <Icon name="chevron-right" size={14} color={Colors.gold} strokeWidth={2.4} />
        </View>
      </Pressable>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  scroll: { flex: 1, backgroundColor: Colors.surface },
  scrollContent: {
    flexGrow: 1,
    backgroundColor: Colors.surface,
  },
  heroGradient: {
    width: "100%",
    paddingHorizontal: 18,
    paddingBottom: 12,
  },
  bodyPadding: {
    paddingHorizontal: 18,
    paddingTop: 8,
    gap: 6,
    backgroundColor: Colors.surface,
  },

  headerBlock: { paddingBottom: 16, paddingTop: 0 },
  brandTopRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 40,
    marginBottom: 18,
  },
  brandSide: {
    width: 40,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  brandCenter: { flex: 1, alignItems: "center", justifyContent: "center" },
  brandHeader: { marginBottom: 0 },
  profileBtn: {
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  profileBtnPressed: {
    opacity: 0.78,
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  greetingRow: { flexDirection: "row", gap: 12, alignItems: "center" },
  budAvatar: { width: 42, height: 42, alignItems: "center", justifyContent: "center" },
  greetingText: {
    flex: 1,
    fontSize: 14,
    color: Colors.brandOnDark,
    lineHeight: 20,
    fontWeight: "500",
  },

  // Why
  whyCard: {
    backgroundColor: Colors.greenSurface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.greenBorder,
  },
  whyHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  whyEyebrow: {
    fontSize: 10,
    fontWeight: "800",
    color: Colors.gold,
    letterSpacing: 1.6,
  },
  whyQuote: {
    fontSize: 15,
    color: Colors.navy,
    fontWeight: "600",
    lineHeight: 22,
    fontStyle: "italic",
  },

  // Stats card
  statsCard: {
    backgroundColor: Colors.card,
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: Colors.navy,
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  statsTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
  },
  statsEyebrow: {
    fontSize: 10,
    fontWeight: "800",
    color: Colors.muted,
    letterSpacing: 1.4,
    marginBottom: 4,
  },
  netWorthAmount: {
    fontSize: 26,
    fontWeight: "800",
    color: Colors.navy,
    letterSpacing: 0,
  },
  netWorthChange: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  netWorthChangeText: { fontSize: 11, fontWeight: "600", color: Colors.emerald },

  healthBox: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: Colors.navy50,
    alignItems: "center",
    minWidth: 64,
  },
  healthLabel: {
    fontSize: 9,
    fontWeight: "800",
    color: Colors.navyMuted,
    letterSpacing: 1,
  },
  healthScore: {
    fontSize: 20,
    fontWeight: "800",
    color: Colors.navy,
    letterSpacing: 0,
    marginTop: 1,
  },

  levelBadge: { alignItems: "center", gap: 4 },
  levelBadgeInner: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: Colors.gold,
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  levelBadgeText: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.onAccent,
    letterSpacing: 0,
  },
  levelLabel: {
    fontSize: 9,
    fontWeight: "800",
    color: Colors.navyMuted,
    letterSpacing: 1.2,
  },

  statsDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginBottom: 12,
  },
  statsBottomRow: { flexDirection: "row" },
  statsCell: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statsCellValue: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.navy,
    letterSpacing: 0,
  },
  statsCellLabel: { fontSize: 10, color: Colors.muted, fontWeight: "600", marginTop: 1 },

  // League snapshot
  leagueSnapshot: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 15,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  leagueSnapshotTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  leagueSnapshotTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  leagueSnapshotTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: Colors.navy,
    letterSpacing: 0,
  },
  leagueSnapshotRank: {
    fontSize: 14,
    fontWeight: "900",
    color: Colors.gold,
    letterSpacing: 0,
  },
  leagueSnapshotBody: {
    fontSize: 12,
    color: Colors.navyMuted,
    fontWeight: "700",
    marginBottom: 10,
  },
  leagueMiniTrack: {
    height: 5,
    borderRadius: 3,
    backgroundColor: Colors.border,
    overflow: "hidden",
  },
  leagueMiniFill: {
    height: 5,
    borderRadius: 3,
    backgroundColor: Colors.gold,
  },

  // Daily card
  dailyCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: Colors.navy,
    letterSpacing: 0,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: Colors.navy50,
    borderRadius: 999,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.4 },
  dailyAmount: {
    fontSize: 26,
    fontWeight: "800",
    color: Colors.navy,
    letterSpacing: 0,
    marginBottom: 8,
  },
  dailyAmountLight: { fontSize: 16, color: Colors.muted, fontWeight: "600" },
  dailyTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.border,
    overflow: "hidden",
    marginBottom: 12,
  },
  dailyFill: { height: 6, borderRadius: 3 },
  merchantRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  merchantLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.muted,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  merchantValue: { fontSize: 13, fontWeight: "700", color: Colors.navy },

  // Bills
  billsCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  billRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  billLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  billIndicator: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  billMerchant: { fontSize: 13, fontWeight: "700", color: Colors.navy },
  billDue: { fontSize: 11, color: Colors.muted, marginTop: 1 },
  billAmount: { fontSize: 14, fontWeight: "700", color: Colors.navy },
  billDivider: { height: 1, backgroundColor: Colors.border },

  // Section
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 6,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: Colors.navy,
    letterSpacing: 0,
  },
  sectionAction: { fontSize: 12, color: Colors.gold, fontWeight: "700" },

  // Transactions
  txnCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 12,
  },
  txnRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12,
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
  txnCategory: { fontSize: 11, color: Colors.muted, marginTop: 1 },
  txnAmount: { fontSize: 14, fontWeight: "700", color: Colors.navy },
  txnDivider: { height: 1, backgroundColor: Colors.border, marginHorizontal: 14 },
  emptyTransactions: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    textAlign: "center",
    fontSize: 13,
    fontWeight: "700",
    color: Colors.muted,
  },

  // Goal card
  goalCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 4,
  },
  goalCardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  goalCardName: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.navy,
    letterSpacing: 0,
  },
  goalCardPct: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.gold,
    letterSpacing: 0,
  },
  goalCardReason: {
    fontSize: 13,
    color: Colors.navyMuted,
    fontStyle: "italic",
    lineHeight: 19,
    marginBottom: 12,
  },
  goalCardTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.border,
    overflow: "hidden",
    marginBottom: 10,
  },
  goalCardFill: { height: 6, backgroundColor: Colors.gold, borderRadius: 3 },
  goalCardBottom: { flexDirection: "row", justifyContent: "space-between" },
  goalCardSaved: { fontSize: 14, fontWeight: "800", color: Colors.navy },
  goalCardRemaining: { fontSize: 12, color: Colors.muted, fontWeight: "600" },
});

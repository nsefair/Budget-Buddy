import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Animated,
} from "react-native";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "@/constants/colors";
import { useUser } from "@/hooks/useAuth";
import { MOCK_QUESTS } from "@/mock/quests";
import { MOCK_TRANSACTIONS, MOCK_BUDGET_OVERVIEW } from "@/mock/budget";
import { MOCK_BUD_GREETING, MOCK_BUD_INSIGHT } from "@/mock/bud";

const TAB_BAR_HEIGHT = 80;

export default function TodayScreen() {
  const insets = useSafeAreaInsets();
  const user = useUser();

  const headerOpacity = useRef(new Animated.Value(0)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const contentY = useRef(new Animated.Value(20)).current;
  const flamePulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(headerOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.sequence([
        Animated.delay(200),
        Animated.parallel([
          Animated.timing(contentOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.spring(contentY, { toValue: 0, damping: 14, stiffness: 120, useNativeDriver: true }),
        ]),
      ]),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(flamePulse, { toValue: 1.14, duration: 900, useNativeDriver: true }),
        Animated.timing(flamePulse, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  if (!user) return null;

  const greeting = MOCK_BUD_GREETING(user.firstName, user.streak);
  const activeQuests = MOCK_QUESTS.filter((q) => q.status === "active").slice(0, 2);
  const recentTxns = MOCK_TRANSACTIONS.slice(0, 4);
  const xpPct = Math.round((user.xp / user.xpToNextLevel) * 100);
  const spentPct = Math.round((MOCK_BUDGET_OVERVIEW.totalSpent / MOCK_BUDGET_OVERVIEW.totalBudget) * 100);
  const barColor = spentPct > 90 ? Colors.coral : spentPct > 75 ? Colors.amber : Colors.emerald;

  return (
    <View style={styles.container}>
      {/* Sticky top bar */}
      <Animated.View style={[styles.topBar, { paddingTop: insets.top + 8, opacity: headerOpacity }]}>
        <LinearGradient colors={["#0E1926", "#1B2B4B"]} style={StyleSheet.absoluteFillObject} />
        <Text style={styles.wordmark}>Budget Buddy</Text>

        <View style={styles.statsRow}>
          <Pressable style={styles.statChip}>
            <Text style={styles.statChipLabel}>Score</Text>
            <Text style={styles.statChipValue}>{user.financialHealthScore}</Text>
          </Pressable>

          <Pressable style={styles.statChip}>
            <Text style={styles.statChipLabel}>Net Worth</Text>
            <Text style={[styles.statChipValue, { color: Colors.emerald }]}>
              ${user.netWorth.toLocaleString()}
            </Text>
          </Pressable>

          <Pressable style={styles.statChip}>
            <Animated.Text style={[styles.streakEmoji, { transform: [{ scale: flamePulse }] }]}>
              🔥
            </Animated.Text>
            <Text style={[styles.statChipValue, { color: Colors.gold }]}>{user.streak}d</Text>
          </Pressable>

          <View style={styles.levelChip}>
            <Text style={styles.levelText}>Lv {user.level}</Text>
            <View style={styles.xpBar}>
              <View style={[styles.xpFill, { width: `${xpPct}%` }]} />
            </View>
          </View>
        </View>
      </Animated.View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 100, paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ opacity: contentOpacity, transform: [{ translateY: contentY }] }}>

          {/* Bud Greeting */}
          <View style={styles.greetingCard}>
            <View style={styles.budAvatar}>
              <LinearGradient colors={[Colors.gold, "#E08A10"]} style={styles.budAvatarGradient}>
                <Text style={styles.budAvatarText}>B</Text>
              </LinearGradient>
            </View>
            <Text style={styles.greetingText}>{greeting}</Text>
          </View>

          {/* Emotional Why */}
          <View style={styles.whyCard}>
            <Text style={styles.whyEmoji}>{user.whyEmoji}</Text>
            <Text style={styles.whyText} numberOfLines={2}>{user.why}</Text>
          </View>

          {/* Spending Snapshot */}
          <SectionHeader title="Today's Spending" action="See All" onAction={() => router.push("/(tabs)/budget")} />
          <View style={styles.spendingCard}>
            <View style={styles.spendingRow}>
              <View>
                <Text style={styles.spendingAmount}>${MOCK_BUDGET_OVERVIEW.totalSpent.toLocaleString()}</Text>
                <Text style={styles.spendingLabel}>spent of ${MOCK_BUDGET_OVERVIEW.totalBudget.toLocaleString()} budget</Text>
              </View>
              <View style={styles.spendingStatus}>
                <View style={[styles.spendingDot, { backgroundColor: barColor }]} />
                <Text style={styles.spendingStatusText}>
                  {spentPct > 90 ? "Over limit" : spentPct > 75 ? "Approaching" : "On track"}
                </Text>
              </View>
            </View>
            <View style={styles.spendingTrack}>
              <View style={[styles.spendingFill, { width: `${Math.min(spentPct, 100)}%`, backgroundColor: barColor }]} />
            </View>
          </View>

          {/* Bud Insight */}
          <View style={styles.insightCard}>
            <Text style={styles.insightLabel}>💡 Bud's Insight</Text>
            <Text style={styles.insightText}>{MOCK_BUD_INSIGHT.message}</Text>
          </View>

          {/* Active Quests */}
          <SectionHeader title="Active Quests" action="See All" onAction={() => router.push("/(tabs)/quests")} />
          <View style={styles.questsContainer}>
            {activeQuests.map((quest) => {
              const pct = Math.min((quest.progress / quest.total) * 100, 100);
              return (
                <Pressable key={quest.id} style={styles.questCard}>
                  <View style={styles.questCardHeader}>
                    <View style={styles.questTypeBadge}>
                      <Text style={styles.questTypeText}>
                        {quest.type === "short" ? "Daily" : quest.type === "medium" ? "Monthly" : "Ongoing"}
                      </Text>
                    </View>
                    <Text style={styles.questXP}>+{quest.xpReward} XP</Text>
                  </View>
                  <Text style={styles.questTitle}>{quest.title}</Text>
                  <Text style={styles.questWhy} numberOfLines={1}>{quest.whyItMatters}</Text>
                  <View style={styles.questProgress}>
                    <View style={styles.questTrack}>
                      <View style={[styles.questFill, { width: `${pct}%` }]} />
                    </View>
                    <Text style={styles.questPct}>{Math.round(pct)}%</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          {/* Recent Transactions */}
          <SectionHeader title="Recent Transactions" action="See All" onAction={() => router.push("/(tabs)/budget")} />
          <View style={styles.transactionsCard}>
            {recentTxns.map((txn, idx) => (
              <React.Fragment key={txn.id}>
                <View style={styles.txnRow}>
                  <View style={styles.txnLeft}>
                    <View style={styles.txnIconWrap}>
                      <Text style={styles.txnIcon}>{txn.isRecurring ? "🔄" : txn.isFlagged ? "⚠️" : "💳"}</Text>
                    </View>
                    <View>
                      <Text style={styles.txnMerchant}>{txn.merchant}</Text>
                      <Text style={styles.txnCategory}>{txn.category}</Text>
                    </View>
                  </View>
                  <Text style={[styles.txnAmount, txn.amount > 50 && { color: Colors.coral }]}>
                    -${txn.amount.toFixed(2)}
                  </Text>
                </View>
                {idx < recentTxns.length - 1 && <View style={styles.txnDivider} />}
              </React.Fragment>
            ))}
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

function SectionHeader({ title, action, onAction }: { title: string; action: string; onAction: () => void }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Pressable onPress={onAction}><Text style={styles.sectionAction}>{action}</Text></Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  topBar: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 10, paddingHorizontal: 20, paddingBottom: 12 },
  wordmark: { fontSize: 13, fontWeight: "600", color: "rgba(255,255,255,0.4)", letterSpacing: 2, textTransform: "uppercase", textAlign: "center", marginBottom: 12 },
  statsRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  statChip: { backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  statChipLabel: { fontSize: 10, color: Colors.muted, fontWeight: "500", marginBottom: 1 },
  statChipValue: { fontSize: 14, fontWeight: "700", color: "#FFF" },
  streakEmoji: { fontSize: 14, lineHeight: 16 },
  levelChip: { flex: 1, backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  levelText: { fontSize: 11, fontWeight: "700", color: Colors.gold, marginBottom: 4 },
  xpBar: { height: 3, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 2 },
  xpFill: { height: 3, backgroundColor: Colors.gold, borderRadius: 2 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, gap: 8 },
  greetingCard: { flexDirection: "row", alignItems: "flex-start", backgroundColor: Colors.card, borderRadius: 16, padding: 16, gap: 12, marginBottom: 4, shadowColor: Colors.navy, shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  budAvatar: { width: 40, height: 40, borderRadius: 20, overflow: "hidden", flexShrink: 0 },
  budAvatarGradient: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  budAvatarText: { fontSize: 20, fontWeight: "800", color: Colors.navy, lineHeight: 24 },
  greetingText: { flex: 1, fontSize: 14, color: Colors.navy, fontWeight: "500", lineHeight: 20 },
  whyCard: { flexDirection: "row", alignItems: "center", backgroundColor: Colors.navy, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12, gap: 10, marginBottom: 4 },
  whyEmoji: { fontSize: 22 },
  whyText: { flex: 1, fontSize: 13, color: "rgba(255,255,255,0.8)", fontWeight: "500", lineHeight: 18 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 12, marginBottom: 6 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: Colors.navy },
  sectionAction: { fontSize: 13, color: Colors.gold, fontWeight: "600" },
  spendingCard: { backgroundColor: Colors.card, borderRadius: 16, padding: 16, gap: 12, shadowColor: Colors.navy, shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  spendingRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  spendingAmount: { fontSize: 24, fontWeight: "800", color: Colors.navy },
  spendingLabel: { fontSize: 12, color: Colors.muted, marginTop: 2 },
  spendingStatus: { flexDirection: "row", alignItems: "center", gap: 6 },
  spendingDot: { width: 8, height: 8, borderRadius: 4 },
  spendingStatusText: { fontSize: 12, color: Colors.muted, fontWeight: "500" },
  spendingTrack: { height: 6, backgroundColor: Colors.border, borderRadius: 3 },
  spendingFill: { height: 6, borderRadius: 3 },
  insightCard: { backgroundColor: "rgba(244,168,50,0.08)", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "rgba(244,168,50,0.2)" },
  insightLabel: { fontSize: 13, color: Colors.gold, fontWeight: "700", marginBottom: 8 },
  insightText: { fontSize: 14, color: Colors.navyMuted, lineHeight: 20 },
  questsContainer: { gap: 10 },
  questCard: { backgroundColor: Colors.card, borderRadius: 16, padding: 16, gap: 8, shadowColor: Colors.navy, shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  questCardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  questTypeBadge: { backgroundColor: Colors.navy50, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  questTypeText: { fontSize: 11, color: Colors.navyMuted, fontWeight: "600" },
  questXP: { fontSize: 12, color: Colors.gold, fontWeight: "700" },
  questTitle: { fontSize: 15, fontWeight: "700", color: Colors.navy, lineHeight: 20 },
  questWhy: { fontSize: 12, color: Colors.muted, lineHeight: 17 },
  questProgress: { flexDirection: "row", alignItems: "center", gap: 8 },
  questTrack: { flex: 1, height: 4, backgroundColor: Colors.border, borderRadius: 2 },
  questFill: { height: 4, backgroundColor: Colors.gold, borderRadius: 2 },
  questPct: { fontSize: 12, color: Colors.muted, fontWeight: "600", minWidth: 32, textAlign: "right" },
  transactionsCard: { backgroundColor: Colors.card, borderRadius: 16, overflow: "hidden", shadowColor: Colors.navy, shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  txnRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14 },
  txnLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  txnIconWrap: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.surface, alignItems: "center", justifyContent: "center" },
  txnIcon: { fontSize: 16 },
  txnMerchant: { fontSize: 14, fontWeight: "600", color: Colors.navy },
  txnCategory: { fontSize: 12, color: Colors.muted, marginTop: 1 },
  txnAmount: { fontSize: 15, fontWeight: "700", color: Colors.navy },
  txnDivider: { height: 1, backgroundColor: Colors.border, marginHorizontal: 16 },
});

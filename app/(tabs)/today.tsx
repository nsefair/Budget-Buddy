/**
 * Today Tab — the daily emotional check-in.
 *
 * CEO pre-test notes: Today answers exactly one question - "How am I doing,
 * and what do I do right now?" Three elements, nothing else:
 *   1. Today's Insight from Bud as the hero
 *   2. Calm financial read (1-500 score, only on Today, secondary)
 *   3. One action for today (first open quest check-in, feeds the streak)
 *
 * Everything that used to live here moved out:
 *   Net worth / saving rate / transactions / bills -> Budget tab
 *   Level / XP / quest strip / league -> Quests tab
 */

import React, { useEffect, useRef, useState } from "react";
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
import { TAB_BAR_HEIGHT } from "@/constants/tokens";
import { useUser } from "@/hooks/useAuth";
import { BrandHeader, BrandLogo } from "@/components/BrandLogo";
import { Icon } from "@/components/Icon";
import { budGreeting, type BudInsight } from "@/mock/bud";
import { todayService } from "@/services/todayService";
import { secureLog } from "@/utils/security";
import { CountUp, FadeInUp } from "@/animations";
import {
  questCheckInMessage,
  useQuestDashboard,
} from "@/features/quests/useQuestDashboard";
import type { FinancialScore, Quest } from "@/features/quests/types";

const SCORE_MAX = 500;

export default function TodayScreen() {
  const insets = useSafeAreaInsets();
  const user = useUser();
  const {
    data: questDashboard,
    refetch: refetchQuests,
    checkIn,
    checkingIn,
  } = useQuestDashboard();

  const fade = useRef(new Animated.Value(0)).current;
  const lift = useRef(new Animated.Value(16)).current;

  const [insight, setInsight] = useState<BudInsight | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(lift, { toValue: 0, damping: 16, stiffness: 130, useNativeDriver: true }),
    ]).start();
  }, [fade, lift]);

  useEffect(() => {
    todayService
      .getInsight()
      .then(setInsight)
      .catch((error) => secureLog.warn("today.insight failed", error));
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        refetchQuests(),
        todayService
          .getInsight()
          .then(setInsight)
          .catch((error) => secureLog.warn("today.insight failed", error)),
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  if (!user) return null;

  const greeting = budGreeting(user.firstName, user.streak);
  const score: FinancialScore | null = questDashboard?.score ?? null;
  const scoreValue = score?.value ?? (user.financialHealthScore || 280);
  const nextAction =
    questDashboard?.quests.find(
      (quest) => quest.status === "active" && !quest.checkedInToday
    ) ?? null;
  const allDone = Boolean(questDashboard && !nextAction);

  const handleAction = async (quest: Quest) => {
    try {
      const result = await checkIn(quest.id);
      setActionNotice(null);
      if (result.quest.status === "completed") {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (error) {
      // The backend rejects check-ins it cannot verify against synced
      // transactions (e.g. a food charge on a no-dining-out day). Show why.
      secureLog.warn("today.action check-in failed", error);
      setActionNotice(questCheckInMessage(error));
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
  };

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
            </View>
          </LinearGradient>

          <View style={styles.bodyPadding}>
            {/* 1. Insight: Bud's hero moment */}
            <FadeInUp delay={60}>
              <InsightHero
                message={
                  insight?.message ??
                  "Bud is reading your latest activity. Today's insight lands in a moment."
                }
                scoreValue={scoreValue}
                band={score?.band}
                streak={user.streak}
                onAskBud={() => {
                  Haptics.selectionAsync();
                  router.push("/(tabs)/bud");
                }}
              />
            </FadeInUp>

            {/* 2. Action: one thing to do right now */}
            <FadeInUp delay={180}>
              <ActionCard
                quest={nextAction}
                allDone={allDone}
                streak={user.streak}
                busy={checkingIn}
                onDone={handleAction}
                onSeeQuests={() => {
                  Haptics.selectionAsync();
                  router.push("/(tabs)/quests");
                }}
              />
            </FadeInUp>

            {actionNotice ? (
              <FadeInUp>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Dismiss check-in message"
                  onPress={() => setActionNotice(null)}
                  style={styles.actionNotice}
                >
                  <Icon name="shield-check" size={18} color={Colors.amber} strokeWidth={2.4} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.actionNoticeTitle}>Bud couldn't verify that yet.</Text>
                    <Text style={styles.actionNoticeBody}>{actionNotice}</Text>
                  </View>
                  <Icon name="x" size={15} color={Colors.muted} />
                </Pressable>
              </FadeInUp>
            ) : null}
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

// ─── Today's insight hero ───────────────────────────────────────────────────

function scoreStatusFor(value: number, band?: FinancialScore["band"]) {
  if (band === "Exceptional" || band === "Thriving" || value >= 360) {
    return { label: "On track", color: Colors.gold };
  }
  if (band === "Strong" || value >= 270) {
    return { label: "Good base", color: Colors.gold };
  }
  if (band === "Steady" || value >= 180) {
    return { label: "Building", color: Colors.gold };
  }
  return { label: "Getting started", color: Colors.brandOnDarkMuted };
}

function InsightHero({
  message,
  scoreValue,
  band,
  streak,
  onAskBud,
}: {
  message: string;
  scoreValue: number;
  band?: FinancialScore["band"];
  streak: number;
  onAskBud: () => void;
}) {
  const status = scoreStatusFor(scoreValue, band);

  return (
    <LinearGradient
      colors={[Colors.brandGradientStart, Colors.brandGradientMid, Colors.brandGradientEnd]}
      style={styles.insightHero}
      accessibilityLabel={`Today's insight. ${message} Financial score ${scoreValue} out of ${SCORE_MAX}, ${status.label}.`}
    >
      <View style={styles.insightHeroGlow} />
      <View style={styles.insightHeroHeader}>
        <View style={styles.insightHeroEyebrowRow}>
          <Icon name="sparkles" size={15} color={Colors.gold} strokeWidth={2.6} />
          <Text style={styles.insightHeroEyebrow}>TODAY'S INSIGHT</Text>
        </View>
        <View style={styles.streakPill}>
          <Icon name="flame" size={14} color={Colors.gold} strokeWidth={2.4} />
          <Text style={styles.streakPillText}>
            {streak} day{streak === 1 ? "" : "s"}
          </Text>
        </View>
      </View>

      <Text style={styles.insightHeroText}>{message}</Text>

      <View style={styles.insightHeroFooter}>
        <View style={styles.scoreMini}>
          <Text style={styles.scoreMiniLabel}>Financial Score</Text>
          <View style={styles.scoreMiniRow}>
            <CountUp value={scoreValue} style={styles.scoreMiniValue} />
            <Text style={styles.scoreMiniMax}>/ {SCORE_MAX}</Text>
          </View>
          <View style={styles.scoreMiniStatus}>
            <View style={[styles.statusDot, { backgroundColor: status.color }]} />
            <Text style={[styles.scoreMiniStatusText, { color: status.color }]}>
              {status.label}
            </Text>
          </View>
        </View>
        <Pressable onPress={onAskBud} hitSlop={8} style={styles.insightAction}>
          <Text style={styles.insightActionText}>Ask Bud</Text>
          <Icon name="chevron-right" size={14} color={Colors.gold} strokeWidth={2.6} />
        </Pressable>
      </View>
    </LinearGradient>
  );
}

// ─── One action for today ────────────────────────────────────────────────────

function ActionCard({
  quest,
  allDone,
  streak,
  busy,
  onDone,
  onSeeQuests,
}: {
  quest: Quest | null;
  allDone: boolean;
  streak: number;
  busy: boolean;
  onDone: (quest: Quest) => void;
  onSeeQuests: () => void;
}) {
  if (allDone) {
    return (
      <View style={styles.actionCard}>
        <View style={[styles.actionCheck, styles.actionCheckDone]}>
          <Icon name="check" size={16} color={Colors.onAccent} strokeWidth={3} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.actionTitle}>You're done for today.</Text>
          <Text style={styles.actionSub}>
            Streak safe — day {streak + 1} starts tomorrow.
          </Text>
        </View>
      </View>
    );
  }

  if (!quest) {
    return (
      <Pressable onPress={onSeeQuests} style={({ pressed }) => [styles.actionCard, pressed && { opacity: 0.94 }]}>
        <View style={styles.actionCheck} />
        <View style={{ flex: 1 }}>
          <Text style={styles.actionTitle}>Pick this week's first move</Text>
          <Text style={styles.actionSub}>Your quests are waiting</Text>
        </View>
        <Icon name="chevron-right" size={18} color={Colors.muted} />
      </Pressable>
    );
  }

  return (
    <View style={styles.actionCard}>
      <View style={styles.actionCheck} />
      <Pressable onPress={onSeeQuests} style={{ flex: 1 }} hitSlop={4}>
        <Text style={styles.actionTitle} numberOfLines={2}>
          {quest.checkInLabel}
        </Text>
        <Text style={styles.actionSub}>
          {quest.title} · keeps your {streak}-day streak alive
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Check in: ${quest.checkInLabel}`}
        disabled={busy}
        onPress={() => onDone(quest)}
        style={({ pressed }) => [
          styles.actionButton,
          (pressed || busy) && { opacity: 0.8 },
        ]}
      >
        <Text style={styles.actionButtonText}>Done</Text>
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
    paddingTop: 12,
    gap: 14,
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

  // Insight hero
  insightHero: {
    minHeight: 292,
    borderRadius: 24,
    padding: 22,
    overflow: "hidden",
    shadowColor: Colors.navy,
    shadowOpacity: 0.14,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  insightHeroGlow: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: Colors.accentAlpha12,
    right: -92,
    top: -96,
  },
  insightHeroHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 22,
  },
  insightHeroEyebrowRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    flexShrink: 1,
  },
  insightHeroEyebrow: {
    fontSize: 11,
    fontWeight: "800",
    color: Colors.gold,
    letterSpacing: 1.6,
  },
  streakPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.09)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },
  streakPillText: {
    fontSize: 12,
    fontWeight: "800",
    color: Colors.brandOnDark,
  },
  insightHeroText: {
    fontSize: 26,
    fontWeight: "900",
    color: Colors.brandOnDark,
    lineHeight: 34,
  },
  insightHeroFooter: {
    marginTop: 24,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 14,
  },
  scoreMini: {
    flex: 1,
    minWidth: 0,
  },
  scoreMiniLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: Colors.brandOnDarkMuted,
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  scoreMiniRow: {
    marginTop: 3,
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
  },
  scoreMiniValue: {
    fontSize: 24,
    fontWeight: "900",
    color: Colors.brandOnDark,
  },
  scoreMiniMax: {
    fontSize: 13,
    fontWeight: "800",
    color: Colors.brandOnDarkMuted,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  scoreMiniStatus: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  scoreMiniStatusText: {
    fontSize: 12,
    fontWeight: "800",
  },
  insightAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    alignSelf: "auto",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: "rgba(255,255,255,0.09)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },
  insightActionText: {
    fontSize: 13,
    fontWeight: "800",
    color: Colors.gold,
  },

  // Action
  actionCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: Colors.card,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: Colors.navy,
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  // navy200 disappeared against the dark-mode card — navy300 reads in both.
  actionCheck: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: Colors.navy300,
  },
  actionNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: Colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.amber,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  actionNoticeTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: Colors.navy,
  },
  actionNoticeBody: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.navyMuted,
    marginTop: 2,
    lineHeight: 17,
  },
  actionCheckDone: {
    borderColor: Colors.gold,
    backgroundColor: Colors.gold,
    alignItems: "center",
    justifyContent: "center",
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: Colors.navy,
  },
  actionSub: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.muted,
    marginTop: 2,
  },
  actionButton: {
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 999,
    backgroundColor: Colors.gold,
    shadowColor: Colors.gold,
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: "800",
    color: Colors.onAccent,
  },
});

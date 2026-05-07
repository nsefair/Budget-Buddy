import React, { useState, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Animated,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Colors } from "@/constants/colors";
import { useUser } from "@/hooks/useAuth";
import {
  MOCK_QUESTS,
  MOCK_LEAGUE,
  MOCK_BADGES,
  Quest,
} from "@/mock/quests";
import * as Haptics from "expo-haptics";

const TAB_BAR_HEIGHT = 80;

type QuestsView = "quests" | "league" | "profile";

export default function QuestsScreen() {
  const insets = useSafeAreaInsets();
  const user = useUser();
  const [activeView, setActiveView] = useState<QuestsView>("quests");

  const shortTermQuests = MOCK_QUESTS.filter((q) => q.type === "short" && q.status === "active");
  const mediumQuests = MOCK_QUESTS.filter((q) => q.type === "medium" && q.status === "active");
  const longTermQuests = MOCK_QUESTS.filter((q) => q.type === "long" && q.status === "active");

  const earnedBadges = MOCK_BADGES.filter((b) => b.earned);
  const lockedBadges = MOCK_BADGES.filter((b) => !b.earned);

  const xpPercent = user ? Math.round((user.xp / user.xpToNextLevel) * 100) : 0;

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={["#0E1926", "#1B2B4B"]}
        style={[styles.header, { paddingTop: insets.top + 12 }]}
      >
        <Text style={styles.wordmark}>Budget Buddy</Text>

        {/* XP / Level strip */}
        <View style={styles.xpStrip}>
          <View style={styles.levelBadge}>
            <LinearGradient colors={[Colors.gold, "#E08A10"]} style={styles.levelBadgeGrad}>
              <Text style={styles.levelBadgeText}>Lv {user?.level}</Text>
            </LinearGradient>
          </View>
          <View style={styles.xpInfo}>
            <View style={styles.xpRow}>
              <Text style={styles.xpLabel}>{user?.xp.toLocaleString()} XP</Text>
              <Text style={styles.xpNext}>{user?.xpToNextLevel.toLocaleString()} to next level</Text>
            </View>
            <View style={styles.xpTrack}>
              <View style={[styles.xpFill, { width: `${xpPercent}%` }]} />
            </View>
          </View>
          <View style={styles.streakBadge}>
            <Text style={styles.streakFlame}>🔥</Text>
            <Text style={styles.streakDays}>{user?.streak}d</Text>
          </View>
        </View>

        {/* View switcher */}
        <View style={styles.viewSwitcher}>
          {(["quests", "league", "profile"] as QuestsView[]).map((v) => (
            <Pressable
              key={v}
              style={[styles.switchTab, activeView === v && styles.switchTabActive]}
              onPress={() => {
                Haptics.selectionAsync();
                setActiveView(v);
              }}
            >
              <Text style={[styles.switchText, activeView === v && styles.switchTextActive]}>
                {v === "quests" ? "Quests" : v === "league" ? "Wealth League" : "Profile"}
              </Text>
            </Pressable>
          ))}
        </View>
      </LinearGradient>

      {/* Content */}
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {activeView === "quests" && (
          <>
            {/* Short-term */}
            <QuestSection title="Short-Term" subtitle="Daily & weekly" quests={shortTermQuests} />
            {/* Medium */}
            <QuestSection title="Monthly" subtitle="This month" quests={mediumQuests} />
            {/* Long-term */}
            <QuestSection title="Long-Term" subtitle="Ongoing transformation" quests={longTermQuests} />
          </>
        )}

        {activeView === "league" && (
          <>
            <View style={styles.leagueTierCard}>
              <LinearGradient
                colors={["rgba(244,168,50,0.15)", "rgba(244,168,50,0.05)"]}
                style={styles.leagueTierGrad}
              >
                <Text style={styles.leagueTierEmoji}>🏆</Text>
                <Text style={styles.leagueTier}>{MOCK_LEAGUE.tier} League</Text>
                <Text style={styles.leagueReset}>
                  Resets {new Date(MOCK_LEAGUE.resetDate).toLocaleDateString("en-US", { weekday: "long" })}
                </Text>
                <View style={styles.leaguePromoZone}>
                  <Text style={styles.leaguePromoText}>🔼 Top 3 promoted to Platinum</Text>
                </View>
              </LinearGradient>
            </View>

            {/* Leaderboard */}
            <View style={styles.leaderboard}>
              {MOCK_LEAGUE.users.map((lu, idx) => (
                <View
                  key={lu.id}
                  style={[
                    styles.leaderboardRow,
                    lu.isCurrentUser && styles.leaderboardRowHighlight,
                    idx === 0 && styles.leaderboardFirst,
                    idx < 3 && !lu.isCurrentUser && styles.leaderboardPromo,
                  ]}
                >
                  <Text style={styles.leaderboardRank}>
                    {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `${idx + 1}`}
                  </Text>
                  <View style={styles.leaderboardAvatar}>
                    <Text style={styles.leaderboardInitial}>{lu.name[0]}</Text>
                  </View>
                  <View style={styles.leaderboardInfo}>
                    <Text style={[styles.leaderboardName, lu.isCurrentUser && { color: Colors.gold }]}>
                      {lu.name}{lu.isCurrentUser ? " (You)" : ""}
                    </Text>
                    <Text style={styles.leaderboardStreak}>🔥 {lu.streak}d · Lv {lu.level}</Text>
                  </View>
                  <Text style={styles.leaderboardXP}>{lu.xp.toLocaleString()} XP</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {activeView === "profile" && (
          <>
            {/* Skill Tree placeholder */}
            <View style={styles.skillTreeCard}>
              <Text style={styles.skillTreeTitle}>🌳 Skill Tree</Text>
              <Text style={styles.skillTreeSub}>
                Unlock financial skills across 5 branches: Spending, Saving, Debt, Income, and Wealth.
              </Text>
              <View style={styles.skillBranches}>
                {["💸 Spending Control", "💰 Saving Power", "⚔️ Debt Freedom", "📊 Income Awareness", "🏦 Wealth Building"].map((branch) => (
                  <View key={branch} style={styles.skillBranch}>
                    <Text style={styles.skillBranchText}>{branch}</Text>
                    <View style={styles.skillBranchBar}>
                      <View style={[styles.skillBranchFill, { width: `${Math.random() * 60 + 10}%` }]} />
                    </View>
                  </View>
                ))}
              </View>
              <Text style={styles.skillTreeComingSoon}>Full interactive tree — coming soon</Text>
            </View>

            {/* Badges */}
            <Text style={styles.badgesTitle}>Badges ({earnedBadges.length} earned)</Text>

            {/* Earned badges */}
            <View style={styles.badgeGrid}>
              {earnedBadges.map((badge) => (
                <View key={badge.id} style={styles.badgeCard}>
                  <Text style={styles.badgeIcon}>{badge.icon}</Text>
                  <Text style={styles.badgeName}>{badge.name}</Text>
                  <Text style={styles.badgeDate}>
                    {badge.earnedAt
                      ? new Date(badge.earnedAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })
                      : ""}
                  </Text>
                </View>
              ))}
              {lockedBadges.map((badge) => (
                <View key={badge.id} style={[styles.badgeCard, styles.badgeCardLocked]}>
                  <Text style={[styles.badgeIcon, { opacity: 0.3 }]}>{badge.icon}</Text>
                  <Text style={[styles.badgeName, { opacity: 0.4 }]}>{badge.name}</Text>
                  <Text style={[styles.badgeDate, { opacity: 0.4, textAlign: "center" }]} numberOfLines={2}>
                    {badge.requirement}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function QuestSection({ title, subtitle, quests }: { title: string; subtitle: string; quests: Quest[] }) {
  if (quests.length === 0) return null;
  return (
    <View style={styles.questSection}>
      <View style={styles.questSectionHeader}>
        <Text style={styles.questSectionTitle}>{title}</Text>
        <Text style={styles.questSectionSub}>{subtitle}</Text>
      </View>
      {quests.map((quest) => (
        <QuestCard key={quest.id} quest={quest} />
      ))}
    </View>
  );
}

function QuestCard({ quest }: { quest: Quest }) {
  const pct = Math.min((quest.progress / quest.total) * 100, 100);
  const scale = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.sequence([
      Animated.spring(scale, { toValue: 0.97, damping: 12, stiffness: 400, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, damping: 12, stiffness: 200, useNativeDriver: true }),
    ]).start();
  };

  return (
    <Pressable onPress={handlePress}>
      <Animated.View style={[styles.questCard, { transform: [{ scale }] }]}>
        <View style={styles.questCardTop}>
          <View>
            <Text style={styles.questTitle}>{quest.title}</Text>
            {quest.linkedGoalName && (
              <Text style={styles.questLinkedGoal}>→ {quest.linkedGoalName}</Text>
            )}
          </View>
          <View style={styles.questXPBadge}>
            <Text style={styles.questXPText}>+{quest.xpReward}</Text>
          </View>
        </View>
        <Text style={styles.questWhy}>{quest.whyItMatters}</Text>
        <View style={styles.questProgressRow}>
          <View style={styles.questTrack}>
            <View style={[styles.questFill, { width: `${pct}%` }]} />
          </View>
          <Text style={styles.questPct}>{Math.round(pct)}%</Text>
        </View>
        {quest.deadline && (
          <Text style={styles.questDeadline}>
            Due {new Date(quest.deadline).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </Text>
        )}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  header: { paddingHorizontal: 20, paddingBottom: 0 },
  wordmark: { fontSize: 13, fontWeight: "600", color: "rgba(255,255,255,0.4)", letterSpacing: 2, textTransform: "uppercase", textAlign: "center", marginBottom: 12 },
  xpStrip: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
  levelBadge: { borderRadius: 10, overflow: "hidden" },
  levelBadgeGrad: { paddingHorizontal: 12, paddingVertical: 6 },
  levelBadgeText: { fontSize: 13, fontWeight: "800", color: Colors.navy },
  xpInfo: { flex: 1, gap: 5 },
  xpRow: { flexDirection: "row", justifyContent: "space-between" },
  xpLabel: { fontSize: 12, color: "#FFF", fontWeight: "600" },
  xpNext: { fontSize: 11, color: Colors.muted },
  xpTrack: { height: 4, backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 2 },
  xpFill: { height: 4, backgroundColor: Colors.gold, borderRadius: 2 },
  streakBadge: { alignItems: "center" },
  streakFlame: { fontSize: 18 },
  streakDays: { fontSize: 11, color: Colors.gold, fontWeight: "700" },
  viewSwitcher: { flexDirection: "row", borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.08)" },
  switchTab: { flex: 1, paddingVertical: 12, alignItems: "center" },
  switchTabActive: { borderBottomWidth: 2, borderBottomColor: Colors.gold },
  switchText: { fontSize: 12, color: Colors.muted, fontWeight: "500" },
  switchTextActive: { color: Colors.gold, fontWeight: "700" },
  scrollContent: { paddingHorizontal: 20, paddingTop: 16, gap: 0 },
  questSection: { marginBottom: 20, gap: 10 },
  questSectionHeader: { flexDirection: "row", alignItems: "baseline", gap: 8, marginBottom: 4 },
  questSectionTitle: { fontSize: 16, fontWeight: "800", color: Colors.navy },
  questSectionSub: { fontSize: 12, color: Colors.muted },
  questCard: { backgroundColor: Colors.card, borderRadius: 16, padding: 16, gap: 10, shadowColor: Colors.navy, shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  questCardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  questTitle: { fontSize: 15, fontWeight: "700", color: Colors.navy, flex: 1, lineHeight: 20 },
  questLinkedGoal: { fontSize: 11, color: Colors.teal, fontWeight: "600", marginTop: 3 },
  questXPBadge: { backgroundColor: "rgba(244,168,50,0.12)", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, marginLeft: 8 },
  questXPText: { fontSize: 12, color: Colors.gold, fontWeight: "700" },
  questWhy: { fontSize: 12, color: Colors.muted, lineHeight: 17 },
  questProgressRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  questTrack: { flex: 1, height: 5, backgroundColor: Colors.border, borderRadius: 3 },
  questFill: { height: 5, backgroundColor: Colors.gold, borderRadius: 3 },
  questPct: { fontSize: 12, color: Colors.muted, fontWeight: "600", minWidth: 36, textAlign: "right" },
  questDeadline: { fontSize: 11, color: Colors.muted },
  // League
  leagueTierCard: { borderRadius: 16, overflow: "hidden", marginBottom: 16, borderWidth: 1, borderColor: "rgba(244,168,50,0.25)" },
  leagueTierGrad: { padding: 20, alignItems: "center", gap: 6 },
  leagueTierEmoji: { fontSize: 40 },
  leagueTier: { fontSize: 22, fontWeight: "800", color: "#FFF" },
  leagueReset: { fontSize: 13, color: Colors.muted },
  leaguePromoZone: { marginTop: 8, backgroundColor: "rgba(16,185,129,0.12)", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 5 },
  leaguePromoText: { fontSize: 12, color: Colors.emerald, fontWeight: "600" },
  leaderboard: { backgroundColor: Colors.card, borderRadius: 16, overflow: "hidden", shadowColor: Colors.navy, shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  leaderboardRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, gap: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  leaderboardRowHighlight: { backgroundColor: "rgba(244,168,50,0.07)" },
  leaderboardFirst: {},
  leaderboardPromo: {},
  leaderboardRank: { fontSize: 16, width: 28, textAlign: "center" },
  leaderboardAvatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: Colors.navy50, alignItems: "center", justifyContent: "center" },
  leaderboardInitial: { fontSize: 14, fontWeight: "700", color: Colors.navy },
  leaderboardInfo: { flex: 1 },
  leaderboardName: { fontSize: 14, fontWeight: "600", color: Colors.navy },
  leaderboardStreak: { fontSize: 11, color: Colors.muted, marginTop: 2 },
  leaderboardXP: { fontSize: 13, fontWeight: "700", color: Colors.gold },
  // Profile
  skillTreeCard: { backgroundColor: Colors.card, borderRadius: 16, padding: 18, gap: 12, shadowColor: Colors.navy, shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2, marginBottom: 20 },
  skillTreeTitle: { fontSize: 16, fontWeight: "800", color: Colors.navy },
  skillTreeSub: { fontSize: 13, color: Colors.muted, lineHeight: 18 },
  skillBranches: { gap: 10 },
  skillBranch: { gap: 5 },
  skillBranchText: { fontSize: 13, color: Colors.navyMuted, fontWeight: "600" },
  skillBranchBar: { height: 4, backgroundColor: Colors.border, borderRadius: 2 },
  skillBranchFill: { height: 4, backgroundColor: Colors.gold, borderRadius: 2 },
  skillTreeComingSoon: { fontSize: 12, color: Colors.muted, textAlign: "center" },
  badgesTitle: { fontSize: 16, fontWeight: "800", color: Colors.navy, marginBottom: 12 },
  badgeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  badgeCard: { width: "30%", backgroundColor: Colors.card, borderRadius: 14, padding: 12, alignItems: "center", gap: 6, shadowColor: Colors.navy, shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  badgeCardLocked: { backgroundColor: "rgba(255,255,255,0.5)", borderWidth: 1, borderColor: Colors.border, borderStyle: "dashed" },
  badgeIcon: { fontSize: 28 },
  badgeName: { fontSize: 11, fontWeight: "700", color: Colors.navy, textAlign: "center" },
  badgeDate: { fontSize: 10, color: Colors.muted, textAlign: "center" },
});

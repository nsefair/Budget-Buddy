import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { CountUp } from "@/animations";
import { Icon } from "@/components/Icon";
import { Colors } from "@/constants/colors";
import { Radius, Shadow, Spacing, Type } from "@/constants/tokens";
import type { League, LeagueUser } from "@/features/quests/types";

const TIER_STEPS: Array<{ name: League["tier"]; short: string; minimum: number }> = [
  { name: "Bronze", short: "B", minimum: 1 },
  { name: "Silver", short: "S", minimum: 135 },
  { name: "Gold", short: "G", minimum: 210 },
  { name: "Platinum", short: "P", minimum: 280 },
  { name: "Diamond", short: "D", minimum: 355 },
  { name: "Champion", short: "C", minimum: 425 },
];

export function WealthLeagueVisual({
  league,
  scoreValue,
  onPress,
  compact = false,
}: {
  league: League;
  scoreValue?: number;
  onPress?: () => void;
  compact?: boolean;
}) {
  const currentUser = league.users.find((user) => user.isCurrentUser);
  const currentScore = scoreValue ?? currentUser?.financialScore ?? 1;
  const tierIndex = Math.max(0, TIER_STEPS.findIndex((tier) => tier.name === league.tier));
  const podiumUsers = useMemo(() => podiumOrder(league.users.slice(0, 3)), [league.users]);

  if (compact) {
    return (
      <CompactLeague
        league={league}
        currentScore={currentScore}
        tierIndex={tierIndex}
        onPress={onPress}
      />
    );
  }

  return (
    <Pressable
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={onPress ? `Open ${league.tier} Wealth League standings` : undefined}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.wrapper, pressed && styles.pressed]}
    >
      <LinearGradient
        colors={[Colors.brandGradientStart, Colors.brandGradientMid, Colors.brandGradientEnd]}
        style={styles.card}
      >
        <View style={styles.glowLarge} />
        <View style={styles.glowSmall} />

        <View style={styles.header}>
          <View style={styles.titleRow}>
            <View style={styles.emblemOuter}>
              <View style={styles.emblemInner}>
                <Icon name="trophy" size={23} color={Colors.gold} strokeWidth={2.3} />
              </View>
            </View>
            <View>
              <Text style={styles.eyebrow}>WEALTH LEAGUE</Text>
              <Text style={styles.title}>{league.tier}</Text>
            </View>
          </View>
          <View style={styles.resetPill}>
            <Icon name="calendar" size={12} color={Colors.brandOnDarkMuted} />
            <Text style={styles.resetText}>{leagueResetLabel(league.resetDate)}</Text>
          </View>
        </View>

        <View style={styles.tierJourney}>
          <View style={styles.tierLine} />
          <View
            style={[
              styles.tierLineActive,
              { width: `${Math.max(3, (tierIndex / (TIER_STEPS.length - 1)) * 100)}%` },
            ]}
          />
          {TIER_STEPS.map((tier, index) => {
            const reached = index <= tierIndex;
            const current = index === tierIndex;
            return (
              <View key={tier.name} style={styles.tierStep}>
                <View
                  style={[
                    styles.tierDot,
                    reached && styles.tierDotReached,
                    current && styles.tierDotCurrent,
                  ]}
                >
                  <Text style={[styles.tierShort, reached && styles.tierShortReached]}>
                    {tier.short}
                  </Text>
                </View>
                <Text style={[styles.tierLabel, current && styles.tierLabelCurrent]}>
                  {tier.name === "Platinum" ? "Plat." : tier.name}
                </Text>
              </View>
            );
          })}
        </View>

        {podiumUsers.length > 0 ? (
          <View style={styles.podium}>
            {podiumUsers.map((user) => (
              <PodiumColumn key={user.id} user={user} />
            ))}
          </View>
        ) : (
          <View style={styles.emptyPodium}>
            <Icon name="users" size={22} color={Colors.gold} />
            <Text style={styles.emptyPodiumText}>Your league group is forming.</Text>
          </View>
        )}

        <View style={styles.standingCard}>
          <View>
            <Text style={styles.standingLabel}>YOUR STANDING</Text>
            <Text style={styles.standingRank}>
              {league.currentUserRank > 0 ? `#${league.currentUserRank}` : "Placing…"}
            </Text>
          </View>
          <View style={styles.standingDivider} />
          <View style={styles.standingScoreWrap}>
            <CountUp value={currentScore} style={styles.standingScore} />
            <Text style={styles.standingScoreLabel}>FINANCIAL SCORE</Text>
          </View>
          {onPress ? <Icon name="chevron-right" size={20} color={Colors.gold} /> : null}
        </View>
      </LinearGradient>
    </Pressable>
  );
}

function CompactLeague({
  league,
  currentScore,
  tierIndex,
  onPress,
}: {
  league: League;
  currentScore: number;
  tierIndex: number;
  onPress?: () => void;
}) {
  const currentTier = TIER_STEPS[tierIndex];
  const nextTier = TIER_STEPS[tierIndex + 1];
  const tierSpan = nextTier ? nextTier.minimum - currentTier.minimum : 1;
  const progress = nextTier
    ? Math.max(0.04, Math.min(1, (currentScore - currentTier.minimum) / tierSpan))
    : 1;

  return (
    <Pressable
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={onPress ? `Open ${league.tier} Wealth League standings` : undefined}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.compactWrapper, pressed && styles.pressed]}
    >
      <LinearGradient
        colors={[Colors.brandGradientStart, Colors.brandGradientMid]}
        style={styles.compactCard}
      >
        <View style={styles.compactEmblem}>
          <Icon name="trophy" size={20} color={Colors.gold} strokeWidth={2.3} />
        </View>
        <View style={styles.compactContent}>
          <View style={styles.compactTitleRow}>
            <Text style={styles.compactTitle}>Wealth League</Text>
            <Text style={styles.compactTier}>{league.tier}</Text>
          </View>
          <View style={styles.compactTrack}>
            <View style={[styles.compactFill, { width: `${progress * 100}%` }]} />
          </View>
          <Text style={styles.compactMeta}>
            {nextTier
              ? `${Math.max(0, nextTier.minimum - currentScore)} points to ${nextTier.name}`
              : `Champion · ${leagueResetLabel(league.resetDate)} to reset`}
          </Text>
        </View>
        {onPress ? <Icon name="chevron-right" size={19} color={Colors.brandOnDarkMuted} /> : null}
      </LinearGradient>
    </Pressable>
  );
}

function PodiumColumn({ user }: { user: LeagueUser }) {
  const place = user.rank ?? 1;
  const height = place === 1 ? 84 : place === 2 ? 66 : 54;
  return (
    <View style={styles.podiumColumn}>
      <View style={[styles.avatar, place === 1 && styles.avatarFirst]}>
        <Text style={[styles.avatarText, place === 1 && styles.avatarTextFirst]}>
          {user.name.trim().slice(0, 1).toUpperCase()}
        </Text>
      </View>
      <Text numberOfLines={1} style={styles.podiumName}>
        {user.isCurrentUser ? "You" : user.name}
      </Text>
      <Text style={styles.podiumScore}>{user.financialScore}</Text>
      <LinearGradient
        colors={place === 1 ? [Colors.gold400, Colors.gold600] : [Colors.navy200, Colors.navy300]}
        style={[styles.podiumBlock, { height }]}
      >
        <Text style={[styles.podiumPlace, place === 1 && styles.podiumPlaceFirst]}>{place}</Text>
      </LinearGradient>
    </View>
  );
}

function podiumOrder(users: LeagueUser[]) {
  if (users.length < 3) return users;
  return [users[1], users[0], users[2]];
}

export function leagueResetLabel(resetDate: string) {
  const remaining = Math.max(0, new Date(resetDate).getTime() - Date.now());
  const days = Math.floor(remaining / 86_400_000);
  const hours = Math.floor((remaining % 86_400_000) / 3_600_000);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h`;
  return "Soon";
}

const styles = StyleSheet.create({
  wrapper: { borderRadius: 24, ...Shadow.lg },
  pressed: { opacity: 0.92, transform: [{ scale: 0.992 }] },
  card: { borderRadius: 24, padding: Spacing.lg, overflow: "hidden", gap: 18 },
  glowLarge: { position: "absolute", width: 230, height: 230, borderRadius: 115, right: -85, top: -105, backgroundColor: Colors.accentAlpha12 },
  glowSmall: { position: "absolute", width: 150, height: 150, borderRadius: 75, left: -85, bottom: 30, backgroundColor: Colors.accentAlpha07 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 11 },
  emblemOuter: { width: 54, height: 54, borderRadius: 27, borderWidth: 1, borderColor: Colors.accentAlpha35, alignItems: "center", justifyContent: "center", backgroundColor: Colors.accentAlpha07 },
  emblemInner: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.accentAlpha15, alignItems: "center", justifyContent: "center" },
  eyebrow: { ...Type.micro, color: Colors.gold, letterSpacing: 1.3 },
  title: { fontSize: 24, fontWeight: "900", color: Colors.brandOnDark, marginTop: 2 },
  resetPill: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 9, paddingVertical: 7, borderRadius: Radius.pill, backgroundColor: "rgba(255,255,255,0.08)" },
  resetText: { ...Type.micro, color: Colors.brandOnDarkMuted },
  tierJourney: { minHeight: 48, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", position: "relative" },
  tierLine: { position: "absolute", left: 14, right: 14, top: 13, height: 3, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.10)" },
  tierLineActive: { position: "absolute", left: 14, top: 13, height: 3, borderRadius: 2, backgroundColor: Colors.gold },
  tierStep: { width: 42, alignItems: "center", gap: 5 },
  tierDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.navy700, borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center" },
  tierDotReached: { backgroundColor: Colors.gold100, borderColor: Colors.gold },
  tierDotCurrent: { transform: [{ scale: 1.13 }], shadowColor: Colors.gold, shadowOpacity: 0.45, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } },
  tierShort: { fontSize: 9, fontWeight: "900", color: Colors.brandOnDarkMuted },
  tierShortReached: { color: Colors.gold },
  tierLabel: { fontSize: 7, fontWeight: "700", color: Colors.brandOnDarkMuted },
  tierLabelCurrent: { color: Colors.gold },
  podium: { minHeight: 150, flexDirection: "row", alignItems: "flex-end", justifyContent: "center", gap: 8, paddingTop: 4 },
  podiumColumn: { width: "29%", alignItems: "center" },
  avatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: Colors.navy200, borderWidth: 2, borderColor: Colors.navy300, alignItems: "center", justifyContent: "center" },
  avatarFirst: { width: 42, height: 42, borderRadius: 21, backgroundColor: Colors.gold100, borderColor: Colors.gold },
  avatarText: { ...Type.caption, color: Colors.navy700 },
  avatarTextFirst: { ...Type.bodyStrong, color: Colors.gold600 },
  podiumName: { ...Type.caption, color: Colors.brandOnDark, marginTop: 5, maxWidth: "100%" },
  podiumScore: { ...Type.micro, color: Colors.brandOnDarkMuted, marginTop: 1, marginBottom: 6 },
  podiumBlock: { width: "100%", borderTopLeftRadius: 12, borderTopRightRadius: 12, alignItems: "center", justifyContent: "center" },
  podiumPlace: { fontSize: 22, fontWeight: "900", color: Colors.navy700 },
  podiumPlaceFirst: { color: Colors.onAccent },
  emptyPodium: { minHeight: 120, borderRadius: Radius.lg, alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "rgba(255,255,255,0.05)" },
  emptyPodiumText: { ...Type.caption, color: Colors.brandOnDarkMuted },
  standingCard: { minHeight: 62, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, borderRadius: Radius.lg, backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: "rgba(255,255,255,0.10)" },
  standingLabel: { ...Type.micro, color: Colors.brandOnDarkMuted },
  standingRank: { ...Type.h2, color: Colors.brandOnDark, marginTop: 1 },
  standingDivider: { width: 1, height: 34, backgroundColor: "rgba(255,255,255,0.12)" },
  standingScoreWrap: { flex: 1 },
  standingScore: { fontSize: 20, fontWeight: "900", color: Colors.gold },
  standingScoreLabel: { fontSize: 8, fontWeight: "800", color: Colors.brandOnDarkMuted, letterSpacing: 0.8 },
  compactWrapper: { borderRadius: Radius.xl, ...Shadow.md },
  compactCard: {
    minHeight: 104,
    borderRadius: Radius.xl,
    padding: Spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.accentAlpha20,
  },
  compactEmblem: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.accentAlpha12,
    borderWidth: 1,
    borderColor: Colors.accentAlpha30,
  },
  compactContent: { flex: 1, minWidth: 0, gap: 8 },
  compactTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  compactTitle: { ...Type.h3, color: Colors.brandOnDark },
  compactTier: { ...Type.caption, color: Colors.gold, fontWeight: "800" },
  compactTrack: { height: 6, borderRadius: 3, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.12)" },
  compactFill: { height: 6, borderRadius: 3, backgroundColor: Colors.gold },
  compactMeta: { ...Type.micro, color: Colors.brandOnDarkMuted, letterSpacing: 0.2 },
});

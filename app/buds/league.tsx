import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

import { Colors } from "@/constants/colors";
import { BrandHeader } from "@/components/BrandLogo";
import { Icon } from "@/components/Icon";
import type { League, LeagueUser } from "@/mock/quests";
import { budsService } from "@/services/budsService";
import { WealthLeagueVisual } from "@/features/quests/WealthLeagueVisual";

export default function WealthLeagueScreen() {
  const insets = useSafeAreaInsets();
  const [league, setLeague] = useState<League | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const next = await budsService.getLeague();
        if (alive) setLeague(next);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const maxScore = useMemo(() => {
    if (!league) return 1;
    return Math.max(1, ...league.users.map((user) => user.financialScore));
  }, [league]);

  const currentUser = league?.users.find((user) => user.isCurrentUser);
  const resetCopy = league ? leagueResetCopy(league.resetDate) : "";

  return (
    <View style={styles.container}>
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={goBack} hitSlop={10} style={styles.iconBtn}>
          <Icon name="arrow-left" size={18} color={Colors.navy} strokeWidth={2.4} />
        </Pressable>
        <BrandHeader style={styles.brandHeader} />
        <View style={styles.iconBtnGhost} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.accent} />
          <Text style={styles.loadingText}>Loading Wealth League...</Text>
        </View>
      ) : null}

      {!loading && league ? (
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingBottom: insets.bottom + 32 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <WealthLeagueVisual
            league={league}
            scoreValue={currentUser?.financialScore}
          />

          <View style={styles.privacyCard}>
            <Icon name="lock" size={15} color={Colors.emerald} />
            <Text style={styles.privacyText}>
              Rankings use Financial Score. Balances, budgets, and purchase details stay private.
            </Text>
          </View>

          <View style={styles.zoneCard}>
            <View style={styles.zoneRow}>
              <Icon name="arrow-up-right" size={15} color={Colors.emerald} strokeWidth={2.4} />
              <Text style={styles.zoneText}>Ranks 1-3 advance at reset.</Text>
            </View>
            <View style={styles.zoneRow}>
              <Icon name="arrow-down-right" size={15} color={Colors.coral} strokeWidth={2.4} />
              <Text style={styles.zoneText}>Bottom ranks are the demotion zone.</Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Leaderboard</Text>
          <View style={styles.list}>
            {league.users.map((user, index) => (
              <LeagueRow
                key={user.id}
                user={user}
                rank={index + 1}
                maxScore={maxScore}
                total={league.users.length}
              />
            ))}
          </View>
        </ScrollView>
      ) : null}
    </View>
  );
}

function LeagueRow({
  user,
  rank,
  maxScore,
  total,
}: {
  user: LeagueUser;
  rank: number;
  maxScore: number;
  total: number;
}) {
  const ratio = Math.max(6, Math.min(100, (user.financialScore / maxScore) * 100));
  const advance = rank <= 3;
  const demotion = rank > Math.max(3, total - 2);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.row,
        user.isCurrentUser && styles.rowCurrent,
        pressed && styles.rowPressed,
      ]}
      onPress={() => {
        Haptics.selectionAsync();
        if (user.isCurrentUser) {
          router.push("/profile");
        } else {
          router.push(`/buds/profile/${user.id}`);
        }
      }}
    >
      <View style={[styles.rankBox, advance && styles.rankBoxAdvance, demotion && styles.rankBoxDemotion]}>
        <Text style={[styles.rankText, advance && styles.rankTextAdvance, demotion && styles.rankTextDemotion]}>
          {rank}
        </Text>
      </View>
      <View style={styles.personWrap}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {user.isCurrentUser ? "You" : user.name}
          </Text>
          <View style={styles.levelPill}>
            <Text style={styles.levelText}>Lv {user.level}</Text>
          </View>
          {advance ? <ZonePill label="Advance" tint={Colors.emerald} /> : null}
          {demotion ? <ZonePill label="At risk" tint={Colors.coral} /> : null}
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${ratio}%` }]} />
        </View>
      </View>
      <View style={styles.xpWrap}>
        <Text style={styles.xp}>{user.financialScore.toLocaleString()}</Text>
        <Text style={styles.xpLabel}>SCORE</Text>
      </View>
    </Pressable>
  );
}

function ZonePill({ label, tint }: { label: string; tint: string }) {
  return (
    <View style={[styles.zonePill, { backgroundColor: `${tint}1A` }]}>
      <Text style={[styles.zonePillText, { color: tint }]}>{label}</Text>
    </View>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryCard}>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function leagueResetCopy(resetDate?: string) {
  const resetAt = resetDate ? new Date(resetDate).getTime() : NaN;
  if (Number.isFinite(resetAt)) {
    const diffMs = resetAt - Date.now();
    const days = Math.max(0, Math.floor(diffMs / 86_400_000));
    const hours = Math.max(0, Math.ceil((diffMs % 86_400_000) / 3_600_000));
    if (days <= 0) return `${hours || 1}h`;
    return `${days}d ${hours}h`;
  }
  return "Monday";
}

function goBack() {
  Haptics.selectionAsync();
  router.back();
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  loadingText: { fontSize: 13, fontWeight: "700", color: Colors.navyMuted },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  brandHeader: { marginBottom: 0 },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.navy50,
  },
  iconBtnGhost: { width: 38, height: 38 },
  scroll: { paddingHorizontal: 20, paddingTop: 8 },
  privacyCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
    marginBottom: 14,
    paddingHorizontal: 13,
    paddingVertical: 11,
    borderRadius: 14,
    backgroundColor: Colors.greenSurface,
    borderWidth: 1,
    borderColor: Colors.greenBorder,
  },
  privacyText: { flex: 1, fontSize: 11, lineHeight: 16, fontWeight: "700", color: Colors.navyMuted },
  hero: { alignItems: "center", paddingVertical: 16 },
  heroIcon: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.greenSurface,
    borderWidth: 1,
    borderColor: Colors.greenBorder,
    marginBottom: 12,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: "900",
    color: Colors.accent,
    letterSpacing: 1.3,
    marginBottom: 7,
  },
  title: { fontSize: 26, fontWeight: "900", color: Colors.navy, letterSpacing: 0 },
  subtitle: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: "600",
    color: Colors.navyMuted,
    textAlign: "center",
    lineHeight: 19,
  },
  summaryGrid: { flexDirection: "row", gap: 10, marginBottom: 14 },
  summaryCard: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 15,
    borderRadius: 17,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  summaryValue: { fontSize: 17, fontWeight: "900", color: Colors.navy },
  summaryLabel: { marginTop: 4, fontSize: 11, fontWeight: "800", color: Colors.muted },
  zoneCard: {
    gap: 9,
    padding: 14,
    borderRadius: 16,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 18,
  },
  zoneRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  zoneText: { flex: 1, fontSize: 12, fontWeight: "700", color: Colors.navyMuted },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "900",
    color: Colors.muted,
    letterSpacing: 1.1,
    marginLeft: 3,
    marginBottom: 10,
  },
  list: { gap: 10 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    minHeight: 76,
    borderRadius: 16,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  rowCurrent: { backgroundColor: Colors.greenSurface, borderColor: Colors.accentAlpha45 },
  rowPressed: { transform: [{ scale: 0.99 }], opacity: 0.94 },
  rankBox: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.navy50,
  },
  rankBoxAdvance: { backgroundColor: "rgba(16,185,129,0.14)" },
  rankBoxDemotion: { backgroundColor: "rgba(239,68,68,0.12)" },
  rankText: { fontSize: 13, fontWeight: "900", color: Colors.navy },
  rankTextAdvance: { color: Colors.emerald },
  rankTextDemotion: { color: Colors.coral },
  personWrap: { flex: 1, minWidth: 0, gap: 8 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  name: { flexShrink: 1, fontSize: 14, fontWeight: "900", color: Colors.navy },
  levelPill: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: Colors.navy50,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  levelText: { fontSize: 9, fontWeight: "900", color: Colors.navyMuted },
  zonePill: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 999 },
  zonePillText: { fontSize: 9, fontWeight: "900" },
  progressTrack: {
    height: 6,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: Colors.border,
  },
  progressFill: { height: 6, borderRadius: 999, backgroundColor: Colors.accent },
  xpWrap: { alignItems: "flex-end", minWidth: 60 },
  xp: { fontSize: 13, fontWeight: "900", color: Colors.navy },
  xpLabel: { fontSize: 9, fontWeight: "900", color: Colors.muted, letterSpacing: 0.7 },
});

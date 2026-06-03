import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

import { Colors } from "@/constants/colors";
import { BrandHeader } from "@/components/BrandLogo";
import { Icon } from "@/components/Icon";
import type { BudProfile, FeedPost } from "@/mock/buds";
import { budsService } from "@/services/budsService";

export default function PublicBudProfileScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [profile, setProfile] = useState<BudProfile | null>(null);
  const [recentWins, setRecentWins] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSavingFollow, setIsSavingFollow] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [nextProfile, feed] = await Promise.all([
          budsService.getProfile(String(id)),
          budsService.getFeed(),
        ]);
        if (!alive) return;
        setProfile(nextProfile);
        setRecentWins(feed.filter((post) => post.user.id === String(id)).slice(0, 6));
      } catch {
        if (alive) setProfile(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  const followLabel = profile?.isFollowing ? "Following" : "Follow";

  const toggleFollow = async () => {
    if (!profile || isSavingFollow) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const nextFollowing = !profile.isFollowing;
    const previous = profile;
    setProfile({ ...profile, isFollowing: nextFollowing });
    setIsSavingFollow(true);
    try {
      if (nextFollowing) {
        await budsService.follow(profile.id);
      } else {
        await budsService.unfollow(profile.id);
      }
    } catch {
      setProfile(previous);
      Alert.alert("Could not update Bud", "Try again in a moment.");
    } finally {
      setIsSavingFollow(false);
    }
  };

  const reportOrBlock = () => {
    if (!profile) return;
    Alert.alert(
      "Bud safety",
      "Reports help keep Buds focused on encouragement. Blocking removes this person from your feed and suggestions.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: `Block ${profile.displayName}`,
          style: "destructive",
          onPress: async () => {
            try {
              await budsService.block(profile.id);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              router.back();
            } catch {
              Alert.alert("Could not block Bud", "Try again in a moment.");
            }
          },
        },
        {
          text: "Report profile",
          style: "destructive",
          onPress: async () => {
            try {
              await budsService.report(profile.id, {
                reason: "unsafe_social_profile",
              });
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert("Report sent", "Thanks for helping keep Buds clean.");
            } catch {
              Alert.alert("Could not report profile", "Try again in a moment.");
            }
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color={Colors.accent} />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top }]}>
        <Text style={styles.missingTitle}>Bud not found</Text>
        <Text style={styles.missingBody}>
          This profile may be private, blocked, or no longer active.
        </Text>
        <Pressable onPress={goBack} style={styles.primaryBtn}>
          <Text style={styles.primaryBtnText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={goBack} hitSlop={10} style={styles.iconBtn}>
          <Icon name="arrow-left" size={18} color={Colors.navy} strokeWidth={2.4} />
        </Pressable>
        <BrandHeader style={styles.brandHeader} />
        <Pressable onPress={reportOrBlock} hitSlop={10} style={styles.iconBtn}>
          <Icon name="shield" size={17} color={Colors.navy} strokeWidth={2.4} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + 32 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{profile.initials}</Text>
          </View>
          <Text style={styles.name}>{profile.displayName}</Text>
          <View style={styles.badgesRow}>
            <Chip icon="star" label={`Level ${profile.level}`} />
            <Chip icon="trophy" label={profile.leagueTier} />
          </View>
          <Pressable
            disabled={isSavingFollow}
            style={[
              styles.followBtn,
              profile.isFollowing && styles.followBtnActive,
              isSavingFollow && { opacity: 0.7 },
            ]}
            onPress={toggleFollow}
          >
            <Text
              style={[
                styles.followBtnText,
                profile.isFollowing && styles.followBtnTextActive,
              ]}
            >
              {followLabel}
            </Text>
          </Pressable>
        </View>

        <View style={styles.privacyNote}>
          <Icon name="lock" size={14} color={Colors.emerald} strokeWidth={2.4} />
          <Text style={styles.privacyText}>
            Public Bud profiles show effort signals only. No balances, budgets,
            transactions, income, or debt.
          </Text>
        </View>

        <View style={styles.statsGrid}>
          <Stat label="Streak" value={`${profile.streak}d`} icon="flame" />
          <Stat label="Badges" value={String(profile.badgeCount)} icon="badge-check" />
          <Stat
            label="Buds"
            value={String(profile.followerCount ?? 0)}
            icon="users"
          />
          <Stat
            label="Health"
            value={profile.financialHealthScore ? String(profile.financialHealthScore) : "--"}
            icon="shield-check"
          />
        </View>

        <SectionTitle title="Recent wins" />
        {recentWins.length === 0 ? (
          <View style={styles.emptyCard}>
            <Icon name="sparkles" size={18} color={Colors.accent} strokeWidth={2.4} />
            <Text style={styles.emptyTitle}>No public wins yet</Text>
            <Text style={styles.emptyBody}>
              When this Bud shares milestones, they will show up here.
            </Text>
          </View>
        ) : (
          <View style={styles.stack}>
            {recentWins.map((post) => (
              <WinRow key={post.id} post={post} />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function WinRow({ post }: { post: FeedPost }) {
  const ago = useMemo(() => timeAgo(post.timestamp), [post.timestamp]);
  return (
    <View style={styles.winRow}>
      <View style={styles.winIcon}>
        <Icon name={iconForPost(post.type)} size={16} color={Colors.accent} strokeWidth={2.4} />
      </View>
      <View style={styles.winTextWrap}>
        <Text style={styles.winTitle}>{post.title}</Text>
        <Text style={styles.winBody}>{post.message}</Text>
        <Text style={styles.winMeta}>{ago} - {post.fistBumps} Fist Bumps</Text>
      </View>
    </View>
  );
}

function Chip({ icon, label }: { icon: "star" | "trophy"; label: string }) {
  return (
    <View style={styles.chip}>
      <Icon name={icon} size={12} color={Colors.accent} strokeWidth={2.5} />
      <Text style={styles.chipText}>{label}</Text>
    </View>
  );
}

function Stat({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: "flame" | "badge-check" | "users" | "shield-check";
}) {
  return (
    <View style={styles.statCard}>
      <Icon name={icon} size={17} color={Colors.accent} strokeWidth={2.4} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function SectionTitle({ title }: { title: string }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

function iconForPost(type: FeedPost["type"]) {
  if (type === "level_up") return "star";
  if (type === "streak_milestone") return "flame";
  if (type === "badge_earned") return "badge-check";
  if (type === "week_review") return "message-circle";
  return "target";
}

function timeAgo(date: string) {
  const diff = Math.max(0, (Date.now() - new Date(date).getTime()) / 1000 / 60);
  if (diff < 60) return `${Math.max(1, Math.round(diff))}m ago`;
  if (diff < 1440) return `${Math.round(diff / 60)}h ago`;
  return `${Math.round(diff / 1440)}d ago`;
}

function goBack() {
  Haptics.selectionAsync();
  router.back();
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 24,
  },
  missingTitle: { fontSize: 18, fontWeight: "900", color: Colors.navy },
  missingBody: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.navyMuted,
    lineHeight: 19,
    textAlign: "center",
  },
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
  scroll: { paddingHorizontal: 20, paddingTop: 10 },
  hero: { alignItems: "center", paddingVertical: 14, gap: 12 },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.accent,
    shadowColor: Colors.accent,
    shadowOpacity: 0.28,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  avatarText: { fontSize: 29, fontWeight: "900", color: Colors.onAccent },
  name: { fontSize: 23, fontWeight: "900", color: Colors.navy, letterSpacing: 0 },
  badgesRow: { flexDirection: "row", gap: 8, flexWrap: "wrap", justifyContent: "center" },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: Colors.greenSurface,
    borderWidth: 1,
    borderColor: Colors.greenBorder,
  },
  chipText: { fontSize: 12, fontWeight: "900", color: Colors.accent },
  followBtn: {
    minWidth: 150,
    alignItems: "center",
    paddingVertical: 13,
    paddingHorizontal: 22,
    borderRadius: 999,
    backgroundColor: Colors.accent,
  },
  followBtnActive: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.accentAlpha40,
  },
  followBtnText: { fontSize: 15, fontWeight: "900", color: Colors.onAccent },
  followBtnTextActive: { color: Colors.accent },
  primaryBtn: {
    paddingHorizontal: 22,
    paddingVertical: 13,
    borderRadius: 999,
    backgroundColor: Colors.accent,
  },
  primaryBtnText: { fontSize: 14, fontWeight: "900", color: Colors.onAccent },
  privacyNote: {
    flexDirection: "row",
    gap: 9,
    alignItems: "flex-start",
    padding: 13,
    borderRadius: 15,
    backgroundColor: "rgba(16,185,129,0.08)",
    borderWidth: 1,
    borderColor: "rgba(16,185,129,0.16)",
    marginTop: 4,
    marginBottom: 14,
  },
  privacyText: {
    flex: 1,
    fontSize: 12,
    fontWeight: "700",
    color: Colors.emerald,
    lineHeight: 18,
  },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 20 },
  statCard: {
    width: "47.8%",
    alignItems: "center",
    paddingVertical: 16,
    borderRadius: 17,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 6,
  },
  statValue: { fontSize: 20, fontWeight: "900", color: Colors.navy },
  statLabel: { fontSize: 11, fontWeight: "800", color: Colors.muted },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "900",
    color: Colors.muted,
    letterSpacing: 1.1,
    marginBottom: 10,
    marginLeft: 3,
  },
  stack: { gap: 10 },
  emptyCard: {
    alignItems: "center",
    gap: 8,
    padding: 18,
    borderRadius: 17,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  emptyTitle: { fontSize: 15, fontWeight: "900", color: Colors.navy },
  emptyBody: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.navyMuted,
    lineHeight: 18,
    textAlign: "center",
  },
  winRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 14,
    borderRadius: 16,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  winIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.greenSurface,
    borderWidth: 1,
    borderColor: Colors.greenBorder,
  },
  winTextWrap: { flex: 1, minWidth: 0 },
  winTitle: { fontSize: 14, fontWeight: "900", color: Colors.navy },
  winBody: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: "600",
    color: Colors.navyMuted,
    lineHeight: 18,
  },
  winMeta: { marginTop: 7, fontSize: 11, fontWeight: "800", color: Colors.muted },
});

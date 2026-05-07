import React, { useState, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  TextInput,
  Animated,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Colors } from "@/constants/colors";
import { useUser } from "@/hooks/useAuth";
import {
  MOCK_FEED,
  MOCK_BUDS_PROFILES,
  SUGGESTED_BUDS,
  FeedPost,
  BudProfile,
} from "@/mock/buds";
import * as Haptics from "expo-haptics";

const TAB_BAR_HEIGHT = 80;

type BudsView = "feed" | "my-buds" | "discover";

export default function BudsScreen() {
  const insets = useSafeAreaInsets();
  const user = useUser();
  const [activeView, setActiveView] = useState<BudsView>("feed");
  const [feed, setFeed] = useState(MOCK_FEED);
  const [searchQuery, setSearchQuery] = useState("");

  const followingCount = MOCK_BUDS_PROFILES.filter((b) => b.isFollowing).length;

  const handleFistBump = (postId: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setFeed((prev) =>
      prev.map((post) =>
        post.id === postId
          ? {
              ...post,
              hasFistBumped: !post.hasFistBumped,
              fistBumps: post.hasFistBumped ? post.fistBumps - 1 : post.fistBumps + 1,
            }
          : post
      )
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={["#0E1926", "#1B2B4B"]}
        style={[styles.header, { paddingTop: insets.top + 12 }]}
      >
        <Text style={styles.wordmark}>Budget Buddy</Text>

        {/* My profile strip */}
        <View style={styles.profileStrip}>
          <View style={styles.myAvatar}>
            <LinearGradient colors={[Colors.gold, "#E08A10"]} style={styles.myAvatarGrad}>
              <Text style={styles.myAvatarInitial}>
                {user?.firstName[0] ?? "M"}
              </Text>
            </LinearGradient>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{user?.firstName} {user?.lastName}</Text>
            <View style={styles.profileStats}>
              <View style={styles.profileStat}>
                <Text style={styles.profileStatValue}>{followingCount}</Text>
                <Text style={styles.profileStatLabel}>Buds</Text>
              </View>
              <View style={styles.profileStatDivider} />
              <View style={styles.profileStat}>
                <Text style={styles.profileStatValue}>{user?.streak}🔥</Text>
                <Text style={styles.profileStatLabel}>Streak</Text>
              </View>
              <View style={styles.profileStatDivider} />
              <View style={styles.profileStat}>
                <Text style={styles.profileStatValue}>Lv {user?.level}</Text>
                <Text style={styles.profileStatLabel}>Level</Text>
              </View>
            </View>
          </View>
          <Pressable style={styles.inviteButton}>
            <Text style={styles.inviteText}>Invite</Text>
          </Pressable>
        </View>

        {/* View switcher */}
        <View style={styles.viewSwitcher}>
          {(["feed", "my-buds", "discover"] as BudsView[]).map((v) => (
            <Pressable
              key={v}
              style={[styles.switchTab, activeView === v && styles.switchTabActive]}
              onPress={() => {
                Haptics.selectionAsync();
                setActiveView(v);
              }}
            >
              <Text style={[styles.switchText, activeView === v && styles.switchTextActive]}>
                {v === "feed" ? "Feed" : v === "my-buds" ? "My Buds" : "Discover"}
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
        {activeView === "feed" && (
          <>
            {/* Privacy note */}
            <View style={styles.privacyNote}>
              <Text style={styles.privacyText}>
                🔒 No financial data is ever shared. Only progress, milestones, and wins.
              </Text>
            </View>

            {feed.map((post) => (
              <FeedCard key={post.id} post={post} onFistBump={handleFistBump} />
            ))}
          </>
        )}

        {activeView === "my-buds" && (
          <>
            <Text style={styles.budsCount}>{followingCount} people you follow</Text>
            {MOCK_BUDS_PROFILES.filter((b) => b.isFollowing).map((bud) => (
              <BudCard key={bud.id} bud={bud} />
            ))}
          </>
        )}

        {activeView === "discover" && (
          <>
            {/* Search */}
            <View style={styles.searchContainer}>
              <TextInput
                style={styles.searchInput}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search by username..."
                placeholderTextColor={Colors.muted}
              />
            </View>

            <Text style={styles.discoverSectionTitle}>Suggested for you</Text>
            <Text style={styles.discoverSectionSub}>
              Based on similar goals and activity patterns
            </Text>

            {SUGGESTED_BUDS.map((bud) => (
              <BudCard key={bud.id} bud={bud} showFollow />
            ))}

            {/* Phase 2 teaser */}
            <View style={styles.phase2Card}>
              <Text style={styles.phase2Title}>🌐 Community Feed</Text>
              <Text style={styles.phase2Sub}>
                A curated feed of financial wins and community highlights activates at 5,000 users. 
                Help us get there — invite your people.
              </Text>
              <Pressable style={styles.phase2Cta}>
                <LinearGradient colors={[Colors.gold, "#E08A10"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.phase2CtaGrad}>
                  <Text style={styles.phase2CtaText}>Invite a Bud</Text>
                </LinearGradient>
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function FeedCard({ post, onFistBump }: { post: FeedPost; onFistBump: (id: string) => void }) {
  const scale = useRef(new Animated.Value(1)).current;

  const handleBump = () => {
    Animated.sequence([
      Animated.spring(scale, { toValue: 1.2, damping: 10, stiffness: 400, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, damping: 12, stiffness: 200, useNativeDriver: true }),
    ]).start();
    onFistBump(post.id);
  };

  const timeAgo = (date: string) => {
    const diff = (Date.now() - new Date(date).getTime()) / 1000 / 60;
    if (diff < 60) return `${Math.round(diff)}m ago`;
    if (diff < 1440) return `${Math.round(diff / 60)}h ago`;
    return `${Math.round(diff / 1440)}d ago`;
  };

  return (
    <View style={styles.feedCard}>
      <View style={styles.feedCardHeader}>
        <View style={styles.feedAvatar}>
          <Text style={styles.feedAvatarText}>{post.user.initials}</Text>
        </View>
        <View style={styles.feedUserInfo}>
          <View style={styles.feedNameRow}>
            <Text style={styles.feedName}>{post.user.displayName}</Text>
            <View style={styles.feedLevelBadge}>
              <Text style={styles.feedLevelText}>Lv {post.user.level}</Text>
            </View>
          </View>
          <Text style={styles.feedStreak}>🔥 {post.user.streak}-day streak · {post.user.leagueTier}</Text>
        </View>
        <Text style={styles.feedTime}>{timeAgo(post.timestamp)}</Text>
      </View>

      <View style={styles.feedContent}>
        <Text style={styles.feedTitle}>{post.title}</Text>
        <Text style={styles.feedMessage}>{post.message}</Text>
      </View>

      <View style={styles.feedFooter}>
        <Pressable style={styles.fistBumpButton} onPress={handleBump}>
          <Animated.Text style={[styles.fistBumpEmoji, { transform: [{ scale }] }]}>
            {post.hasFistBumped ? "🤜" : "✊"}
          </Animated.Text>
          <Text style={[styles.fistBumpCount, post.hasFistBumped && styles.fistBumpCountActive]}>
            {post.fistBumps}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function BudCard({ bud, showFollow }: { bud: BudProfile; showFollow?: boolean }) {
  const [isFollowing, setIsFollowing] = useState(bud.isFollowing ?? false);

  return (
    <View style={styles.budCard}>
      <View style={styles.budCardAvatar}>
        <Text style={styles.budCardInitials}>{bud.initials}</Text>
      </View>
      <View style={styles.budCardInfo}>
        <Text style={styles.budCardName}>{bud.displayName}</Text>
        <Text style={styles.budCardStats}>
          Lv {bud.level} · 🔥 {bud.streak}d · {bud.leagueTier} · {bud.badgeCount} badges
        </Text>
      </View>
      {showFollow && (
        <Pressable
          style={[styles.followButton, isFollowing && styles.followButtonActive]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setIsFollowing(!isFollowing);
          }}
        >
          <Text style={[styles.followText, isFollowing && styles.followTextActive]}>
            {isFollowing ? "Following" : "Follow"}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  header: { paddingHorizontal: 20, paddingBottom: 0 },
  wordmark: { fontSize: 13, fontWeight: "600", color: "rgba(255,255,255,0.4)", letterSpacing: 2, textTransform: "uppercase", textAlign: "center", marginBottom: 12 },
  profileStrip: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
  myAvatar: { width: 44, height: 44, borderRadius: 22, overflow: "hidden" },
  myAvatarGrad: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  myAvatarInitial: { fontSize: 20, fontWeight: "800", color: Colors.navy },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 15, fontWeight: "700", color: "#FFF", marginBottom: 6 },
  profileStats: { flexDirection: "row", alignItems: "center", gap: 10 },
  profileStat: { alignItems: "center" },
  profileStatValue: { fontSize: 13, fontWeight: "700", color: "#FFF" },
  profileStatLabel: { fontSize: 10, color: Colors.muted },
  profileStatDivider: { width: 1, height: 20, backgroundColor: "rgba(255,255,255,0.1)" },
  inviteButton: { backgroundColor: "rgba(244,168,50,0.15)", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, borderWidth: 1, borderColor: "rgba(244,168,50,0.3)" },
  inviteText: { fontSize: 13, color: Colors.gold, fontWeight: "600" },
  viewSwitcher: { flexDirection: "row", borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.08)" },
  switchTab: { flex: 1, paddingVertical: 12, alignItems: "center" },
  switchTabActive: { borderBottomWidth: 2, borderBottomColor: Colors.gold },
  switchText: { fontSize: 12, color: Colors.muted, fontWeight: "500" },
  switchTextActive: { color: Colors.gold, fontWeight: "700" },
  scrollContent: { paddingHorizontal: 20, paddingTop: 16, gap: 12 },
  privacyNote: { backgroundColor: "rgba(16,185,129,0.08)", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: "rgba(16,185,129,0.15)" },
  privacyText: { fontSize: 12, color: Colors.emerald, fontWeight: "500", lineHeight: 17 },
  feedCard: { backgroundColor: Colors.card, borderRadius: 16, padding: 16, gap: 12, shadowColor: Colors.navy, shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  feedCardHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  feedAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.navy50, alignItems: "center", justifyContent: "center" },
  feedAvatarText: { fontSize: 13, fontWeight: "700", color: Colors.navy },
  feedUserInfo: { flex: 1 },
  feedNameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  feedName: { fontSize: 14, fontWeight: "700", color: Colors.navy },
  feedLevelBadge: { backgroundColor: Colors.navy50, borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 },
  feedLevelText: { fontSize: 10, fontWeight: "700", color: Colors.navyMuted },
  feedStreak: { fontSize: 11, color: Colors.muted, marginTop: 2 },
  feedTime: { fontSize: 11, color: Colors.muted },
  feedContent: { gap: 4 },
  feedTitle: { fontSize: 15, fontWeight: "700", color: Colors.navy },
  feedMessage: { fontSize: 13, color: Colors.navyMuted, lineHeight: 19 },
  feedFooter: { flexDirection: "row" },
  fistBumpButton: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: Colors.surface },
  fistBumpEmoji: { fontSize: 18 },
  fistBumpCount: { fontSize: 13, color: Colors.navyMuted, fontWeight: "600" },
  fistBumpCountActive: { color: Colors.gold },
  budsCount: { fontSize: 13, color: Colors.muted, fontWeight: "500", marginBottom: 4 },
  budCard: { flexDirection: "row", alignItems: "center", backgroundColor: Colors.card, borderRadius: 14, padding: 14, gap: 12, shadowColor: Colors.navy, shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  budCardAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.navy50, alignItems: "center", justifyContent: "center" },
  budCardInitials: { fontSize: 14, fontWeight: "700", color: Colors.navy },
  budCardInfo: { flex: 1 },
  budCardName: { fontSize: 14, fontWeight: "700", color: Colors.navy, marginBottom: 3 },
  budCardStats: { fontSize: 11, color: Colors.muted },
  followButton: { backgroundColor: Colors.navy, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
  followButtonActive: { backgroundColor: "rgba(27,43,75,0.12)", borderWidth: 1.5, borderColor: Colors.navy },
  followText: { fontSize: 13, fontWeight: "600", color: "#FFF" },
  followTextActive: { color: Colors.navy },
  searchContainer: { marginBottom: 16 },
  searchInput: { backgroundColor: Colors.card, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12, fontSize: 15, color: Colors.navy, borderWidth: 1, borderColor: Colors.border },
  discoverSectionTitle: { fontSize: 16, fontWeight: "700", color: Colors.navy, marginBottom: 4 },
  discoverSectionSub: { fontSize: 13, color: Colors.muted, marginBottom: 12 },
  phase2Card: { backgroundColor: Colors.card, borderRadius: 16, padding: 20, gap: 12, marginTop: 8, shadowColor: Colors.navy, shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  phase2Title: { fontSize: 16, fontWeight: "800", color: Colors.navy },
  phase2Sub: { fontSize: 13, color: Colors.muted, lineHeight: 19 },
  phase2Cta: { borderRadius: 12, overflow: "hidden", shadowColor: Colors.gold, shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 4 },
  phase2CtaGrad: { paddingVertical: 13, alignItems: "center" },
  phase2CtaText: { fontSize: 15, fontWeight: "700", color: Colors.navy },
});

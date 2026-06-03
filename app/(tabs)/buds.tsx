import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  TextInput,
  Animated,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Colors } from "@/constants/colors";
import { useUser } from "@/hooks/useAuth";
import { BrandHeader } from "@/components/BrandLogo";
import { FeedPost, BudProfile } from "@/mock/buds";
import { MOCK_LEAGUE, type League } from "@/mock/quests";
import { budsService } from "@/services/budsService";
import * as Haptics from "expo-haptics";
import { Icon } from "@/components/Icon";

const TAB_BAR_HEIGHT = 80;

type BudsView = "feed" | "my-buds" | "discover";

export default function BudsScreen() {
  const insets = useSafeAreaInsets();
  const user = useUser();
  const [activeView, setActiveView] = useState<BudsView>("feed");
  const [feed, setFeed] = useState<FeedPost[]>([]);
  const [league, setLeague] = useState<League>(MOCK_LEAGUE);
  const [following, setFollowing] = useState<BudProfile[]>([]);
  const [discover, setDiscover] = useState<BudProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const followingCount = following.length;

  const loadSocial = async ({ quiet = false }: { quiet?: boolean } = {}) => {
    if (!quiet) setIsLoading(true);
    try {
      const [nextFeed, nextLeague, nextFollowing, nextDiscover] = await Promise.all([
        budsService.getFeed(),
        budsService.getLeague(),
        budsService.getFollowing(),
        budsService.getDiscover(),
      ]);
      setFeed(nextFeed);
      setLeague(nextLeague);
      setFollowing(nextFollowing);
      setDiscover(nextDiscover);
    } finally {
      if (!quiet) setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSocial();
    const id = setInterval(() => {
      loadSocial({ quiet: true });
    }, 30_000);
    return () => clearInterval(id);
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadSocial({ quiet: true });
    setRefreshing(false);
  };

  const handleFistBump = async (postId: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const original = feed;
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
    try {
      const result = await budsService.fistBump(postId);
      setFeed((prev) =>
        prev.map((post) =>
          post.id === postId
            ? {
                ...post,
                fistBumps: result.newCount,
                hasFistBumped: result.hasFistBumped ?? post.hasFistBumped,
              }
            : post
        )
      );
    } catch {
      setFeed(original);
    }
  };

  const handleFollowToggle = async (bud: BudProfile) => {
    const nextIsFollowing = !bud.isFollowing;
    const update = (profile: BudProfile) =>
      profile.id === bud.id ? { ...profile, isFollowing: nextIsFollowing } : profile;
    setDiscover((current) => current.map(update));
    setFollowing((current) =>
      nextIsFollowing
        ? [{ ...bud, isFollowing: true }, ...current.filter((b) => b.id !== bud.id)]
        : current.filter((b) => b.id !== bud.id)
    );

    try {
      if (nextIsFollowing) {
        await budsService.follow(bud.id);
      } else {
        await budsService.unfollow(bud.id);
      }
      await loadSocial({ quiet: true });
    } catch {
      await loadSocial({ quiet: true });
    }
  };

  const handleReportPost = (post: FeedPost) => {
    Alert.alert(
      "Post safety",
      "Budget Buddy will review reports. Blocking removes this Bud from your feed and suggestions.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: `Block ${post.user.displayName}`,
          style: "destructive",
          onPress: async () => {
            try {
              await budsService.block(post.user.id);
              setFeed((current) => current.filter((item) => item.user.id !== post.user.id));
              setFollowing((current) => current.filter((bud) => bud.id !== post.user.id));
              setDiscover((current) => current.filter((bud) => bud.id !== post.user.id));
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch {
              Alert.alert("Could not block Bud", "Try again in a moment.");
            }
          },
        },
        {
          text: "Report",
          style: "destructive",
          onPress: async () => {
            try {
              await budsService.report(post.user.id, {
                postId: post.id,
                reason: "unsafe_social_content",
              });
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch {
              Alert.alert("Could not report post", "Try again in a moment.");
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={[Colors.brandGradientStart, Colors.brandGradientMid]}
        style={[styles.header, { paddingTop: insets.top + 12 }]}
      >
        <BrandHeader dark style={styles.brandHeader} />

        {/* My profile strip */}
        <View style={styles.profileStrip}>
          <View style={styles.myAvatar}>
            <LinearGradient colors={[Colors.gold, Colors.gold600]} style={styles.myAvatarGrad}>
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
                <View style={styles.streakInline}>
                  <Icon name="flame" size={12} color={Colors.gold} strokeWidth={2.4} />
                  <Text style={styles.profileStatValue}>{user?.streak}</Text>
                </View>
                <Text style={styles.profileStatLabel}>Streak</Text>
              </View>
              <View style={styles.profileStatDivider} />
              <View style={styles.profileStat}>
                <Text style={styles.profileStatValue}>Lv {user?.level}</Text>
                <Text style={styles.profileStatLabel}>Level</Text>
              </View>
            </View>
          </View>
          <Pressable
            style={styles.inviteButton}
            onPress={() => {
              Haptics.selectionAsync();
              router.push("/buds/invite");
            }}
          >
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
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.gold}
          />
        }
      >
        {isLoading && (
          <View style={styles.loadingCard}>
            <ActivityIndicator color={Colors.gold} />
            <Text style={styles.loadingText}>Loading Buds activity...</Text>
          </View>
        )}

        {activeView === "feed" && (
          <>
            {/* Privacy note */}
            <View style={styles.privacyNote}>
              <Icon name="lock" size={13} color={Colors.emerald} strokeWidth={2.4} />
              <Text style={styles.privacyText}>
                No financial data is ever shared. Only progress, milestones, and wins.
              </Text>
            </View>

            <WealthLeagueCard league={league} />

            {!isLoading && feed.length === 0 && (
              <EmptySocialState
                icon="sparkles"
                title="No Buds wins yet"
                body="Follow a few Buds or share your first win to make this feed come alive."
              />
            )}

            {feed.map((post) => (
              <FeedCard
                key={post.id}
                post={post}
                onFistBump={handleFistBump}
                onReport={handleReportPost}
              />
            ))}
          </>
        )}

        {activeView === "my-buds" && (
          <>
            <View style={styles.listHeader}>
              <Text style={styles.budsCount}>{followingCount} people you follow</Text>
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync();
                  router.push("/buds/list?type=followers");
                }}
              >
                <Text style={styles.listHeaderLink}>Followers</Text>
              </Pressable>
            </View>
            {!isLoading && following.length === 0 && (
              <EmptySocialState
                icon="users"
                title="No Buds yet"
                body="Find people building similar money habits and follow their wins here."
              />
            )}
            {following.map((bud) => (
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

            {!isLoading && discover.length === 0 && (
              <EmptySocialState
                icon="search"
                title="No suggestions yet"
                body="As more people join Budget Buddy, Bud will suggest peers with similar goals."
              />
            )}

            {discover
              .filter((bud) =>
                bud.displayName.toLowerCase().includes(searchQuery.trim().toLowerCase())
              )
              .map((bud) => (
                <BudCard
                  key={bud.id}
                  bud={bud}
                  showFollow
                  onFollowToggle={handleFollowToggle}
                />
              ))}

            {/* Phase 2 teaser */}
            <View style={styles.phase2Card}>
              <View style={styles.phase2TitleRow}>
                <Icon name="users" size={16} color={Colors.gold} strokeWidth={2.2} />
                <Text style={styles.phase2Title}>Community Feed</Text>
              </View>
              <Text style={styles.phase2Sub}>
                A curated feed of financial wins and community highlights activates at 5,000 users. 
                Help us get there — invite your people.
              </Text>
              <Pressable
                style={styles.phase2Cta}
                onPress={() => {
                  Haptics.selectionAsync();
                  router.push("/buds/invite");
                }}
              >
                <LinearGradient
                  colors={[Colors.gold, Colors.gold600]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.phase2CtaGrad}
                >
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

function EmptySocialState({
  icon,
  title,
  body,
}: {
  icon: Parameters<typeof Icon>[0]["name"];
  title: string;
  body: string;
}) {
  return (
    <View style={styles.emptyCard}>
      <View style={styles.emptyIcon}>
        <Icon name={icon} size={18} color={Colors.gold} strokeWidth={2.4} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
    </View>
  );
}

function WealthLeagueCard({ league }: { league: League }) {
  const leaders = league.users.slice(0, 8);
  const maxXp = Math.max(1, ...leaders.map((leader) => leader.xp));

  return (
    <Pressable
      style={({ pressed }) => [styles.leagueCard, pressed && styles.leagueCardPressed]}
      onPress={() => {
        Haptics.selectionAsync();
        router.push("/buds/league");
      }}
    >
      <View style={styles.leagueHeader}>
        <View style={styles.leagueTitleRow}>
          <View style={styles.leagueIcon}>
            <Icon name="trophy" size={18} color={Colors.gold} strokeWidth={2.4} />
          </View>
          <View style={styles.leagueTitleTextBlock}>
            <Text style={styles.leagueEyebrow}>WEALTH LEAGUE</Text>
            <Text style={styles.leagueTitle}>{league.tier} standings</Text>
          </View>
        </View>
        <View style={styles.rankPill}>
          <Text style={styles.rankPillText}>
            {league.currentUserRank > 0 ? `#${league.currentUserRank}` : "--"}
          </Text>
        </View>
      </View>

      <Text style={styles.leagueSub}>
        XP from quests and streak actions only. No balances, budgets, or
        transaction details are shared.
      </Text>

      <View style={styles.leagueResetRow}>
        <Text style={styles.leagueResetText}>{leagueResetCopy(league.resetDate)}</Text>
        <Text style={styles.leagueZoneText}>Top 3 advance</Text>
      </View>

      <View style={styles.leagueRows}>
        {leaders.map((leader, index) => (
          <LeagueRow
            key={leader.id}
            leader={leader}
            rank={index + 1}
            maxXp={maxXp}
          />
        ))}
      </View>
    </Pressable>
  );
}

function LeagueRow({
  leader,
  rank,
  maxXp,
}: {
  leader: (typeof MOCK_LEAGUE.users)[number];
  rank: number;
  maxXp: number;
}) {
  const fill = useRef(new Animated.Value(0)).current;
  const ratio = maxXp === 0 ? 0 : leader.xp / maxXp;

  useEffect(() => {
    Animated.timing(fill, {
      toValue: ratio,
      duration: 520 + rank * 70,
      useNativeDriver: false,
    }).start();
  }, [fill, rank, ratio]);

  const width = fill.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  return (
    <View
      style={[
        styles.leagueRow,
        leader.isCurrentUser && styles.leagueRowCurrent,
      ]}
    >
      <View style={styles.leagueRankBox}>
        <Text
          style={[
            styles.leagueRankText,
            leader.isCurrentUser && styles.leagueRankTextCurrent,
          ]}
        >
          {rank}
        </Text>
      </View>
      <View style={styles.leaguePerson}>
        <View style={styles.leagueNameRow}>
          <Text style={styles.leagueName}>
            {leader.isCurrentUser ? "You" : leader.name}
          </Text>
          <View style={styles.levelPill}>
            <Text style={styles.levelPillText}>Lv {leader.level}</Text>
          </View>
          {rank <= 3 && (
            <View style={styles.promotionPill}>
              <Text style={styles.promotionPillText}>Advance</Text>
            </View>
          )}
        </View>
        <View style={styles.leagueTrack}>
          <Animated.View style={[styles.leagueFill, { width }]} />
        </View>
      </View>
      <View style={styles.leagueXpBox}>
        <Text style={styles.leagueXp}>{leader.xp.toLocaleString()}</Text>
        <Text style={styles.leagueXpLabel}>XP</Text>
      </View>
    </View>
  );
}

function FeedCard({
  post,
  onFistBump,
  onReport,
}: {
  post: FeedPost;
  onFistBump: (id: string) => void;
  onReport: (post: FeedPost) => void;
}) {
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
        <Pressable
          style={styles.feedAvatar}
          onPress={() => {
            Haptics.selectionAsync();
            router.push(`/buds/profile/${post.user.id}`);
          }}
        >
          <Text style={styles.feedAvatarText}>{post.user.initials}</Text>
        </Pressable>
        <Pressable
          style={styles.feedUserInfo}
          onPress={() => {
            Haptics.selectionAsync();
            router.push(`/buds/profile/${post.user.id}`);
          }}
        >
          <View style={styles.feedNameRow}>
            <Text style={styles.feedName}>{post.user.displayName}</Text>
            <View style={styles.feedLevelBadge}>
              <Text style={styles.feedLevelText}>Lv {post.user.level}</Text>
            </View>
          </View>
          <View style={styles.feedStreakRow}>
            <Icon name="flame" size={11} color={Colors.gold} strokeWidth={2.4} />
            <Text style={styles.feedStreak}>{post.user.streak}-day streak · {post.user.leagueTier}</Text>
          </View>
        </Pressable>
        <Text style={styles.feedTime}>{timeAgo(post.timestamp)}</Text>
      </View>

      <View style={styles.feedContent}>
        <Text style={styles.feedTitle}>{post.title}</Text>
        <Text style={styles.feedMessage}>{post.message}</Text>
      </View>

      <View style={styles.feedFooter}>
        <Pressable
          style={[
            styles.fistBumpButton,
            post.hasFistBumped && styles.fistBumpButtonActive,
          ]}
          onPress={handleBump}
        >
          <Animated.View style={{ transform: [{ scale }] }}>
            <Text style={styles.fistBumpEmoji}>👊</Text>
          </Animated.View>
          <Text style={[styles.fistBumpCount, post.hasFistBumped && styles.fistBumpCountActive]}>
            {post.fistBumps}
          </Text>
        </Pressable>
        <Pressable style={styles.reportButton} onPress={() => onReport(post)}>
          <Icon name="shield" size={14} color={Colors.muted} strokeWidth={2.2} />
          <Text style={styles.reportText}>Report</Text>
        </Pressable>
      </View>
    </View>
  );
}

function BudCard({
  bud,
  showFollow,
  onFollowToggle,
}: {
  bud: BudProfile;
  showFollow?: boolean;
  onFollowToggle?: (bud: BudProfile) => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.budCard, pressed && styles.budCardPressed]}
      onPress={() => {
        Haptics.selectionAsync();
        router.push(`/buds/profile/${bud.id}`);
      }}
    >
      <View style={styles.budCardRow}>
        <View style={styles.budCardAvatar}>
          <Text style={styles.budCardInitials}>{bud.initials}</Text>
        </View>
        <View style={styles.budCardInfo}>
          <Text style={styles.budCardName} numberOfLines={1}>{bud.displayName}</Text>
          <View style={styles.budCardStatsRow}>
            <Text style={styles.budCardStats}>Lv {bud.level} · </Text>
            <Icon name="flame" size={11} color={Colors.gold} strokeWidth={2.4} />
            <Text style={styles.budCardStats} numberOfLines={1}> {bud.streak}d · {bud.leagueTier} · {bud.badgeCount} badges</Text>
          </View>
        </View>
        {showFollow && (
          <Pressable
            accessibilityLabel={bud.isFollowing ? "Following this Bud" : "Follow this Bud"}
            style={[styles.followButton, bud.isFollowing && styles.followButtonActive]}
            onPress={(event) => {
              event.stopPropagation();
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onFollowToggle?.(bud);
            }}
          >
            <Text style={[styles.followText, bud.isFollowing && styles.followTextActive]}>
              {bud.isFollowing ? "Following" : "Follow"}
            </Text>
          </Pressable>
        )}
      </View>
    </Pressable>
  );
}

function leagueResetCopy(resetDate?: string) {
  const resetAt = resetDate ? new Date(resetDate).getTime() : NaN;
  if (Number.isFinite(resetAt)) {
    const days = Math.max(1, Math.ceil((resetAt - Date.now()) / 86_400_000));
    if (days === 1) return "Resets tomorrow";
    return `Resets in ${days} days`;
  }

  const today = new Date();
  const daysUntilMonday = (8 - today.getDay()) % 7 || 7;

  if (daysUntilMonday === 1) return "Resets tomorrow";
  return `Resets in ${daysUntilMonday} days`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  header: { paddingHorizontal: 20, paddingBottom: 0 },
  brandHeader: { marginBottom: 12 },
  profileStrip: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
  myAvatar: { width: 44, height: 44, borderRadius: 22, overflow: "hidden" },
  myAvatarGrad: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  myAvatarInitial: { fontSize: 20, fontWeight: "800", color: Colors.onAccent },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 15, fontWeight: "700", color: Colors.brandOnDark, marginBottom: 6 },
  profileStats: { flexDirection: "row", alignItems: "center", gap: 10 },
  profileStat: { alignItems: "center" },
  profileStatValue: { fontSize: 13, fontWeight: "700", color: Colors.brandOnDark },
  profileStatLabel: { fontSize: 10, color: Colors.muted },
  profileStatDivider: { width: 1, height: 20, backgroundColor: "rgba(255,255,255,0.1)" },
  inviteButton: { backgroundColor: Colors.accentAlpha15, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, borderWidth: 1, borderColor: Colors.accentAlpha30 },
  inviteText: { fontSize: 13, color: Colors.gold, fontWeight: "600" },
  viewSwitcher: { flexDirection: "row", borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.08)" },
  switchTab: { flex: 1, paddingVertical: 12, alignItems: "center" },
  switchTabActive: { borderBottomWidth: 2, borderBottomColor: Colors.gold },
  switchText: { fontSize: 12, color: Colors.muted, fontWeight: "500" },
  switchTextActive: { color: Colors.gold, fontWeight: "700" },
  scrollContent: { paddingHorizontal: 20, paddingTop: 16, gap: 12 },
  loadingCard: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14, borderRadius: 14, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border },
  loadingText: { fontSize: 13, color: Colors.navyMuted, fontWeight: "700" },
  emptyCard: { alignItems: "center", padding: 18, gap: 8, borderRadius: 16, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border },
  emptyIcon: { width: 42, height: 42, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: Colors.greenSurface, borderWidth: 1, borderColor: Colors.greenBorder },
  emptyTitle: { fontSize: 15, color: Colors.navy, fontWeight: "800", letterSpacing: 0 },
  emptyBody: { fontSize: 13, color: Colors.navyMuted, lineHeight: 19, textAlign: "center" },
  privacyNote: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(16,185,129,0.08)", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: "rgba(16,185,129,0.15)" },
  privacyText: { flex: 1, fontSize: 12, color: Colors.emerald, fontWeight: "500", lineHeight: 17 },
  streakInline: { flexDirection: "row", alignItems: "center", gap: 4 },
  leagueCard: { backgroundColor: Colors.card, borderRadius: 18, padding: 20, borderWidth: 1, borderColor: Colors.border, shadowColor: Colors.navy, shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  leagueCardPressed: { opacity: 0.94, transform: [{ scale: 0.99 }] },
  leagueHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 18 },
  leagueTitleRow: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1, minWidth: 0 },
  leagueTitleTextBlock: { flex: 1, minWidth: 0, gap: 4 },
  leagueIcon: { width: 40, height: 40, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: Colors.greenSurface, borderWidth: 1, borderColor: Colors.greenBorder },
  leagueEyebrow: { fontSize: 10, color: Colors.gold, fontWeight: "800", letterSpacing: 1.4, lineHeight: 13 },
  leagueTitle: { fontSize: 17, color: Colors.navy, fontWeight: "800", letterSpacing: 0, lineHeight: 22 },
  rankPill: { minWidth: 46, alignItems: "center", justifyContent: "center", paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999, backgroundColor: Colors.accentAlpha12, borderWidth: 1, borderColor: Colors.accentAlpha30 },
  rankPillText: { fontSize: 13, color: Colors.gold, fontWeight: "900", letterSpacing: 0 },
  leagueSub: { fontSize: 12, color: Colors.navyMuted, lineHeight: 21, marginBottom: 18 },
  leagueResetRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 12, paddingHorizontal: 12, borderRadius: 13, backgroundColor: Colors.navy50, marginBottom: 18 },
  leagueResetText: { fontSize: 12, color: Colors.muted, fontWeight: "700" },
  leagueZoneText: { fontSize: 12, color: Colors.gold, fontWeight: "800" },
  leagueRows: { gap: 12 },
  leagueRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 13, paddingHorizontal: 12, borderRadius: 14, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  leagueRowCurrent: { backgroundColor: Colors.greenSurface, borderColor: Colors.accentAlpha45 },
  leagueRankBox: { width: 28, height: 28, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: Colors.card },
  leagueRankText: { fontSize: 12, color: Colors.navy, fontWeight: "900" },
  leagueRankTextCurrent: { color: Colors.gold },
  leaguePerson: { flex: 1, gap: 6 },
  leagueNameRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  leagueName: { fontSize: 13, color: Colors.navy, fontWeight: "800", letterSpacing: 0 },
  levelPill: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 999, backgroundColor: Colors.navy50, borderWidth: 1, borderColor: Colors.border },
  levelPillText: { fontSize: 9, color: Colors.navyMuted, fontWeight: "900", letterSpacing: 0.2 },
  promotionPill: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 999, backgroundColor: Colors.accentAlpha12 },
  promotionPillText: { fontSize: 9, color: Colors.gold, fontWeight: "900", letterSpacing: 0.4 },
  leagueTrack: { height: 5, borderRadius: 3, backgroundColor: Colors.border, overflow: "hidden" },
  leagueFill: { height: 5, borderRadius: 3, backgroundColor: Colors.gold },
  leagueXpBox: { alignItems: "flex-end", minWidth: 54 },
  leagueXp: { fontSize: 12, color: Colors.navy, fontWeight: "900", letterSpacing: 0 },
  leagueXpLabel: { fontSize: 9, color: Colors.muted, fontWeight: "800", letterSpacing: 0.7 },
  feedCard: { backgroundColor: Colors.card, borderRadius: 16, padding: 16, gap: 12, shadowColor: Colors.navy, shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  feedCardHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  feedAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.navy50, alignItems: "center", justifyContent: "center" },
  feedAvatarText: { fontSize: 13, fontWeight: "700", color: Colors.navy },
  feedUserInfo: { flex: 1 },
  feedNameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  feedName: { fontSize: 14, fontWeight: "700", color: Colors.navy },
  feedLevelBadge: { backgroundColor: Colors.navy50, borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 },
  feedLevelText: { fontSize: 10, fontWeight: "700", color: Colors.navyMuted },
  feedStreakRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  feedStreak: { fontSize: 11, color: Colors.muted },
  feedTime: { fontSize: 11, color: Colors.muted },
  feedContent: { gap: 4 },
  feedTitle: { fontSize: 15, fontWeight: "700", color: Colors.navy },
  feedMessage: { fontSize: 13, color: Colors.navyMuted, lineHeight: 19 },
  feedFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  fistBumpButton: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  fistBumpButtonActive: { backgroundColor: Colors.accentAlpha10, borderColor: Colors.accentAlpha40 },
  fistBumpEmoji: { fontSize: 16, lineHeight: 20 },
  fistBumpCount: { fontSize: 13, color: Colors.navyMuted, fontWeight: "600" },
  fistBumpCountActive: { color: Colors.gold },
  reportButton: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 999 },
  reportText: { fontSize: 12, color: Colors.muted, fontWeight: "700" },
  listHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  listHeaderLink: { fontSize: 13, color: Colors.gold, fontWeight: "800" },
  budsCount: { fontSize: 13, color: Colors.muted, fontWeight: "500" },
  budCard: { backgroundColor: Colors.card, borderRadius: 14, padding: 14, shadowColor: Colors.navy, shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  budCardPressed: { backgroundColor: Colors.navy50, transform: [{ scale: 0.99 }] },
  budCardRow: { flexDirection: "row", alignItems: "center" },
  budCardAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.navy50, alignItems: "center", justifyContent: "center", marginRight: 12 },
  budCardInitials: { fontSize: 14, fontWeight: "700", color: Colors.navy },
  budCardInfo: { flex: 1, minWidth: 0, paddingRight: 6 },
  budCardName: { fontSize: 14, fontWeight: "700", color: Colors.navy, marginBottom: 3 },
  budCardStatsRow: { flexDirection: "row", alignItems: "center", maxWidth: "100%" },
  budCardStats: { fontSize: 11, color: Colors.muted, flexShrink: 1 },
  followButton: { alignItems: "center", justifyContent: "center", height: 32, borderRadius: 999, paddingHorizontal: 14, marginLeft: 10, backgroundColor: Colors.accentAlpha10, borderWidth: 1, borderColor: Colors.accentAlpha40 },
  followButtonActive: { backgroundColor: "transparent", borderColor: Colors.border },
  followText: { fontSize: 13, fontWeight: "800", color: Colors.gold, letterSpacing: 0.2 },
  followTextActive: { color: Colors.muted },
  searchContainer: { marginBottom: 16 },
  searchInput: { backgroundColor: Colors.card, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12, fontSize: 15, color: Colors.navy, borderWidth: 1, borderColor: Colors.border },
  discoverSectionTitle: { fontSize: 16, fontWeight: "700", color: Colors.navy, marginBottom: 4 },
  discoverSectionSub: { fontSize: 13, color: Colors.muted, marginBottom: 12 },
  phase2Card: { backgroundColor: Colors.card, borderRadius: 16, padding: 20, gap: 12, marginTop: 8, shadowColor: Colors.navy, shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  phase2TitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  phase2Title: { fontSize: 16, fontWeight: "800", color: Colors.navy },
  phase2Sub: { fontSize: 13, color: Colors.muted, lineHeight: 19 },
  phase2Cta: { borderRadius: 12, overflow: "hidden", shadowColor: Colors.gold, shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 4 },
  phase2CtaGrad: { paddingVertical: 13, alignItems: "center" },
  phase2CtaText: { fontSize: 15, fontWeight: "700", color: Colors.onAccent },
});

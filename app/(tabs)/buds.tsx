import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { InfiniteData, useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";

import { BrandHeader } from "@/components/BrandLogo";
import { Icon, type IconName } from "@/components/Icon";
import { Colors } from "@/constants/colors";
import { Radius, Shadow, Spacing, Type } from "@/constants/tokens";
import { BudAvatar } from "@/features/buds/BudAvatar";
import { CommentsSheet } from "@/features/buds/CommentsSheet";
import { FeedPostCard } from "@/features/buds/FeedPostCard";
import { PostComposer } from "@/features/buds/PostComposer";
import { WealthLeagueVisual } from "@/features/quests/WealthLeagueVisual";
import { useUser } from "@/hooks/useAuth";
import type { BudProfile, FeedPage, FeedPost } from "@/mock/buds";
import { BUDS_KEYS, budsService } from "@/services/budsService";

const TAB_BAR_HEIGHT = 82;
type BudsView = "feed" | "my-buds" | "discover";

export default function BudsScreen() {
  const insets = useSafeAreaInsets();
  const user = useUser();
  const queryClient = useQueryClient();
  const [activeView, setActiveView] = useState<BudsView>("feed");
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [commentPost, setCommentPost] = useState<FeedPost>();
  const [mediaHeaders, setMediaHeaders] = useState<Record<string, string>>();

  const feedQuery = useInfiniteQuery({
    queryKey: BUDS_KEYS.feed(),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => budsService.getFeedPage({ cursor: pageParam, limit: 10 }),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
  const leagueQuery = useQuery(budsService.queries.league());
  const followingQuery = useQuery(budsService.queries.following());
  const discoverQuery = useQuery(budsService.queries.discover());

  useEffect(() => {
    budsService.mediaHeaders().then(setMediaHeaders).catch(() => setMediaHeaders(undefined));
  }, []);

  const feed = useMemo(
    () => feedQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [feedQuery.data?.pages],
  );
  const following = followingQuery.data ?? [];
  const discover = useMemo(() => {
    const normalized = searchQuery.trim().toLowerCase();
    if (!normalized) return discoverQuery.data ?? [];
    return (discoverQuery.data ?? []).filter((bud) => bud.displayName.toLowerCase().includes(normalized));
  }, [discoverQuery.data, searchQuery]);

  const updateFeedPost = useCallback(
    (postId: string, update: (post: FeedPost) => FeedPost) => {
      queryClient.setQueryData<InfiniteData<FeedPage>>(BUDS_KEYS.feed(), (current) => {
        if (!current) return current;
        return {
          ...current,
          pages: current.pages.map((page) => ({
            ...page,
            items: page.items.map((post) => (post.id === postId ? update(post) : post)),
          })),
        };
      });
    },
    [queryClient],
  );

  const handleFistBump = useCallback(
    async (post: FeedPost) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      updateFeedPost(post.id, (current) => ({
        ...current,
        hasFistBumped: !current.hasFistBumped,
        fistBumps: Math.max(0, current.fistBumps + (current.hasFistBumped ? -1 : 1)),
      }));
      try {
        const result = await budsService.fistBump(post.id);
        updateFeedPost(post.id, (current) => ({
          ...current,
          fistBumps: result.newCount,
          hasFistBumped: result.hasFistBumped ?? current.hasFistBumped,
        }));
      } catch {
        updateFeedPost(post.id, () => post);
        Alert.alert("Fist Bump did not land", "Check your connection and try again.");
      }
    },
    [updateFeedPost],
  );

  const handleCommentAdded = useCallback(
    (postId: string) => updateFeedPost(postId, (post) => ({ ...post, commentCount: post.commentCount + 1 })),
    [updateFeedPost],
  );

  const handleShared = useCallback(
    (post: FeedPost) => {
      queryClient.setQueryData<InfiniteData<FeedPage>>(BUDS_KEYS.feed(), (current) => {
        if (!current || current.pages.length === 0) {
          return { pages: [{ items: [post] }], pageParams: [undefined] };
        }
        return {
          ...current,
          pages: [
            { ...current.pages[0], items: [post, ...current.pages[0].items] },
            ...current.pages.slice(1),
          ],
        };
      });
      queryClient.invalidateQueries({ queryKey: BUDS_KEYS.achievements() });
      setActiveView("feed");
    },
    [queryClient],
  );

  const handleReportPost = useCallback((post: FeedPost) => {
    Alert.alert(
      "Post options",
      "Budget Buddy reviews reports. Blocking removes this Bud and their posts from your experience.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: `Block ${post.user.displayName}`,
          style: "destructive",
          onPress: async () => {
            try {
              await budsService.block(post.user.id);
              await Promise.all([
                queryClient.invalidateQueries({ queryKey: BUDS_KEYS.feed() }),
                queryClient.invalidateQueries({ queryKey: BUDS_KEYS.following() }),
                queryClient.invalidateQueries({ queryKey: BUDS_KEYS.discover() }),
              ]);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch {
              Alert.alert("Could not block this Bud", "Try again in a moment.");
            }
          },
        },
        {
          text: "Report post",
          style: "destructive",
          onPress: async () => {
            try {
              await budsService.report(post.user.id, { postId: post.id, reason: "unsafe_social_content" });
              Alert.alert("Report received", "Thanks. Budget Buddy will review it.");
            } catch {
              Alert.alert("Could not send that report", "Try again in a moment.");
            }
          },
        },
      ],
    );
  }, [queryClient]);

  const handleFollowToggle = useCallback(async (bud: BudProfile) => {
    Haptics.selectionAsync();
    try {
      if (bud.isFollowing) await budsService.unfollow(bud.id);
      else await budsService.follow(bud.id);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: BUDS_KEYS.following() }),
        queryClient.invalidateQueries({ queryKey: BUDS_KEYS.discover() }),
        queryClient.invalidateQueries({ queryKey: BUDS_KEYS.feed() }),
      ]);
    } catch {
      Alert.alert("That connection did not update", "Check your connection and try again.");
    }
  }, [queryClient]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        feedQuery.refetch(),
        leagueQuery.refetch(),
        followingQuery.refetch(),
        discoverQuery.refetch(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [discoverQuery, feedQuery, followingQuery, leagueQuery]);

  const topHeader = (
    <LinearGradient
      colors={[Colors.brandGradientStart, Colors.brandGradientMid]}
      style={[styles.header, { paddingTop: insets.top + 10 }]}
    >
      <BrandHeader dark style={styles.brandHeader} />
      <View style={styles.titleRow}>
        <View style={styles.profileStrip}>
          <BudAvatar
            name={`${user?.firstName ?? "Budget"} ${user?.lastName ?? "Buddy"}`}
            initials={`${user?.firstName?.[0] ?? "B"}${user?.lastName?.[0] ?? ""}`}
            avatar={user?.avatar}
            size={46}
            activeRing
          />
          <View style={styles.profileCopy}>
            <Text style={styles.screenTitle}>Buds</Text>
            <Text style={styles.profileMeta}>
              {following.length} Buds · {user?.streak ?? 0}d streak · Level {user?.level ?? 1}
            </Text>
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Invite Buds"
          style={styles.inviteButton}
          onPress={() => router.push("/buds/invite")}
        >
          <Icon name="user-plus" size={18} color={Colors.gold} />
        </Pressable>
      </View>
      <View style={styles.tabs}>
        {(["feed", "my-buds", "discover"] as const).map((view) => (
          <Pressable
            key={view}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeView === view }}
            style={[styles.tab, activeView === view && styles.tabActive]}
            onPress={() => {
              setActiveView(view);
              Haptics.selectionAsync();
            }}
          >
            <Text style={[styles.tabText, activeView === view && styles.tabTextActive]}>
              {view === "feed" ? "Feed" : view === "my-buds" ? "My Buds" : "Discover"}
            </Text>
          </Pressable>
        ))}
      </View>
    </LinearGradient>
  );

  return (
    <View style={styles.container}>
      {topHeader}

      {activeView === "feed" ? (
        <FlatList
          data={feed}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.feedContent, { paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 30 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={Colors.gold} />}
          onEndReached={() => {
            if (feedQuery.hasNextPage && !feedQuery.isFetchingNextPage) feedQuery.fetchNextPage();
          }}
          onEndReachedThreshold={0.45}
          ListHeaderComponent={
            <View style={styles.feedHeader}>
              <View style={styles.privacyNote}>
                <Icon name="lock" size={14} color={Colors.gold} strokeWidth={2.4} />
                <Text style={styles.privacyNoteText}>Only wins you choose to share</Text>
              </View>
              {leagueQuery.data ? (
                <WealthLeagueVisual
                  compact
                  league={leagueQuery.data}
                  scoreValue={user?.financialHealthScore}
                  onPress={() => router.push("/buds/league")}
                />
              ) : null}
              {feedQuery.isError && feed.length > 0 ? (
                <InlineNotice icon="alert-circle" text="You are seeing saved posts. Pull to reconnect." />
              ) : null}
            </View>
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            feedQuery.isLoading ? (
              <FeedLoadingState />
            ) : feedQuery.isError ? (
              <EmptyState
                icon="alert-circle"
                title="Buds is offline for a minute"
                body="Your wins are safe. Check your connection and try again."
                action="Try again"
                onAction={() => feedQuery.refetch()}
              />
            ) : (
              <EmptyState
                icon="sparkles"
                title="Your feed is ready for a first win"
                body="Share a verified achievement or follow a few Buds. No balances. No pressure."
                action="Share a win"
                onAction={() => setComposerOpen(true)}
              />
            )
          }
          ListFooterComponent={
            feedQuery.isFetchingNextPage ? (
              <View style={styles.pageLoader}><ActivityIndicator color={Colors.gold} /></View>
            ) : feed.length > 0 ? (
              <Text style={styles.feedEnd}>You are caught up. Go make the next win real.</Text>
            ) : null
          }
          renderItem={({ item }) => (
            <FeedPostCard
              post={item}
              currentUserId={user?.id}
              mediaHeaders={mediaHeaders}
              onFistBump={handleFistBump}
              onComment={setCommentPost}
              onReport={handleReportPost}
              onOpenProfile={(id) => router.push(`/buds/profile/${id}`)}
            />
          )}
        />
      ) : activeView === "my-buds" ? (
        <FlatList
          data={following}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.listContent, { paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 30 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={Colors.gold} />}
          ListHeaderComponent={<SectionIntro title={`${following.length} people you follow`} body="The people whose progress keeps yours moving." />}
          ItemSeparatorComponent={() => <View style={styles.smallSeparator} />}
          ListEmptyComponent={
            followingQuery.isLoading ? <ActivityIndicator color={Colors.gold} /> : (
              <EmptyState icon="users" title="No Buds yet" body="Follow people building similar habits and their wins will show up here." action="Discover Buds" onAction={() => setActiveView("discover")} />
            )
          }
          renderItem={({ item }) => <BudCard bud={item} onFollowToggle={handleFollowToggle} />}
        />
      ) : (
        <FlatList
          data={discover}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.listContent, { paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 30 }]}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={Colors.gold} />}
          ListHeaderComponent={
            <View style={styles.discoverHeader}>
              <View style={styles.searchBox}>
                <Icon name="search" size={18} color={Colors.muted} />
                <TextInput
                  accessibilityLabel="Search Buds"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Search by name"
                  placeholderTextColor={Colors.muted}
                  style={styles.searchInput}
                  autoCorrect={false}
                />
              </View>
              <SectionIntro title="People with similar momentum" body="Suggestions use public goals and activity patterns—not private financial data." />
            </View>
          }
          ItemSeparatorComponent={() => <View style={styles.smallSeparator} />}
          ListEmptyComponent={
            discoverQuery.isLoading ? <ActivityIndicator color={Colors.gold} /> : (
              <EmptyState icon="search" title={searchQuery ? "No Buds match that search" : "Suggestions are still forming"} body="Try another name or invite someone you already trust." action="Invite a Bud" onAction={() => router.push("/buds/invite")} />
            )
          }
          renderItem={({ item }) => <BudCard bud={item} showFollow onFollowToggle={handleFollowToggle} />}
        />
      )}

      {activeView === "feed" ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Share a new win"
          style={[styles.floatingCreate, { bottom: TAB_BAR_HEIGHT + Math.max(insets.bottom, 8) }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setComposerOpen(true);
          }}
        >
          <Icon name="plus" size={26} color={Colors.onAccent} strokeWidth={2.8} />
        </Pressable>
      ) : null}

      <PostComposer visible={composerOpen} onClose={() => setComposerOpen(false)} onShared={handleShared} />
      <CommentsSheet post={commentPost} onClose={() => setCommentPost(undefined)} onCommentAdded={handleCommentAdded} />
    </View>
  );
}

function BudCard({
  bud,
  showFollow = false,
  onFollowToggle,
}: {
  bud: BudProfile;
  showFollow?: boolean;
  onFollowToggle: (bud: BudProfile) => void;
}) {
  return (
    <Pressable style={({ pressed }) => [styles.budCard, pressed && styles.budCardPressed]} onPress={() => router.push(`/buds/profile/${bud.id}`)}>
      <BudAvatar name={bud.displayName} initials={bud.initials} avatar={bud.avatar} avatarAsset={bud.avatarAsset} size={46} />
      <View style={styles.budInfo}>
        <Text style={styles.budName}>{bud.displayName}</Text>
        <Text style={styles.budMeta}>Level {bud.level} · {bud.streak}d streak · {bud.leagueTier}</Text>
      </View>
      {showFollow ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={bud.isFollowing ? `Unfollow ${bud.displayName}` : `Follow ${bud.displayName}`}
          style={[styles.followButton, bud.isFollowing && styles.followButtonActive]}
          onPress={(event) => {
            event.stopPropagation();
            onFollowToggle(bud);
          }}
        >
          <Text style={[styles.followText, bud.isFollowing && styles.followTextActive]}>{bud.isFollowing ? "Following" : "Follow"}</Text>
        </Pressable>
      ) : <Icon name="chevron-right" size={18} color={Colors.muted} />}
    </Pressable>
  );
}

function SectionIntro({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.sectionIntro}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionBody}>{body}</Text>
    </View>
  );
}

function EmptyState({
  icon,
  title,
  body,
  action,
  onAction,
}: {
  icon: IconName;
  title: string;
  body: string;
  action: string;
  onAction: () => void;
}) {
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIcon}><Icon name={icon} size={25} color={Colors.gold} /></View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
      <Pressable style={styles.emptyAction} onPress={onAction}>
        <Text style={styles.emptyActionText}>{action}</Text>
      </Pressable>
    </View>
  );
}

function FeedLoadingState() {
  return (
    <View style={styles.loadingCard}>
      <View style={styles.loadingHeader}><View style={styles.loadingAvatar} /><View style={styles.loadingLines}><View style={styles.loadingLineWide} /><View style={styles.loadingLineShort} /></View></View>
      <View style={styles.loadingMedia}>
        <Icon name="sparkles" size={24} color={Colors.gold} />
        <Text style={styles.loadingText}>Loading real progress…</Text>
      </View>
    </View>
  );
}

function InlineNotice({ icon, text }: { icon: IconName; text: string }) {
  return (
    <View style={styles.inlineNotice}>
      <Icon name={icon} size={15} color={Colors.gold} />
      <Text style={styles.inlineNoticeText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  header: { paddingHorizontal: Spacing.lg },
  brandHeader: { marginBottom: 10 },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingBottom: 14 },
  profileStrip: { flex: 1, flexDirection: "row", alignItems: "center", gap: 11 },
  profileCopy: { flex: 1, minWidth: 0 },
  screenTitle: { fontSize: 25, fontWeight: "900", letterSpacing: -0.4, color: Colors.brandOnDark },
  profileMeta: { ...Type.caption, color: Colors.brandOnDarkMuted, marginTop: 2 },
  inviteButton: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: Colors.accentAlpha12, borderWidth: 1, borderColor: Colors.accentAlpha30 },
  tabs: { flexDirection: "row", borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.08)" },
  tab: { flex: 1, minHeight: 48, alignItems: "center", justifyContent: "center", borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabActive: { borderBottomColor: Colors.gold },
  tabText: { ...Type.caption, color: Colors.brandOnDarkMuted },
  tabTextActive: { color: Colors.gold, fontWeight: "800" },
  feedContent: { paddingHorizontal: Spacing.md, paddingTop: Spacing.sm },
  feedHeader: { gap: Spacing.sm, marginBottom: Spacing.md },
  privacyNote: { minHeight: 36, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  privacyNoteText: { ...Type.caption, color: Colors.navyMuted },
  separator: { height: Spacing.md },
  smallSeparator: { height: 10 },
  pageLoader: { minHeight: 70, alignItems: "center", justifyContent: "center" },
  feedEnd: { ...Type.caption, color: Colors.muted, textAlign: "center", paddingVertical: 24, paddingHorizontal: 30 },
  listContent: { padding: Spacing.lg },
  discoverHeader: { gap: Spacing.lg, marginBottom: Spacing.md },
  sectionIntro: { gap: 5, marginBottom: Spacing.md },
  sectionTitle: { ...Type.h2, color: Colors.navy },
  sectionBody: { ...Type.body, color: Colors.muted },
  searchBox: { height: 48, flexDirection: "row", alignItems: "center", gap: 9, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.card, paddingHorizontal: 14 },
  searchInput: { flex: 1, height: "100%", color: Colors.navy, fontSize: 15 },
  budCard: { minHeight: 76, flexDirection: "row", alignItems: "center", gap: 11, padding: 14, borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.card, ...Shadow.sm },
  budCardPressed: { transform: [{ scale: 0.99 }], opacity: 0.92 },
  budInfo: { flex: 1, minWidth: 0, gap: 3 },
  budName: { ...Type.bodyStrong, color: Colors.navy },
  budMeta: { ...Type.caption, color: Colors.muted },
  followButton: { minHeight: 38, justifyContent: "center", paddingHorizontal: 14, borderRadius: Radius.pill, backgroundColor: Colors.gold, borderWidth: 1, borderColor: Colors.gold },
  followButtonActive: { backgroundColor: Colors.surface, borderColor: Colors.border },
  followText: { ...Type.caption, color: Colors.onAccent, fontWeight: "800" },
  followTextActive: { color: Colors.muted },
  floatingCreate: { position: "absolute", right: 20, width: 58, height: 58, borderRadius: 29, alignItems: "center", justifyContent: "center", backgroundColor: Colors.gold, shadowColor: Colors.gold, shadowOpacity: 0.34, shadowRadius: 15, shadowOffset: { width: 0, height: 7 }, elevation: 8 },
  emptyState: { minHeight: 300, alignItems: "center", justifyContent: "center", gap: 9, padding: Spacing.xl, borderRadius: 22, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.card },
  emptyIcon: { width: 58, height: 58, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: Colors.accentAlpha12 },
  emptyTitle: { ...Type.h2, color: Colors.navy, textAlign: "center" },
  emptyBody: { ...Type.body, color: Colors.muted, textAlign: "center", maxWidth: 300 },
  emptyAction: { minHeight: 44, justifyContent: "center", paddingHorizontal: 18, borderRadius: Radius.pill, backgroundColor: Colors.gold, marginTop: 5 },
  emptyActionText: { ...Type.bodyStrong, color: Colors.onAccent },
  inlineNotice: { minHeight: 42, flexDirection: "row", alignItems: "center", gap: 8, borderRadius: Radius.md, paddingHorizontal: 12, backgroundColor: Colors.accentAlpha07, borderWidth: 1, borderColor: Colors.accentAlpha20 },
  inlineNoticeText: { ...Type.caption, color: Colors.navyMuted, flex: 1 },
  loadingCard: { padding: Spacing.md, gap: Spacing.md, borderRadius: 22, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border },
  loadingHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  loadingAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.navy50 },
  loadingLines: { flex: 1, gap: 7 },
  loadingLineWide: { width: "48%", height: 10, borderRadius: 5, backgroundColor: Colors.navy50 },
  loadingLineShort: { width: "30%", height: 8, borderRadius: 4, backgroundColor: Colors.navy50 },
  loadingMedia: { minHeight: 330, borderRadius: 18, alignItems: "center", justifyContent: "center", gap: 9, backgroundColor: Colors.navy50 },
  loadingText: { ...Type.caption, color: Colors.muted },
});

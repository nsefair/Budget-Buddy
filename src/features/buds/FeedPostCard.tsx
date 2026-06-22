import React, { useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";

import { Icon } from "@/components/Icon";
import { Colors } from "@/constants/colors";
import { HitSlop, Radius, Shadow, Spacing, Type } from "@/constants/tokens";
import type { FeedPost } from "@/mock/buds";
import { BudAvatar } from "@/features/buds/BudAvatar";
import { PostMediaCarousel } from "@/features/buds/PostMediaCarousel";

interface FeedPostCardProps {
  post: FeedPost;
  currentUserId?: string;
  mediaHeaders?: Record<string, string>;
  onFistBump: (post: FeedPost) => void;
  onComment: (post: FeedPost) => void;
  onReport: (post: FeedPost) => void;
  onOpenProfile: (userId: string) => void;
}

export const FeedPostCard = React.memo(function FeedPostCard({
  post,
  currentUserId,
  mediaHeaders,
  onFistBump,
  onComment,
  onReport,
  onOpenProfile,
}: FeedPostCardProps) {
  const bumpScale = useRef(new Animated.Value(1)).current;
  const isOwnPost = currentUserId === post.user.id;

  const handleBump = () => {
    Animated.sequence([
      Animated.spring(bumpScale, { toValue: 1.16, damping: 11, stiffness: 360, useNativeDriver: true }),
      Animated.spring(bumpScale, { toValue: 1, damping: 13, stiffness: 220, useNativeDriver: true }),
    ]).start();
    onFistBump(post);
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Pressable
          hitSlop={HitSlop}
          onPress={() => onOpenProfile(post.user.id)}
          accessibilityRole="button"
          accessibilityLabel={`Open ${post.user.displayName}'s profile`}
        >
          <BudAvatar
            name={post.user.displayName}
            initials={post.user.initials}
            avatar={post.user.avatar}
            avatarAsset={post.user.avatarAsset}
            activeRing
          />
        </Pressable>

        <Pressable style={styles.identity} onPress={() => onOpenProfile(post.user.id)}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>{post.user.displayName}</Text>
            {post.achievement?.verified ? <Icon name="badge-check" size={16} color={Colors.gold} strokeWidth={2.5} /> : null}
          </View>
          <Text style={styles.meta} numberOfLines={1}>
            {relativeTime(post.timestamp)} · {post.user.leagueTier} · {post.user.streak}d streak
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Post options for ${post.user.displayName}`}
          hitSlop={HitSlop}
          style={styles.moreButton}
          onPress={() => onReport(post)}
        >
          <Icon name="more-horizontal" size={20} color={Colors.muted} strokeWidth={2.2} />
        </Pressable>
      </View>

      <View style={styles.copy}>
        {post.achievement ? (
          <View style={styles.achievementRow}>
            <Icon name={post.achievement.verified ? "shield-check" : "sparkles"} size={14} color={Colors.gold} strokeWidth={2.5} />
            <Text style={styles.achievementLabel}>{post.achievement.label}</Text>
            {post.visibility === "private" ? (
              <View style={styles.privateInline}>
                <Icon name="lock" size={11} color={Colors.muted} />
                <Text style={styles.privateText}>Only you</Text>
              </View>
            ) : null}
          </View>
        ) : null}
        <Text style={styles.title}>{post.title}</Text>
        {post.message ? <Text style={styles.caption}>{post.message}</Text> : null}
      </View>

      <PostMediaCarousel media={post.media} headers={mediaHeaders} />

      <View style={styles.actions}>
        {isOwnPost ? (
          <View style={styles.ownPostAction} accessibilityLabel={`${post.fistBumps} Fist Bumps on your post`}>
            <Icon name="hand" size={17} color={Colors.gold} strokeWidth={2.5} />
            <Text style={styles.actionTextActive}>Your post · {post.fistBumps}</Text>
          </View>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={post.hasFistBumped ? "Remove Fist Bump" : "Send Fist Bump"}
            accessibilityState={{ selected: post.hasFistBumped }}
            style={[styles.actionButton, post.hasFistBumped && styles.actionButtonActive]}
            onPress={handleBump}
          >
            <Animated.View style={{ transform: [{ scale: bumpScale }] }}>
              <Icon name="hand" size={18} color={post.hasFistBumped ? Colors.gold : Colors.navyMuted} strokeWidth={2.5} />
            </Animated.View>
            <Text style={[styles.actionText, post.hasFistBumped && styles.actionTextActive]}>Fist Bump</Text>
            <Text style={[styles.count, post.hasFistBumped && styles.actionTextActive]}>{post.fistBumps}</Text>
          </Pressable>
        )}

        {post.commentsEnabled ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Open ${post.commentCount} comments`}
            style={styles.actionButton}
            onPress={() => onComment(post)}
          >
            <Icon name="message-circle" size={18} color={Colors.navyMuted} strokeWidth={2.3} />
            <Text style={styles.actionText}>Comment</Text>
            <Text style={styles.count}>{post.commentCount}</Text>
          </Pressable>
        ) : (
          <View style={styles.commentsOff}>
            <Icon name="lock" size={13} color={Colors.muted} />
            <Text style={styles.commentsOffText}>Comments off</Text>
          </View>
        )}
      </View>
    </View>
  );
});

function relativeTime(timestamp: string) {
  const milliseconds = Date.now() - new Date(timestamp).getTime();
  const minutes = Math.max(0, Math.floor(milliseconds / 60_000));
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(timestamp));
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: Spacing.sm,
    ...Shadow.md,
  },
  header: { flexDirection: "row", alignItems: "center", gap: 10 },
  identity: { flex: 1, minWidth: 0, minHeight: 44, justifyContent: "center" },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  name: { ...Type.bodyStrong, color: Colors.navy, flexShrink: 1 },
  meta: { ...Type.caption, color: Colors.muted, marginTop: 1 },
  moreButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: Radius.pill },
  copy: { gap: 5, paddingHorizontal: 2, paddingVertical: 2 },
  achievementRow: { flexDirection: "row", alignItems: "center", gap: 5, minHeight: 22 },
  achievementLabel: { ...Type.caption, color: Colors.gold, fontWeight: "800" },
  privateInline: { flexDirection: "row", alignItems: "center", gap: 4, marginLeft: "auto" },
  privateText: { ...Type.micro, color: Colors.muted, letterSpacing: 0 },
  title: { fontSize: 18, lineHeight: 23, fontWeight: "800", color: Colors.navy, letterSpacing: -0.2 },
  caption: { ...Type.body, color: Colors.navyMuted, lineHeight: 21 },
  actions: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 44 },
  actionButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: Radius.pill,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    paddingHorizontal: 10,
  },
  actionButtonActive: { borderColor: Colors.accentAlpha40, backgroundColor: Colors.accentAlpha10 },
  ownPostAction: { flex: 1, minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  actionText: { fontSize: 12, fontWeight: "800", color: Colors.navyMuted },
  actionTextActive: { color: Colors.gold },
  count: { fontSize: 12, fontWeight: "700", color: Colors.muted },
  commentsOff: { flex: 1, minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 },
  commentsOffText: { fontSize: 11, fontWeight: "700", color: Colors.muted },
});

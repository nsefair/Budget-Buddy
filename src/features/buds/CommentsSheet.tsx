import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

import { Icon } from "@/components/Icon";
import { Colors } from "@/constants/colors";
import { Radius, Spacing, Type } from "@/constants/tokens";
import { BudAvatar } from "@/features/buds/BudAvatar";
import type { FeedPost, PostComment } from "@/mock/buds";
import { BUDS_KEYS, budsService } from "@/services/budsService";

interface CommentsSheetProps {
  post?: FeedPost;
  onClose: () => void;
  onCommentAdded: (postId: string) => void;
}

export function CommentsSheet({ post, onClose, onCommentAdded }: CommentsSheetProps) {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [body, setBody] = useState("");
  const [friendlyError, setFriendlyError] = useState("");
  const postId = post?.id ?? "";

  const comments = useQuery({
    queryKey: BUDS_KEYS.comments(postId),
    queryFn: () => budsService.getComments(postId),
    enabled: Boolean(postId),
    staleTime: 30_000,
  });

  const addComment = useMutation({
    mutationFn: (nextBody: string) => budsService.addComment(postId, nextBody),
    onSuccess: (comment) => {
      queryClient.setQueryData<PostComment[]>(BUDS_KEYS.comments(postId), (current = []) => [
        ...current,
        comment,
      ]);
      setBody("");
      setFriendlyError("");
      onCommentAdded(postId);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: () => {
      setFriendlyError("That did not post. Keep comments supportive and free of financial details, then try again.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },
  });

  useEffect(() => {
    if (!postId) {
      setBody("");
      setFriendlyError("");
    }
  }, [postId]);

  const submit = () => {
    const cleaned = body.trim();
    if (!cleaned || addComment.isPending) return;
    setFriendlyError("");
    addComment.mutate(cleaned);
  };

  return (
    <Modal visible={Boolean(post)} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable accessibilityLabel="Close comments" style={styles.scrim} onPress={onClose} />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 12) }]}
        >
          <View style={styles.grabber} />
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Comments</Text>
              <Text style={styles.subtitle}>Keep the celebration useful and kind.</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Close comments" style={styles.close} onPress={onClose}>
              <Icon name="x" size={20} color={Colors.navy} />
            </Pressable>
          </View>

          {comments.isLoading ? (
            <View style={styles.centerState}>
              <ActivityIndicator color={Colors.gold} />
              <Text style={styles.stateBody}>Loading the encouragement…</Text>
            </View>
          ) : comments.isError ? (
            <View style={styles.centerState}>
              <Icon name="alert-circle" size={24} color={Colors.gold} />
              <Text style={styles.stateTitle}>Comments took a detour</Text>
              <Pressable style={styles.retryButton} onPress={() => comments.refetch()}>
                <Text style={styles.retryText}>Try again</Text>
              </Pressable>
            </View>
          ) : (
            <FlatList
              data={comments.data ?? []}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.list}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <View style={styles.centerState}>
                  <View style={styles.emptyIcon}><Icon name="message-circle" size={23} color={Colors.gold} /></View>
                  <Text style={styles.stateTitle}>Start the encouragement</Text>
                  <Text style={styles.stateBody}>A short, real note beats a wall of emojis.</Text>
                </View>
              }
              renderItem={({ item }) => <CommentRow comment={item} />}
            />
          )}

          <View style={styles.composer}>
            {friendlyError ? <Text style={styles.error}>{friendlyError}</Text> : null}
            <View style={styles.inputRow}>
              <TextInput
                accessibilityLabel="Write a supportive comment"
                value={body}
                onChangeText={(value) => setBody(value.slice(0, 280))}
                placeholder="Add something supportive…"
                placeholderTextColor={Colors.muted}
                style={styles.input}
                multiline
                maxLength={280}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Post comment"
                accessibilityState={{ disabled: !body.trim() || addComment.isPending }}
                disabled={!body.trim() || addComment.isPending}
                style={[styles.send, (!body.trim() || addComment.isPending) && styles.sendDisabled]}
                onPress={submit}
              >
                {addComment.isPending ? <ActivityIndicator size="small" color={Colors.onAccent} /> : <Icon name="arrow-up-right" size={20} color={Colors.onAccent} strokeWidth={2.5} />}
              </Pressable>
            </View>
            <Text style={styles.counter}>{body.length}/280 · No balances or exact amounts</Text>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

function CommentRow({ comment }: { comment: PostComment }) {
  return (
    <View style={styles.commentRow}>
      <BudAvatar
        name={comment.user.displayName}
        initials={comment.user.initials}
        avatar={comment.user.avatar}
        avatarAsset={comment.user.avatarAsset}
        size={38}
      />
      <View style={styles.commentBubble}>
        <View style={styles.commentMeta}>
          <Text style={styles.commentName}>{comment.user.displayName}</Text>
          <Text style={styles.commentTime}>{relativeCommentTime(comment.timestamp)}</Text>
        </View>
        <Text style={styles.commentBody}>{comment.body}</Text>
      </View>
    </View>
  );
}

function relativeCommentTime(timestamp: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(timestamp).getTime()) / 60_000));
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h`;
  return `${Math.floor(minutes / 1440)}d`;
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end" },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.58)" },
  sheet: {
    height: "78%",
    backgroundColor: Colors.card,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: "hidden",
  },
  grabber: { alignSelf: "center", width: 44, height: 5, borderRadius: 3, backgroundColor: Colors.border, marginTop: 9 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border },
  title: { ...Type.h2, color: Colors.navy },
  subtitle: { ...Type.caption, color: Colors.muted, marginTop: 2 },
  close: { width: 44, height: 44, borderRadius: Radius.pill, alignItems: "center", justifyContent: "center", backgroundColor: Colors.navy50 },
  list: { padding: Spacing.lg, gap: Spacing.md, flexGrow: 1 },
  centerState: { flex: 1, minHeight: 200, alignItems: "center", justifyContent: "center", padding: Spacing.xl, gap: 9 },
  emptyIcon: { width: 52, height: 52, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: Colors.accentAlpha12 },
  stateTitle: { ...Type.h3, color: Colors.navy, textAlign: "center" },
  stateBody: { ...Type.body, color: Colors.muted, textAlign: "center" },
  retryButton: { minHeight: 44, justifyContent: "center", paddingHorizontal: 18, borderRadius: Radius.pill, backgroundColor: Colors.accentAlpha12 },
  retryText: { ...Type.bodyStrong, color: Colors.gold },
  commentRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  commentBubble: { flex: 1, borderRadius: Radius.lg, borderTopLeftRadius: Radius.xs, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, padding: 12, gap: 4 },
  commentMeta: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  commentName: { ...Type.caption, fontWeight: "800", color: Colors.navy },
  commentTime: { ...Type.micro, color: Colors.muted },
  commentBody: { ...Type.body, color: Colors.navyMuted },
  composer: { paddingHorizontal: Spacing.md, paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.card },
  error: { ...Type.caption, color: Colors.coral, lineHeight: 17, marginBottom: 8 },
  inputRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  input: { flex: 1, minHeight: 46, maxHeight: 100, borderRadius: 18, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface, color: Colors.navy, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14 },
  send: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center", backgroundColor: Colors.gold },
  sendDisabled: { opacity: 0.35 },
  counter: { ...Type.micro, color: Colors.muted, textAlign: "right", letterSpacing: 0, marginTop: 6 },
});

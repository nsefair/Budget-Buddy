import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { requireOptionalNativeModule } from "expo-modules-core";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

import { CachedImage } from "@/components/CachedImage";
import { Icon, type IconName } from "@/components/Icon";
import { Colors } from "@/constants/colors";
import { Radius, Shadow, Spacing, Type } from "@/constants/tokens";
import type { FeedPost, ShareableAchievement } from "@/mock/buds";
import { BUDS_KEYS, budsService } from "@/services/budsService";

type AchievementKind = ShareableAchievement["kind"];

interface PreparedImage {
  uri: string;
  width: number;
  height: number;
  fileName: string;
  mimeType: "image/jpeg";
}

interface PostComposerProps {
  visible: boolean;
  onClose: () => void;
  onShared: (post: FeedPost) => void;
}

const KINDS: Array<{ kind: AchievementKind; label: string; icon: IconName }> = [
  { kind: "quest", label: "Quest", icon: "target" },
  { kind: "goal", label: "Goal", icon: "goal" },
  { kind: "score", label: "Score", icon: "bar-chart" },
  { kind: "league", label: "League", icon: "trophy" },
];

const sensitiveCaption = /(\$|£|€|\b\d[\d,.]*\s*(dollars?|bucks?|usd)\b|\bbalance\b|\btransaction\b|\bincome\b|\bdebt\b|\bsalary\b|\bpaycheck\b)/i;

export function PostComposer({ visible, onClose, onShared }: PostComposerProps) {
  const insets = useSafeAreaInsets();
  const [kind, setKind] = useState<AchievementKind>("quest");
  const [selectedRef, setSelectedRef] = useState("");
  const [caption, setCaption] = useState("");
  const [images, setImages] = useState<PreparedImage[]>([]);
  const [visibility, setVisibility] = useState<"buds" | "private">("buds");
  const [commentsEnabled, setCommentsEnabled] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [friendlyError, setFriendlyError] = useState("");

  const achievements = useQuery({
    queryKey: BUDS_KEYS.achievements(),
    queryFn: budsService.getShareableAchievements,
    enabled: visible,
    staleTime: 30_000,
  });

  const matchingAchievements = useMemo(
    () => (achievements.data ?? []).filter((achievement) => achievement.kind === kind),
    [achievements.data, kind],
  );
  const selectedAchievement = useMemo(
    () => matchingAchievements.find((achievement) => achievement.refId === selectedRef) ?? matchingAchievements[0],
    [matchingAchievements, selectedRef],
  );

  useEffect(() => {
    if (matchingAchievements.length > 0 && !matchingAchievements.some((item) => item.refId === selectedRef)) {
      setSelectedRef(matchingAchievements[0].refId);
    }
  }, [matchingAchievements, selectedRef]);

  useEffect(() => {
    if (!visible) {
      setCaption("");
      setImages([]);
      setVisibility("buds");
      setCommentsEnabled(true);
      setFriendlyError("");
      setSharing(false);
    }
  }, [visible]);

  const pickImages = async () => {
    if (images.length >= 4) return;
    try {
      if (
        !requireOptionalNativeModule("ExponentImagePicker") ||
        !requireOptionalNativeModule("ExpoImageManipulator")
      ) {
        Alert.alert(
          "Photo sharing needs the latest build",
          "Install the refreshed Budget Buddy development build, then reopen the app. Your feed will keep working in the meantime.",
        );
        return;
      }

      const [ImagePicker, ImageManipulator] = await Promise.all([
        import("expo-image-picker"),
        import("expo-image-manipulator"),
      ]);
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          "Photo access is off",
          "Budget Buddy only uses photos you choose. Turn on photo access in Settings to add one to this win.",
        );
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsMultipleSelection: true,
        selectionLimit: 4 - images.length,
        quality: 0.9,
        orderedSelection: true,
      });
      if (result.canceled) return;

      const prepared = await Promise.all(
        result.assets.slice(0, 4 - images.length).map(async (asset, index) => {
          const landscape = asset.width >= asset.height;
          const resize = landscape
            ? { width: Math.min(asset.width, 1800) }
            : { height: Math.min(asset.height, 1800) };
          const context = ImageManipulator.ImageManipulator.manipulate(asset.uri);
          try {
            context.resize(resize);
            const rendered = await context.renderAsync();
            try {
              const converted = await rendered.saveAsync({
                compress: 0.86,
                format: ImageManipulator.SaveFormat.JPEG,
              });
              return {
                uri: converted.uri,
                width: converted.width,
                height: converted.height,
                fileName: `buds-${Date.now()}-${index}.jpg`,
                mimeType: "image/jpeg" as const,
              };
            } finally {
              rendered.release();
            }
          } finally {
            context.release();
          }
        }),
      );
      setImages((current) => [...current, ...prepared].slice(0, 4));
      Haptics.selectionAsync();
    } catch {
      setFriendlyError("Those photos could not be prepared. Your feed is safe—try another image or reinstall the latest development build.");
    }
  };

  const share = async () => {
    if (!selectedAchievement || sharing) return;
    const cleanCaption = caption.trim();
    if (sensitiveCaption.test(cleanCaption)) {
      setFriendlyError("Keep balances, transactions, income, debt, and exact amounts private. Share the win—not the number behind it.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    setSharing(true);
    setFriendlyError("");
    try {
      const uploaded = await Promise.all(images.map((image) => budsService.uploadMedia(image)));
      const post = await budsService.sharePost({
        type: typeForAchievement(selectedAchievement.kind),
        title: selectedAchievement.title,
        message: cleanCaption,
        visibility,
        commentsEnabled,
        mediaIds: uploaded.map((media) => media.id),
        achievementKind: selectedAchievement.kind,
        achievementRefId: selectedAchievement.refId,
        localMedia: images,
      });
      onShared(post);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onClose();
    } catch {
      setFriendlyError("That win did not post yet. Your photos and privacy choice are still here—try again in a moment.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSharing(false);
    }
  };

  const canShare = Boolean(selectedAchievement) && (caption.trim().length > 0 || images.length > 0) && !sharing;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="Close new win" />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 10) }]}
        >
          <View style={styles.grabber} />
          <View style={styles.topBar}>
            <Pressable accessibilityRole="button" accessibilityLabel="Close new win" style={styles.closeButton} onPress={onClose}>
              <Icon name="x" size={21} color={Colors.navy} />
            </Pressable>
            <Text style={styles.heading}>New win</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Share this win"
              accessibilityState={{ disabled: !canShare }}
              disabled={!canShare}
              style={[styles.shareButton, !canShare && styles.shareButtonDisabled]}
              onPress={share}
            >
              {sharing ? <ActivityIndicator size="small" color={Colors.onAccent} /> : <Text style={styles.shareText}>Share</Text>}
            </Pressable>
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.content}
          >
            <View style={styles.privacyHero}>
              <View style={styles.privacyIcon}><Icon name="shield-check" size={25} color={Colors.gold} strokeWidth={2.4} /></View>
              <View style={styles.privacyCopy}>
                <Text style={styles.privacyTitle}>You choose what leaves your wallet</Text>
                <Text style={styles.privacyBody}>No balances, transactions, or exact amounts.</Text>
              </View>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.kindRow}>
              {KINDS.map((item) => {
                const selected = item.kind === kind;
                const hasItems = (achievements.data ?? []).some((achievement) => achievement.kind === item.kind);
                return (
                  <Pressable
                    key={item.kind}
                    disabled={!hasItems}
                    accessibilityRole="button"
                    accessibilityState={{ selected, disabled: !hasItems }}
                    style={[styles.kindButton, selected && styles.kindButtonSelected, !hasItems && styles.kindButtonDisabled]}
                    onPress={() => {
                      setKind(item.kind);
                      setSelectedRef("");
                      Haptics.selectionAsync();
                    }}
                  >
                    <Icon name={item.icon} size={16} color={selected ? Colors.gold : Colors.muted} />
                    <Text style={[styles.kindText, selected && styles.kindTextSelected]}>{item.label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Verified achievement</Text>
              {achievements.isLoading ? (
                <View style={styles.achievementLoading}>
                  <ActivityIndicator color={Colors.gold} />
                  <Text style={styles.helper}>Checking your latest wins…</Text>
                </View>
              ) : achievements.isError ? (
                <Pressable style={styles.achievementEmpty} onPress={() => achievements.refetch()}>
                  <Text style={styles.achievementEmptyTitle}>Bud could not check your wins</Text>
                  <Text style={styles.helper}>Tap to try again.</Text>
                </Pressable>
              ) : matchingAchievements.length === 0 ? (
                <View style={styles.achievementEmpty}>
                  <Text style={styles.achievementEmptyTitle}>No verified {kind} win yet</Text>
                  <Text style={styles.helper}>Finish one in Budget Buddy and it will appear here automatically.</Text>
                </View>
              ) : (
                <View style={styles.achievementOptions}>
                  {matchingAchievements.slice(0, 3).map((achievement) => {
                    const selected = achievement.refId === selectedAchievement?.refId;
                    return (
                      <Pressable
                        key={`${achievement.kind}:${achievement.refId}:${achievement.title}`}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        style={[styles.achievementOption, selected && styles.achievementOptionSelected]}
                        onPress={() => setSelectedRef(achievement.refId)}
                      >
                        <View style={styles.achievementIcon}><Icon name="shield-check" size={20} color={Colors.gold} /></View>
                        <View style={styles.achievementText}>
                          <Text style={styles.achievementTitle}>{achievement.title}</Text>
                          <Text style={styles.achievementMeta}>{achievement.label}</Text>
                        </View>
                        {selected ? <Icon name="check-circle" size={19} color={Colors.gold} /> : null}
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Caption</Text>
              <View style={styles.captionBox}>
                <TextInput
                  accessibilityLabel="Post caption"
                  value={caption}
                  onChangeText={(value) => setCaption(value.slice(0, 280))}
                  placeholder="Say something about this win…"
                  placeholderTextColor={Colors.muted}
                  multiline
                  maxLength={280}
                  style={styles.captionInput}
                />
                <Text style={styles.captionCount}>{caption.length}/280</Text>
              </View>
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionLabel}>Photos</Text>
                <Text style={styles.helper}>{images.length}/4</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mediaRow}>
                {images.map((image, index) => (
                  <View key={image.uri} style={styles.mediaThumb}>
                    <CachedImage source={{ uri: image.uri }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" />
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Remove photo ${index + 1}`}
                      style={styles.removeMedia}
                      onPress={() => setImages((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                    >
                      <Icon name="x" size={15} color={Colors.white} />
                    </Pressable>
                    <View style={styles.mediaNumber}><Text style={styles.mediaNumberText}>{index + 1}</Text></View>
                  </View>
                ))}
                {images.length < 4 ? (
                  <Pressable accessibilityRole="button" accessibilityLabel="Add photos" style={styles.addMedia} onPress={pickImages}>
                    <View style={styles.addMediaIcon}><Icon name="plus" size={22} color={Colors.gold} strokeWidth={2.6} /></View>
                    <Text style={styles.addMediaText}>Add up to 4</Text>
                  </Pressable>
                ) : null}
              </ScrollView>
              <Text style={styles.helper}>Photos stay prominent; your private numbers stay out.</Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Audience</Text>
              <View style={styles.segmented}>
                <AudienceButton
                  label="Buds"
                  icon="users"
                  selected={visibility === "buds"}
                  onPress={() => setVisibility("buds")}
                />
                <AudienceButton
                  label="Only me"
                  icon="lock"
                  selected={visibility === "private"}
                  onPress={() => setVisibility("private")}
                />
              </View>
            </View>

            <View style={styles.commentsRow}>
              <View style={styles.commentsCopy}>
                <Text style={styles.commentsTitle}>Comments</Text>
                <Text style={styles.helper}>Keep it supportive</Text>
              </View>
              <Switch
                accessibilityLabel="Allow comments"
                value={commentsEnabled}
                onValueChange={setCommentsEnabled}
                trackColor={{ false: Colors.border, true: Colors.gold }}
                thumbColor={Colors.white}
              />
            </View>

            {friendlyError ? (
              <View style={styles.errorBox}>
                <Icon name="alert-circle" size={17} color={Colors.coral} />
                <Text style={styles.errorText}>{friendlyError}</Text>
              </View>
            ) : null}
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

function AudienceButton({
  label,
  icon,
  selected,
  onPress,
}: {
  label: string;
  icon: IconName;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[styles.audienceButton, selected && styles.audienceButtonSelected]}
      onPress={onPress}
    >
      <Icon name={icon} size={18} color={selected ? Colors.gold : Colors.muted} />
      <Text style={[styles.audienceText, selected && styles.audienceTextSelected]}>{label}</Text>
    </Pressable>
  );
}

function typeForAchievement(kind: AchievementKind): FeedPost["type"] {
  switch (kind) {
    case "goal": return "goal_milestone";
    case "score": return "score_milestone";
    case "league": return "league_progress";
    default: return "quest_complete";
  }
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end" },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.66)" },
  sheet: {
    height: "94%",
    backgroundColor: Colors.card,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: "hidden",
    ...Shadow.lg,
  },
  grabber: { alignSelf: "center", width: 44, height: 5, borderRadius: 3, backgroundColor: Colors.border, marginTop: 9 },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: Spacing.md, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  closeButton: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: Colors.navy50 },
  heading: { ...Type.h2, color: Colors.navy },
  shareButton: { minWidth: 76, height: 44, borderRadius: 16, alignItems: "center", justifyContent: "center", paddingHorizontal: 16, backgroundColor: Colors.gold },
  shareButtonDisabled: { opacity: 0.35 },
  shareText: { ...Type.bodyStrong, color: Colors.onAccent },
  content: { padding: Spacing.lg, paddingBottom: 36, gap: Spacing.lg },
  privacyHero: { flexDirection: "row", alignItems: "center", gap: 12, padding: Spacing.md, borderRadius: Radius.xl, backgroundColor: Colors.accentAlpha07, borderWidth: 1, borderColor: Colors.accentAlpha20 },
  privacyIcon: { width: 48, height: 48, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: Colors.accentAlpha12 },
  privacyCopy: { flex: 1, gap: 2 },
  privacyTitle: { ...Type.bodyStrong, color: Colors.navy },
  privacyBody: { ...Type.caption, color: Colors.muted },
  kindRow: { gap: 8 },
  kindButton: { minHeight: 44, borderRadius: 14, flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 14, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
  kindButtonSelected: { borderColor: Colors.gold, backgroundColor: Colors.accentAlpha10 },
  kindButtonDisabled: { opacity: 0.34 },
  kindText: { ...Type.caption, color: Colors.muted },
  kindTextSelected: { color: Colors.gold, fontWeight: "800" },
  section: { gap: 9 },
  sectionHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionLabel: { ...Type.bodyStrong, color: Colors.navy },
  helper: { ...Type.caption, color: Colors.muted, lineHeight: 17 },
  achievementLoading: { minHeight: 82, borderRadius: Radius.lg, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
  achievementEmpty: { minHeight: 82, borderRadius: Radius.lg, justifyContent: "center", gap: 4, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
  achievementEmptyTitle: { ...Type.bodyStrong, color: Colors.navy },
  achievementOptions: { gap: 8 },
  achievementOption: { minHeight: 72, flexDirection: "row", alignItems: "center", gap: 11, padding: 12, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
  achievementOptionSelected: { borderColor: Colors.accentAlpha45, backgroundColor: Colors.accentAlpha07 },
  achievementIcon: { width: 42, height: 42, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: Colors.accentAlpha12 },
  achievementText: { flex: 1, minWidth: 0, gap: 2 },
  achievementTitle: { ...Type.bodyStrong, color: Colors.navy },
  achievementMeta: { ...Type.caption, color: Colors.gold },
  captionBox: { minHeight: 132, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface, padding: 14 },
  captionInput: { minHeight: 88, color: Colors.navy, fontSize: 15, lineHeight: 21, textAlignVertical: "top" },
  captionCount: { ...Type.micro, color: Colors.muted, textAlign: "right", letterSpacing: 0 },
  mediaRow: { gap: 10 },
  mediaThumb: { width: 112, height: 140, borderRadius: Radius.lg, overflow: "hidden", backgroundColor: Colors.navy50, borderWidth: 1, borderColor: Colors.border },
  removeMedia: { position: "absolute", right: 6, top: 6, width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.68)" },
  mediaNumber: { position: "absolute", left: 7, bottom: 7, width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.68)" },
  mediaNumberText: { ...Type.micro, color: Colors.white },
  addMedia: { width: 132, height: 140, borderRadius: Radius.lg, alignItems: "center", justifyContent: "center", gap: 9, borderWidth: 1.5, borderStyle: "dashed", borderColor: Colors.accentAlpha40, backgroundColor: Colors.accentAlpha03 },
  addMediaIcon: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: Colors.gold },
  addMediaText: { ...Type.caption, color: Colors.navyMuted },
  segmented: { flexDirection: "row", minHeight: 54, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, overflow: "hidden", backgroundColor: Colors.surface },
  audienceButton: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  audienceButtonSelected: { backgroundColor: Colors.accentAlpha12, borderWidth: 1, borderColor: Colors.gold, borderRadius: Radius.lg },
  audienceText: { ...Type.bodyStrong, color: Colors.muted },
  audienceTextSelected: { color: Colors.navy },
  commentsRow: { minHeight: 64, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 2 },
  commentsCopy: { gap: 2 },
  commentsTitle: { ...Type.bodyStrong, color: Colors.navy },
  errorBox: { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 12, borderRadius: Radius.md, backgroundColor: Colors.coral50, borderWidth: 1, borderColor: Colors.coral100 },
  errorText: { ...Type.caption, color: Colors.coral600, flex: 1, lineHeight: 17 },
});

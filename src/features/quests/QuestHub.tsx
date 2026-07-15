import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";

import { FadeInUp, PressableScale, Stagger } from "@/animations";
import { BrandLogo } from "@/components/BrandLogo";
import { Icon } from "@/components/Icon";
import { Colors } from "@/constants/colors";
import { Radius, Shadow, Spacing, Type } from "@/constants/tokens";
import { useUser } from "@/hooks/useAuth";
import type { Quest, QuestCheckInResult } from "@/features/quests/types";
import {
  questCheckInMessage,
  useQuestDashboard,
} from "@/features/quests/useQuestDashboard";

export function QuestHub() {
  const {
    data,
    isLoading,
    isError,
    refetch,
    checkIn,
    checkingIn,
    checkingInQuestId,
  } = useQuestDashboard();
  const [selectedQuestId, setSelectedQuestId] = useState<string | null>(null);
  const [reward, setReward] = useState<QuestCheckInResult | null>(null);
  const [verificationNotice, setVerificationNotice] = useState<string | null>(null);

  const selectedQuest = useMemo(
    () => data?.quests.find((quest) => quest.id === selectedQuestId) ?? null,
    [data?.quests, selectedQuestId]
  );

  const handleCheckIn = async (quest: Quest) => {
    try {
      const result = await checkIn(quest.id);
      setVerificationNotice(null);
      if (result.alreadyCheckedIn) {
        await Haptics.selectionAsync();
      } else if (result.quest.status === "completed") {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setReward(result);
      } else {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (error) {
      setVerificationNotice(questCheckInMessage(error));
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  if (isLoading) return <QuestHubLoading />;

  if (isError || !data) {
    return (
      <View style={styles.errorCard} accessibilityRole="alert">
        <View style={styles.errorIcon}>
          <Icon name="sparkles" size={20} color={Colors.gold} />
        </View>
        <View style={styles.errorCopy}>
          <Text style={styles.errorTitle}>This week is still getting ready.</Text>
          <Text style={styles.errorBody}>Give Bud one more second to shuffle your quests.</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Try loading weekly quests again"
          onPress={() => refetch()}
          style={styles.retryButton}
        >
          <Text style={styles.retryText}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.hub}>
      {reward ? (
        <RewardBanner reward={reward} onDismiss={() => setReward(null)} />
      ) : null}
      {verificationNotice ? (
        <VerificationNotice
          message={verificationNotice}
          onDismiss={() => setVerificationNotice(null)}
        />
      ) : null}

      <FadeInUp>
        <ProgressHeader leagueTier={data.score.leagueTier} />
      </FadeInUp>

      <View style={styles.sectionHeading}>
        <View>
          <Text style={styles.sectionEyebrow}>THIS WEEK</Text>
          <Text style={styles.sectionTitle}>Three moves. Your pace.</Text>
        </View>
        <View style={styles.resetPill}>
          <Icon name="calendar" size={13} color={Colors.navyMuted} />
          <Text style={styles.resetText}>{resetLabel(data.resetDate)}</Text>
        </View>
      </View>

      <Stagger gap={70}>
        {data.quests.map((quest) => (
          <WeeklyQuestCard
            key={quest.id}
            quest={quest}
            isCheckingIn={checkingIn && checkingInQuestId === quest.id}
            onDetails={() => setSelectedQuestId(quest.id)}
            onCheckIn={() => handleCheckIn(quest)}
          />
        ))}
      </Stagger>

      <QuestDetailSheet
        quest={selectedQuest}
        isCheckingIn={checkingIn && checkingInQuestId === selectedQuest?.id}
        onClose={() => setSelectedQuestId(null)}
        onCheckIn={handleCheckIn}
      />
    </View>
  );
}

/**
 * Compact gamification header — level, XP, and league tier in one quiet row.
 * All the game state lives here on Quests; the Today tab keeps only the
 * Financial Health score.
 */
function ProgressHeader({ leagueTier }: { leagueTier: string }) {
  const user = useUser();
  if (!user) return null;

  const xpProgress =
    user.xpToNextLevel > 0
      ? Math.max(0, Math.min(1, user.xp / user.xpToNextLevel))
      : 0;

  return (
    <View style={styles.progressHeader}>
      <View style={styles.levelBadge}>
        <LinearGradient colors={[Colors.gold400, Colors.gold600]} style={styles.levelBadgeInner}>
          <Text style={styles.levelBadgeText}>{user.level}</Text>
        </LinearGradient>
        <Text style={styles.levelBadgeLabel}>LEVEL</Text>
      </View>
      <View style={styles.xpBlock}>
        <View style={styles.xpLabelRow}>
          <Text style={styles.xpLabel}>
            {user.xp.toLocaleString()} / {user.xpToNextLevel.toLocaleString()} XP
          </Text>
          <View style={styles.leagueChip}>
            <Icon name="trophy" size={12} color={Colors.gold} strokeWidth={2.4} />
            <Text style={styles.leagueChipText}>{leagueTier}</Text>
          </View>
        </View>
        <View style={styles.xpTrack}>
          <View style={[styles.xpFill, { width: `${Math.max(3, xpProgress * 100)}%` }]} />
        </View>
      </View>
    </View>
  );
}

function WeeklyQuestCard({
  quest,
  isCheckingIn,
  onDetails,
  onCheckIn,
}: {
  quest: Quest;
  isCheckingIn: boolean;
  onDetails: () => void;
  onCheckIn: () => void;
}) {
  const completed = quest.status === "completed";
  const actionDisabled = completed || quest.checkedInToday || isCheckingIn;

  return (
    <View style={[styles.questCard, completed && styles.questCardComplete]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open quest details for ${quest.title}`}
        onPress={onDetails}
        style={({ pressed }) => [styles.questCardMain, pressed && styles.pressed]}
      >
        <View style={styles.questCardTop}>
          <View style={[styles.questIcon, completed && styles.questIconComplete]}>
            <Icon
              name={completed ? "check-circle" : quest.iconName}
              size={21}
              color={completed ? Colors.emerald : Colors.gold}
              strokeWidth={2.3}
            />
          </View>
          <View style={styles.questTitleWrap}>
            <Text style={styles.questTitle}>{quest.title}</Text>
            <Text style={styles.questMeta}>
              {quest.progress} of {quest.total} {quest.unit} · {quest.xpReward} XP
            </Text>
          </View>
          <Icon name="chevron-right" size={18} color={Colors.muted} />
        </View>
        <ProgressTrack progress={quest.progress} total={quest.total} complete={completed} />
        <View style={styles.questWhyPanel}>
          <View style={styles.questWhyHeader}>
            <Text style={styles.questWhyLabel}>WHY THIS MATTERS</Text>
            <View style={styles.verificationBadge}>
              <Icon
                name={quest.verificationType === "self_report" ? "check-circle" : "shield-check"}
                size={11}
                color={Colors.teal}
              />
              <Text style={styles.verificationBadgeText}>
                {quest.verificationType === "self_report" ? "CHECK-IN" : "BUD VERIFIED"}
              </Text>
            </View>
          </View>
          <Text style={styles.questWhy}>{quest.whyItMatters}</Text>
        </View>
      </Pressable>

      <View style={styles.questFooter}>
        <View style={styles.scoreImpactPill}>
          <Icon name="activity" size={13} color={Colors.teal} />
          <Text style={styles.scoreImpactText}>up to +{quest.scoreImpact} score</Text>
        </View>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={
            completed
              ? `${quest.title} completed`
              : quest.checkedInToday
                ? `${quest.title} checked in today`
                : quest.checkInLabel
          }
          disabled={actionDisabled}
          onPress={onCheckIn}
          style={[
            styles.checkInButton,
            actionDisabled && styles.checkInButtonDisabled,
            completed && styles.checkInButtonComplete,
          ]}
        >
          <View style={styles.checkInButtonContent}>
            {isCheckingIn ? (
              <ActivityIndicator size="small" color={Colors.onAction} />
            ) : (
              <>
                <Icon
                  name={completed || quest.checkedInToday ? "check" : "plus"}
                  size={15}
                  color={completed ? Colors.emerald : actionDisabled ? Colors.navyMuted : Colors.onAction}
                  strokeWidth={2.8}
                />
                <Text
                  style={[
                    styles.checkInButtonText,
                    actionDisabled && styles.checkInButtonTextDisabled,
                    completed && { color: Colors.emerald },
                  ]}
                >
                  {completed
                    ? "Complete"
                    : quest.checkedInToday
                      ? quest.verificationType === "self_report" ? "Checked in" : "Verified"
                      : quest.checkInLabel}
                </Text>
              </>
            )}
          </View>
        </PressableScale>
      </View>
    </View>
  );
}

function QuestDetailSheet({
  quest,
  isCheckingIn,
  onClose,
  onCheckIn,
}: {
  quest: Quest | null;
  isCheckingIn: boolean;
  onClose: () => void;
  onCheckIn: (quest: Quest) => void;
}) {
  if (!quest) return null;
  const disabled = quest.status === "completed" || quest.checkedInToday || isCheckingIn;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close quest details"
          style={styles.modalBackdrop}
          onPress={onClose}
        />
        <View style={styles.detailSheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.detailTop}>
            <View style={styles.detailIcon}>
              <Icon name={quest.iconName} size={24} color={Colors.gold} />
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close quest details"
              hitSlop={10}
              onPress={onClose}
              style={styles.closeButton}
            >
              <Icon name="x" size={18} color={Colors.navyMuted} />
            </Pressable>
          </View>
          <Text style={styles.detailEyebrow}>WEEKLY QUEST</Text>
          <Text style={styles.detailTitle}>{quest.title}</Text>
          <Text style={styles.detailWhy}>{quest.whyItMatters}</Text>

          <View style={styles.detailInstruction}>
            <BrandLogo variant="mark" markSize={34} />
            <View style={styles.detailInstructionCopy}>
              <Text style={styles.detailInstructionLabel}>How it works</Text>
              <Text style={styles.detailInstructionText}>{quest.instructions}</Text>
            </View>
          </View>

          <View style={styles.detailVerification}>
            <Icon
              name={quest.verificationType === "self_report" ? "check-circle" : "shield-check"}
              size={17}
              color={Colors.teal}
            />
            <View style={styles.detailVerificationCopy}>
              <Text style={styles.detailVerificationLabel}>
                {quest.verificationType === "self_report" ? "Your check-in" : "Bud verifies this"}
              </Text>
              <Text style={styles.detailVerificationText}>{quest.verificationDescription}</Text>
            </View>
          </View>

          <ProgressTrack progress={quest.progress} total={quest.total} complete={quest.status === "completed"} />
          <View style={styles.detailRewards}>
            <View style={styles.detailRewardItem}>
              <Icon name="zap" size={16} color={Colors.gold} />
              <Text style={styles.detailRewardText}>{quest.xpReward} XP</Text>
            </View>
            <View style={styles.detailRewardItem}>
              <Icon name="activity" size={16} color={Colors.teal} />
              <Text style={styles.detailRewardText}>up to +{quest.scoreImpact} score</Text>
            </View>
          </View>

          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={quest.checkInLabel}
            disabled={disabled}
            onPress={() => onCheckIn(quest)}
            style={[styles.detailAction, disabled && styles.detailActionDisabled]}
          >
            <View style={styles.detailActionContent}>
              {isCheckingIn ? (
                <ActivityIndicator color={Colors.onAction} />
              ) : (
                <>
                  <Icon name={disabled ? "check" : "plus"} size={18} color={disabled ? Colors.navyMuted : Colors.onAction} />
                  <Text style={[styles.detailActionText, disabled && { color: Colors.navyMuted }]}>
                    {quest.status === "completed"
                      ? "Quest complete"
                      : quest.checkedInToday
                        ? quest.verificationType === "self_report"
                          ? "Today's check-in is saved"
                          : "Bud verified this activity"
                        : quest.checkInLabel}
                  </Text>
                </>
              )}
            </View>
          </PressableScale>
        </View>
      </View>
    </Modal>
  );
}

function RewardBanner({ reward, onDismiss }: { reward: QuestCheckInResult; onDismiss: () => void }) {
  return (
    <FadeInUp>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Dismiss quest completion message"
        onPress={onDismiss}
        style={styles.rewardBanner}
      >
        <View style={styles.rewardIcon}>
          <Icon name="trophy" size={20} color={Colors.onAction} />
        </View>
        <View style={styles.rewardCopy}>
          <Text style={styles.rewardTitle}>That one counts.</Text>
          <Text style={styles.rewardBody}>
            +{reward.xpEarned} XP · score now {reward.score.value}
          </Text>
        </View>
        <Icon name="x" size={16} color={Colors.onAction} />
      </Pressable>
    </FadeInUp>
  );
}

function VerificationNotice({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <FadeInUp>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Dismiss quest verification message"
        onPress={onDismiss}
        style={styles.verificationNotice}
      >
        <View style={styles.verificationNoticeIcon}>
          <Icon name="shield-check" size={20} color={Colors.amber} />
        </View>
        <View style={styles.rewardCopy}>
          <Text style={styles.verificationNoticeTitle}>Bud couldn't verify that yet.</Text>
          <Text style={styles.verificationNoticeBody}>{message}</Text>
        </View>
        <Icon name="x" size={16} color={Colors.navyMuted} />
      </Pressable>
    </FadeInUp>
  );
}

function ProgressTrack({
  progress,
  total,
  complete = false,
}: {
  progress: number;
  total: number;
  complete?: boolean;
}) {
  const percent = total > 0 ? Math.min(100, (progress / total) * 100) : 0;
  return (
    <View
      style={styles.progressTrack}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: total, now: progress }}
    >
      <View
        style={[
          styles.progressFill,
          complete && { backgroundColor: Colors.emerald },
          { width: `${percent}%` },
        ]}
      />
    </View>
  );
}

function QuestHubLoading() {
  return (
    <View style={styles.loadingStack}>
      <View style={styles.loadingHero}>
        <ActivityIndicator color={Colors.gold} size="large" />
        <Text style={styles.loadingHeroText}>Bud is building your week…</Text>
      </View>
      {[0, 1, 2].map((item) => (
        <View key={item} style={styles.loadingQuest} />
      ))}
    </View>
  );
}

function resetLabel(resetDate: string) {
  const reset = new Date(resetDate).getTime();
  const remaining = Math.max(0, reset - Date.now());
  const days = Math.floor(remaining / 86_400_000);
  const hours = Math.floor((remaining % 86_400_000) / 3_600_000);
  if (days > 0) return `${days}d ${hours}h left`;
  if (hours > 0) return `${hours}h left`;
  return "Resets soon";
}

const styles = StyleSheet.create({
  hub: { gap: Spacing.md, marginBottom: Spacing.xxl },
  progressHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.xl,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    ...Shadow.sm,
  },
  levelBadge: { alignItems: "center", gap: 3 },
  levelBadgeInner: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: Colors.gold,
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  levelBadgeText: { fontSize: 16, fontWeight: "800", color: Colors.onAccent },
  levelBadgeLabel: { fontSize: 9, fontWeight: "800", color: Colors.navyMuted, letterSpacing: 1.2 },
  xpBlock: { flex: 1, gap: 8 },
  xpLabelRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  xpLabel: { ...Type.caption, color: Colors.navyMuted },
  leagueChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    backgroundColor: Colors.gold50,
  },
  leagueChipText: { fontSize: 11, fontWeight: "800", color: Colors.gold600 },
  xpTrack: { height: 7, borderRadius: Radius.pill, backgroundColor: Colors.navy50, overflow: "hidden" },
  xpFill: { height: "100%", borderRadius: Radius.pill, backgroundColor: Colors.gold },
  sectionHeading: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 12, marginTop: 4 },
  sectionEyebrow: { ...Type.eyebrow, color: Colors.gold },
  sectionTitle: { ...Type.h2, color: Colors.navy, marginTop: 3 },
  resetPill: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 9, paddingVertical: 7, borderRadius: Radius.pill, backgroundColor: Colors.navy50 },
  resetText: { ...Type.micro, color: Colors.navyMuted },
  questCard: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.xl, overflow: "hidden", ...Shadow.md },
  questCardComplete: { borderColor: Colors.greenBorder, backgroundColor: Colors.greenSurface },
  questCardMain: { paddingHorizontal: Spacing.md, paddingTop: Spacing.md, paddingBottom: Spacing.lg, gap: 14 },
  pressed: { opacity: 0.78 },
  questCardTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  questIcon: { width: 44, height: 44, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: Colors.gold50 },
  questIconComplete: { backgroundColor: Colors.emerald50 },
  questTitleWrap: { flex: 1 },
  questTitle: { ...Type.h3, color: Colors.navy },
  questMeta: { ...Type.caption, color: Colors.navyMuted, marginTop: 3 },
  questWhyPanel: { paddingHorizontal: 14, paddingVertical: 13, borderRadius: Radius.md, backgroundColor: Colors.navy50, borderWidth: 1, borderColor: Colors.border, gap: 5 },
  questWhyHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  questWhyLabel: { ...Type.micro, color: Colors.gold, letterSpacing: 1.1 },
  verificationBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 7, paddingVertical: 4, borderRadius: Radius.pill, backgroundColor: Colors.greenSurface },
  verificationBadgeText: { fontSize: 8, fontWeight: "800", color: Colors.teal, letterSpacing: 0.7 },
  questWhy: { ...Type.body, color: Colors.navyMuted, lineHeight: 22 },
  progressTrack: { height: 7, borderRadius: Radius.pill, backgroundColor: Colors.navy50, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: Radius.pill, backgroundColor: Colors.gold },
  questFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, paddingHorizontal: Spacing.md, paddingVertical: 14, borderTopWidth: 1, borderTopColor: Colors.border },
  scoreImpactPill: { flexDirection: "row", alignItems: "center", gap: 5, flexShrink: 1 },
  scoreImpactText: { ...Type.caption, color: Colors.teal },
  checkInButton: { minHeight: 40, paddingHorizontal: 13, borderRadius: Radius.pill, backgroundColor: Colors.actionSurface, borderWidth: 1, borderColor: Colors.actionBorder, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  checkInButtonContent: { minHeight: 38, paddingHorizontal: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  checkInButtonDisabled: { backgroundColor: Colors.navy50, borderColor: Colors.border },
  checkInButtonComplete: { backgroundColor: Colors.emerald50, borderColor: Colors.greenBorder },
  checkInButtonText: { ...Type.caption, color: Colors.onAction },
  checkInButtonTextDisabled: { color: Colors.navyMuted },
  rewardBanner: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: Radius.lg, padding: 12, backgroundColor: Colors.actionSurface, borderWidth: 1, borderColor: Colors.actionBorder },
  rewardIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(0,0,0,0.10)", alignItems: "center", justifyContent: "center" },
  rewardCopy: { flex: 1 },
  rewardTitle: { ...Type.bodyStrong, color: Colors.onAction },
  rewardBody: { ...Type.caption, color: Colors.onAction, opacity: 0.74 },
  verificationNotice: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: Radius.lg, padding: 12, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.amber },
  verificationNoticeIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(245,158,11,0.12)", alignItems: "center", justifyContent: "center" },
  verificationNoticeTitle: { ...Type.bodyStrong, color: Colors.navy },
  verificationNoticeBody: { ...Type.caption, color: Colors.navyMuted, marginTop: 2 },
  modalRoot: { flex: 1, justifyContent: "flex-end" },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: Colors.blackOverlay },
  detailSheet: { backgroundColor: Colors.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: Spacing.lg, paddingBottom: 34, paddingTop: 10, gap: 14, ...Shadow.lg },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.navy200, alignSelf: "center", marginBottom: 4 },
  detailTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  detailIcon: { width: 50, height: 50, borderRadius: 18, backgroundColor: Colors.gold50, alignItems: "center", justifyContent: "center" },
  closeButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.navy50, alignItems: "center", justifyContent: "center" },
  detailEyebrow: { ...Type.eyebrow, color: Colors.gold },
  detailTitle: { ...Type.display, color: Colors.navy },
  detailWhy: { ...Type.body, color: Colors.navyMuted },
  detailInstruction: { flexDirection: "row", gap: 11, alignItems: "flex-start", padding: 13, borderRadius: Radius.lg, backgroundColor: Colors.greenSurface, borderWidth: 1, borderColor: Colors.greenBorder },
  detailInstructionCopy: { flex: 1 },
  detailInstructionLabel: { ...Type.caption, color: Colors.gold600 },
  detailInstructionText: { ...Type.body, color: Colors.navy, marginTop: 2 },
  detailVerification: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingHorizontal: 12, paddingVertical: 11, borderRadius: Radius.md, backgroundColor: Colors.navy50 },
  detailVerificationCopy: { flex: 1 },
  detailVerificationLabel: { ...Type.caption, color: Colors.teal },
  detailVerificationText: { ...Type.caption, color: Colors.navyMuted, marginTop: 2 },
  detailRewards: { flexDirection: "row", gap: 8 },
  detailRewardItem: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 8, borderRadius: Radius.pill, backgroundColor: Colors.navy50 },
  detailRewardText: { ...Type.caption, color: Colors.navy },
  detailAction: { minHeight: 50, borderRadius: Radius.lg, backgroundColor: Colors.actionSurface, borderWidth: 1, borderColor: Colors.actionBorder, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  detailActionContent: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  detailActionDisabled: { backgroundColor: Colors.navy50, borderColor: Colors.border },
  detailActionText: { ...Type.bodyStrong, color: Colors.onAction },
  errorCard: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.lg, padding: Spacing.md },
  errorIcon: { width: 40, height: 40, borderRadius: 15, backgroundColor: Colors.gold50, alignItems: "center", justifyContent: "center" },
  errorCopy: { flex: 1 },
  errorTitle: { ...Type.bodyStrong, color: Colors.navy },
  errorBody: { ...Type.caption, color: Colors.navyMuted },
  retryButton: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: Radius.pill, backgroundColor: Colors.navy50 },
  retryText: { ...Type.caption, color: Colors.gold },
  loadingStack: { gap: 12 },
  loadingHero: { height: 300, borderRadius: 24, backgroundColor: Colors.navy800, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingHeroText: { ...Type.body, color: Colors.brandOnDarkMuted },
  loadingQuest: { height: 180, borderRadius: Radius.xl, backgroundColor: Colors.navy50 },
});

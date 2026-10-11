/**
 * Goals Tab — matches the CEO's vision drawing.
 *
 *   • Top stats: Total Saved · Active Goals · Monthly Committed
 *   • "+ Add New Goal" CTA
 *   • Goal cards — duration pill, reason quote, progress bar, monthly + deadline
 *
 * All copy passes the dev-guide voice rules:
 *   no shame, no childish emojis, supportive coach tone.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { MotiView } from "moti";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { Colors } from "@/constants/colors";
import { TAB_BAR_HEIGHT } from "@/constants/tokens";
import { EmptyState, GradientHeader } from "@/components/ui";
import { Icon, type IconName } from "@/components/Icon";
import { CountUp, GrowBar, Stagger, useFocusReplay } from "@/animations";
import { goalsService } from "@/services/goalsService";
import { budgetService } from "@/services/budgetService";
import type { AccountSummary } from "@/mock/budget";
import {
  type Goal,
  type GoalCategoryKind,
  type GoalDuration,
  type GoalsSummary,
} from "@/mock/goals";
import { formatCurrency, secureLog } from "@/utils/security";

// ─── Static metadata for goal kinds ──────────────────────────────────────────
const KIND_META: Record<
  GoalCategoryKind,
  { label: string; icon: IconName; tint: string }
> = {
  emergency_fund: { label: "Safety", icon: "shield", tint: Colors.teal },
  debt_payoff: { label: "Debt", icon: "credit-card", tint: Colors.coral },
  savings_target: { label: "Savings", icon: "piggy-bank", tint: Colors.gold },
  invest: { label: "Investing", icon: "trending-up", tint: Colors.emerald },
  income_growth: { label: "Income", icon: "banknote", tint: Colors.emerald },
  stop_overspending: { label: "Discipline", icon: "target", tint: Colors.gold },
  custom: { label: "Custom", icon: "sparkles", tint: Colors.gold },
};

const DURATION_META: Record<
  GoalDuration,
  { label: string; tint: string }
> = {
  short: { label: "SHORT-TERM", tint: Colors.teal },
  medium: { label: "MEDIUM-TERM", tint: Colors.gold },
  long: { label: "LONG-TERM", tint: "#9AAECF" },
};

type CreateStep = "kind" | "numbers" | "why" | "review" | "success";

type GoalDraft = {
  kind: GoalCategoryKind;
  name: string;
  targetAmount: string;
  monthlyCommit: string;
  duration: GoalDuration;
  months: number;
  reason: string;
  linkedAccountId: string;
};

const CREATE_STEPS: CreateStep[] = [
  "kind",
  "numbers",
  "why",
  "review",
  "success",
];

const DEFAULT_DRAFT: GoalDraft = {
  kind: "emergency_fund",
  name: "Emergency Fund",
  targetAmount: "5000",
  monthlyCommit: "250",
  duration: "medium",
  months: 12,
  reason: "",
  linkedAccountId: "",
};

const GOAL_TEMPLATES: Array<{
  kind: GoalCategoryKind;
  title: string;
  subtitle: string;
  defaultName: string;
  defaultTarget: string;
  icon: IconName;
}> = [
  {
    kind: "emergency_fund",
    title: "Build a safety cushion",
    subtitle: "A calmer buffer for the next surprise expense.",
    defaultName: "Emergency Fund",
    defaultTarget: "5000",
    icon: "shield",
  },
  {
    kind: "debt_payoff",
    title: "Pay down a balance",
    subtitle: "Pick one debt and make the finish line visible.",
    defaultName: "Card Payoff",
    defaultTarget: "2500",
    icon: "credit-card",
  },
  {
    kind: "savings_target",
    title: "Save for something specific",
    subtitle: "A trip, a move, a laptop, or anything with a number.",
    defaultName: "Savings Target",
    defaultTarget: "3000",
    icon: "piggy-bank",
  },
  {
    kind: "invest",
    title: "Start investing",
    subtitle: "Track the habit without giving investment advice.",
    defaultName: "Investing Starter",
    defaultTarget: "1200",
    icon: "trending-up",
  },
];

const PLAN_OPTIONS: Array<{
  label: string;
  detail: string;
  duration: GoalDuration;
  months: number;
}> = [
  { label: "90 days", detail: "Fast win", duration: "short", months: 3 },
  { label: "12 months", detail: "Steady pace", duration: "medium", months: 12 },
  { label: "2 years", detail: "Bigger build", duration: "long", months: 24 },
];

export default function GoalsScreen() {
  const insets = useSafeAreaInsets();
  // Goal bars re-enter each time Goals regains focus.
  const replay = useFocusReplay();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [summary, setSummary] = useState<GoalsSummary | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const { goals, summary } = await goalsService.list();
      setGoals(goals);
      setSummary(summary);
    } catch (e) {
      secureLog.error("goals.list failed", e);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const openGoalCreator = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsCreateOpen(true);
  };

  const handleGoalCreated = (goal: Goal) => {
    setGoals((current) => [goal, ...current]);
    setSummary((current) => {
      if (!current) {
        return {
          totalSaved: goal.alreadySaved,
          totalTargetAcrossActive: goal.targetAmount,
          activeCount: 1,
          monthlyCommittedTotal: goal.monthlyCommit,
        };
      }

      return {
        totalSaved: current.totalSaved + goal.alreadySaved,
        totalTargetAcrossActive:
          current.totalTargetAcrossActive + goal.targetAmount,
        activeCount: current.activeCount + 1,
        monthlyCommittedTotal:
          current.monthlyCommittedTotal + goal.monthlyCommit,
      };
    });
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
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
        <GradientHeader
          eyebrow="GOALS"
          title="Goals"
          subtitle="What you're building, and how close it is."
          right={
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add a new goal"
              hitSlop={8}
              style={({ pressed }) => [styles.addBtn, pressed && styles.addBtnPressed]}
              onPress={openGoalCreator}
            >
              <Icon name="plus" size={16} color={Colors.gold} strokeWidth={2.8} />
              <Text style={styles.addBtnText}>New goal</Text>
            </Pressable>
          }
        />

        <View style={styles.body}>
          {/* Summary — three top stats from the CEO drawing */}
          {summary && <SummaryRow summary={summary} />}

          {/* Goal cards — staggered entrance for premium feel */}
          <View style={styles.grid}>
            <Stagger gap={80}>
              {goals.map((g) => (
                <GoalCard key={g.id} goal={g} replayKey={replay} />
              ))}
            </Stagger>
          </View>

          {goals.length === 0 && (
            <EmptyState
              icon="target"
              title="No active goals yet"
              body="Bud will help you turn the next milestone into a real, trackable goal."
            />
          )}
        </View>
      </ScrollView>

      <GoalCreationSheet
        visible={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCreated={handleGoalCreated}
        usedAccountIds={goals.flatMap((goal) =>
          goal.linkedAccountId ? [goal.linkedAccountId] : []
        )}
      />
    </View>
  );
}

// ─── Summary cards row ──────────────────────────────────────────────────────

function SummaryRow({ summary }: { summary: GoalsSummary }) {
  return (
    <View style={styles.summaryRow}>
      <SummaryCell
        label="Total saved"
        value={formatCurrency(summary.totalSaved, { compact: true })}
        sub={`of ${formatCurrency(summary.totalTargetAcrossActive, { compact: true })} target`}
      />
      <SummaryCell label="Active" value={String(summary.activeCount)} sub="goals" />
      <SummaryCell
        label="Committed"
        value={formatCurrency(summary.monthlyCommittedTotal, { compact: true })}
        sub="per month"
      />
    </View>
  );
}

function SummaryCell({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <View style={styles.summaryCell}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
        {value}
      </Text>
      <Text style={styles.summarySub} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
        {sub}
      </Text>
    </View>
  );
}

// ─── Goal card ──────────────────────────────────────────────────────────────

function GoalCard({ goal, replayKey }: { goal: Goal; replayKey: number }) {
  const meta = KIND_META[goal.kind];
  const duration = DURATION_META[goal.duration];

  const progress = useMemo(() => {
    if (goal.targetAmount === 0) return 0;
    return Math.min(1, goal.alreadySaved / goal.targetAmount);
  }, [goal.alreadySaved, goal.targetAmount]);

  const deadlineLabel = useMemo(() => {
    const d = new Date(goal.deadline);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }, [goal.deadline]);

  const pct = Math.round(progress * 100);
  const durationText = duration.label.charAt(0) + duration.label.slice(1).toLowerCase();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${goal.name}, ${pct} percent. ${formatCurrency(goal.alreadySaved)} of ${formatCurrency(goal.targetAmount)}.`}
      style={({ pressed }) => [styles.goalCard, pressed && styles.goalCardPressed]}
      onPress={() => {
        Haptics.selectionAsync();
        router.push(`/goal/${goal.id}`);
      }}
    >
      {/* Top — kind icon + name + percent */}
      <View style={styles.goalTop}>
        <View style={[styles.kindIcon, { backgroundColor: `${meta.tint}1F` }]}>
          <Icon name={meta.icon} size={18} color={meta.tint} strokeWidth={2.2} />
        </View>
        <View style={styles.goalTitle}>
          <Text style={styles.goalName} numberOfLines={1}>{goal.name}</Text>
          <Text style={styles.goalMeta} numberOfLines={1}>
            {meta.label} · {durationText}
            {goal.linkedAccountId ? " · Auto tracking" : ""}
          </Text>
        </View>
        <Text style={styles.percentText}>{pct}%</Text>
      </View>

      {/* Reason */}
      <Text style={styles.goalReason} numberOfLines={2}>
        “{goal.reason}”
      </Text>

      {/* Progress amount + animated bar */}
      <View style={styles.amountRow}>
        <CountUp
          value={goal.alreadySaved}
          from={goal.alreadySaved * 0.9}
          replayKey={replayKey}
          format={formatCurrency}
          fit
          style={styles.amountSaved}
          centsStyle={styles.amountCents}
        />
        <Text style={styles.amountTarget} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
          of {formatCurrency(goal.targetAmount)}
        </Text>
      </View>
      <GrowBar
        progress={progress}
        color={meta.tint}
        trackColor={Colors.navy50}
        height={6}
        delay={120}
        duration={700}
        replayKey={replayKey}
        style={styles.barTrack}
      />

      {/* Bottom — monthly + deadline */}
      <View style={styles.bottomRow}>
        <BottomCell
          label="Monthly"
          value={formatCurrency(goal.monthlyCommit)}
          icon="banknote"
        />
        <BottomCell label="Deadline" value={deadlineLabel} icon="calendar" />
      </View>
    </Pressable>
  );
}

function BottomCell({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: IconName;
}) {
  return (
    <View style={styles.bottomCell}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Icon name={icon} size={11} color={Colors.muted} strokeWidth={2.2} />
        <Text style={styles.bottomLabel}>{label}</Text>
      </View>
      <Text style={styles.bottomValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
        {value}
      </Text>
    </View>
  );
}

// ─── Goal creation sheet ────────────────────────────────────────────────────

function GoalCreationSheet({
  visible,
  onClose,
  onCreated,
  usedAccountIds,
}: {
  visible: boolean;
  onClose: () => void;
  onCreated: (goal: Goal) => void;
  usedAccountIds: string[];
}) {
  const [step, setStep] = useState<CreateStep>("kind");
  const [draft, setDraft] = useState<GoalDraft>(DEFAULT_DRAFT);
  const [createdGoal, setCreatedGoal] = useState<Goal | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [accounts, setAccounts] = useState<AccountSummary[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(false);

  const entrance = useRef(new Animated.Value(0)).current;
  const successPulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!visible) return;

    let alive = true;

    setStep("kind");
    setDraft(DEFAULT_DRAFT);
    setCreatedGoal(null);
    setIsSaving(false);
    entrance.setValue(0);
    Animated.spring(entrance, {
      toValue: 1,
      damping: 18,
      stiffness: 160,
      useNativeDriver: true,
    }).start();

    setAccountsLoading(true);
    budgetService
      .getAccounts()
      .then((nextAccounts) => {
        if (alive) setAccounts(nextAccounts.filter((account) => account.kind === "savings"));
      })
      .catch((error) => secureLog.warn("goals.accounts failed", error))
      .finally(() => {
        if (alive) setAccountsLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [entrance, visible]);

  useEffect(() => {
    if (step !== "success") return;

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(successPulse, {
          toValue: 1.07,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(successPulse, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
      ])
    );

    loop.start();
    return () => loop.stop();
  }, [step, successPulse]);

  const stepIndex = CREATE_STEPS.indexOf(step);
  const targetAmount = moneyFromInput(draft.targetAmount);
  const monthlyCommit = moneyFromInput(draft.monthlyCommit);
  const selectedMeta = KIND_META[draft.kind];
  const selectedPlan = PLAN_OPTIONS.find((p) => p.months === draft.months);
  const selectedAccount = accounts.find((account) => account.id === draft.linkedAccountId);

  const canContinue = useMemo(() => {
    if (step === "kind") return Boolean(draft.kind && draft.name.trim());
    if (step === "numbers") return targetAmount > 0 && monthlyCommit > 0;
    if (step === "why") return draft.reason.trim().length >= 4;
    return true;
  }, [draft.kind, draft.name, draft.reason, monthlyCommit, step, targetAmount]);

  const handleClose = () => {
    Haptics.selectionAsync();
    onClose();
  };

  const handlePrimary = async () => {
    if (!canContinue || isSaving) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    if (step === "success") {
      handleClose();
      return;
    }

    if (step !== "review") {
      Haptics.selectionAsync();
      setStep(CREATE_STEPS[stepIndex + 1]);
      return;
    }

    setIsSaving(true);
    try {
      const goal = await goalsService.create({
        name: draft.name.trim(),
        kind: draft.kind,
        duration: draft.duration,
        reason: draft.reason.trim(),
        targetAmount,
        alreadySaved: 0,
        monthlyCommit,
        deadline: deadlineFromMonths(draft.months),
        linkedAccountId: draft.linkedAccountId || undefined,
      });
      onCreated(goal);
      setCreatedGoal(goal);
      setStep("success");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      secureLog.error("goals.create failed", e);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        "Could not create goal",
        "Check the details and make sure the savings account is not linked to another goal."
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleBack = () => {
    if (step === "success") {
      handleClose();
      return;
    }
    if (stepIndex === 0) {
      handleClose();
      return;
    }
    Haptics.selectionAsync();
    setStep(CREATE_STEPS[stepIndex - 1]);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      presentationStyle="overFullScreen"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.modalRoot}
      >
        <Animated.View
          style={[
            styles.modalBackdrop,
            {
              opacity: entrance.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 1],
              }),
            },
          ]}
        />
        <Animated.View
          style={[
            styles.goalSheet,
            {
              transform: [
                {
                  translateY: entrance.interpolate({
                    inputRange: [0, 1],
                    outputRange: [36, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.sheetHandle} />
          <View style={styles.sheetTopRow}>
            <Pressable style={styles.sheetIconButton} onPress={handleBack}>
              <Icon
                name={stepIndex === 0 || step === "success" ? "x" : "arrow-left"}
                size={18}
                color={Colors.navy}
                strokeWidth={2.4}
              />
            </Pressable>
            <View style={styles.sheetStepPill}>
              <Text style={styles.sheetStepText}>
                {step === "success" ? "Goal ready" : `Step ${stepIndex + 1} of 4`}
              </Text>
            </View>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.sheetScroll}
          >
            {step === "kind" && (
              <View style={styles.sheetSection}>
                <Text style={styles.sheetEyebrow}>START WITH THE TARGET</Text>
                <Text style={styles.sheetTitle}>What are you building?</Text>
                <Text style={styles.sheetBody}>
                  Choose the closest shape. You can rename it before it goes on your
                  Goals screen.
                </Text>

                <View style={styles.templateGrid}>
                  {GOAL_TEMPLATES.map((template) => {
                    const active = draft.kind === template.kind;
                    return (
                      <Pressable
                        key={template.kind}
                        style={[
                          styles.templateCard,
                          active && styles.templateCardActive,
                        ]}
                        onPress={() => {
                          Haptics.selectionAsync();
                          setDraft((current) => ({
                            ...current,
                            kind: template.kind,
                            name: template.defaultName,
                            targetAmount: template.defaultTarget,
                          }));
                        }}
                      >
                        <View
                          style={[
                            styles.templateIcon,
                            active && styles.templateIconActive,
                          ]}
                        >
                          <Icon
                            name={template.icon}
                            size={18}
                            color={active ? Colors.onAccent : Colors.gold}
                            strokeWidth={2.3}
                          />
                        </View>
                        <View style={styles.templateCopy}>
                          <Text style={styles.templateTitle}>{template.title}</Text>
                          <Text style={styles.templateSub}>{template.subtitle}</Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>

                <LabeledInput
                  label="Goal name"
                  value={draft.name}
                  placeholder="Emergency Fund"
                  onChangeText={(name) =>
                    setDraft((current) => ({ ...current, name }))
                  }
                />
              </View>
            )}

            {step === "numbers" && (
              <View style={styles.sheetSection}>
                <Text style={styles.sheetEyebrow}>MAKE IT TRACKABLE</Text>
                <Text style={styles.sheetTitle}>Give the goal a number.</Text>
                <Text style={styles.sheetBody}>
                  This creates the target amount, the monthly commitment, and the
                  timeline Bud can coach around.
                </Text>

                <View style={styles.amountGrid}>
                  <LabeledInput
                    label="Target"
                    value={draft.targetAmount}
                    placeholder="5000"
                    keyboardType="numeric"
                    prefix="$"
                    onChangeText={(target) =>
                      setDraft((current) => ({
                        ...current,
                        targetAmount: moneyInput(target),
                      }))
                    }
                  />
                  <LabeledInput
                    label="Monthly"
                    value={draft.monthlyCommit}
                    placeholder="250"
                    keyboardType="numeric"
                    prefix="$"
                    onChangeText={(monthly) =>
                      setDraft((current) => ({
                        ...current,
                        monthlyCommit: moneyInput(monthly),
                      }))
                    }
                  />
                </View>

                <Text style={styles.planRowLabel}>TIMELINE</Text>
                <View style={styles.planRow}>
                  {PLAN_OPTIONS.map((plan) => {
                    const active = draft.months === plan.months;
                    return (
                      <Pressable
                        key={plan.months}
                        style={styles.planChipWrap}
                        onPress={() => {
                          Haptics.selectionAsync();
                          setDraft((current) => ({
                            ...current,
                            duration: plan.duration,
                            months: plan.months,
                          }));
                        }}
                      >
                        <MotiView
                          animate={{
                            scale: active ? 1 : 0.98,
                          }}
                          transition={{ type: "timing", duration: 200 }}
                          style={[styles.planChip, {
                            backgroundColor: active ? Colors.greenSurface : Colors.card,
                            borderColor: active ? Colors.accentAlpha45 : Colors.border,
                          }]}
                        >
                          <Text
                            style={[
                              styles.planChipTitle,
                              active && styles.planChipTitleActive,
                            ]}
                          >
                            {plan.label}
                          </Text>
                          <Text
                            style={[
                              styles.planChipSub,
                              active && styles.planChipSubActive,
                            ]}
                          >
                            {plan.detail}
                          </Text>
                        </MotiView>
                      </Pressable>
                    );
                  })}
                </View>

                <View style={styles.accountPickerSection}>
                  <Text style={styles.planRowLabel}>AUTOMATIC TRACKING</Text>
                  <Text style={styles.accountPickerHelp}>
                    Optional. Link one savings account and Plaid transfers into it will
                    move this goal automatically.
                  </Text>
                  <SavingsAccountPicker
                    accounts={accounts}
                    selectedId={draft.linkedAccountId}
                    unavailableIds={usedAccountIds}
                    loading={accountsLoading}
                    onSelect={(linkedAccountId) =>
                      setDraft((current) => ({ ...current, linkedAccountId }))
                    }
                  />
                </View>
              </View>
            )}

            {step === "why" && (
              <View style={styles.sheetSection}>
                <Text style={styles.sheetEyebrow}>ANCHOR THE REASON</Text>
                <Text style={styles.sheetTitle}>Why does this one matter?</Text>
                <Text style={styles.sheetBody}>
                  Keep it honest. This sentence becomes the reminder inside the goal
                  card.
                </Text>

                <View style={styles.whyInputWrap}>
                  <TextInput
                    style={styles.whyInput}
                    value={draft.reason}
                    onChangeText={(reason) =>
                      setDraft((current) => ({ ...current, reason }))
                    }
                    placeholder="I want a buffer so one surprise bill does not knock me sideways."
                    placeholderTextColor={Colors.muted}
                    multiline
                    textAlignVertical="top"
                  />
                </View>
              </View>
            )}

            {step === "review" && (
              <View style={styles.sheetSection}>
                <Text style={styles.sheetEyebrow}>READY TO SAVE</Text>
                <Text style={styles.sheetTitle}>This becomes your next goal.</Text>
                <Text style={styles.sheetBody}>
                  Bud will use this target for check-ins and recalculate the finish date
                  from your latest 30-day pace.
                </Text>

                <View style={styles.reviewCard}>
                  <View style={styles.reviewTop}>
                    <View
                      style={[
                        styles.reviewIcon,
                        { backgroundColor: `${selectedMeta.tint}1A` },
                      ]}
                    >
                      <Icon
                        name={selectedMeta.icon}
                        size={20}
                        color={selectedMeta.tint}
                        strokeWidth={2.4}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.reviewName}>{draft.name}</Text>
                      <Text style={styles.reviewMeta}>
                        {selectedPlan?.label ?? "Custom pace"} ·{" "}
                        {DURATION_META[draft.duration].label.toLowerCase()}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.reviewReason}>“{draft.reason.trim()}”</Text>

                  <View style={styles.reviewStats}>
                    <ReviewStat label="Target" value={formatCurrency(targetAmount)} />
                    <ReviewStat
                      label="Monthly"
                      value={formatCurrency(monthlyCommit)}
                    />
                    <ReviewStat label="Starts with" value="+50 XP" />
                  </View>

                  <View style={styles.reviewTrackingRow}>
                    <Icon
                      name={selectedAccount ? "activity" : "piggy-bank"}
                      size={15}
                      color={selectedAccount ? Colors.teal : Colors.muted}
                      strokeWidth={2.4}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.reviewTrackingTitle}>
                        {selectedAccount ? "Automatic tracking on" : "Manual tracking"}
                      </Text>
                      <Text style={styles.reviewTrackingBody}>
                        {selectedAccount
                          ? `${selectedAccount.institution ? `${selectedAccount.institution} · ` : ""}${selectedAccount.name}`
                          : "You can link a savings account later from Edit goal."}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            )}

            {step === "success" && (
              <View style={[styles.sheetSection, styles.successSection]}>
                <Animated.View
                  style={[
                    styles.successBadge,
                    { transform: [{ scale: successPulse }] },
                  ]}
                >
                  <LinearGradient
                    colors={[Colors.gold, Colors.gold600]}
                    style={styles.successBadgeGrad}
                  >
                    <Icon
                      name="badge-check"
                      size={34}
                      color={Colors.onAccent}
                      strokeWidth={2.6}
                    />
                  </LinearGradient>
                </Animated.View>
                <Text style={styles.sheetEyebrow}>FIRST QUEST UNLOCKED</Text>
                <Text style={[styles.sheetTitle, styles.successTitle]}>
                  {createdGoal?.name ?? draft.name} is live.
                </Text>
                <Text style={[styles.sheetBody, styles.successBody]}>
                  {selectedAccount
                    ? `Transfers into ${selectedAccount.name} will now update this goal automatically.`
                    : "Log a contribution now, or link a savings account later for automatic progress."}
                </Text>
                <View style={styles.questTeaser}>
                  <Icon
                    name={selectedAccount ? "activity" : "zap"}
                    size={17}
                    color={Colors.gold}
                    strokeWidth={2.4}
                  />
                  <Text style={styles.questTeaserText}>
                    {selectedAccount
                      ? "Automatic tracking enabled"
                      : "Quest queued · Create the first contribution"}
                  </Text>
                </View>
              </View>
            )}
          </ScrollView>

          <Pressable
            style={[
              styles.sheetPrimary,
              (!canContinue || isSaving) && styles.sheetPrimaryDisabled,
            ]}
            onPress={handlePrimary}
            disabled={isSaving}
          >
            <LinearGradient
              colors={
                !canContinue && !isSaving
                  ? [Colors.navy100, Colors.navy100]
                  : [Colors.gold, Colors.gold600]
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.sheetPrimaryGrad}
            >
              {isSaving ? (
                <ActivityIndicator color={Colors.onAccent} />
              ) : (
                <Text
                  style={[
                    styles.sheetPrimaryText,
                    !canContinue && styles.sheetPrimaryTextDisabled,
                  ]}
                >
                  {step === "review"
                    ? "Create goal"
                    : step === "success"
                      ? "Back to goals"
                      : "Continue"}
                </Text>
              )}
            </LinearGradient>
          </Pressable>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function LabeledInput({
  label,
  value,
  placeholder,
  onChangeText,
  keyboardType,
  prefix,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChangeText: (value: string) => void;
  keyboardType?: "default" | "numeric";
  prefix?: string;
}) {
  return (
    <View style={styles.labeledInputGroup}>
      <Text style={styles.labeledInputLabel}>{label}</Text>
      <View style={styles.labeledInputWrap}>
        {prefix ? <Text style={styles.inputPrefix}>{prefix}</Text> : null}
        <TextInput
          style={[styles.labeledInput, prefix ? styles.labeledInputWithPrefix : null]}
          value={value}
          placeholder={placeholder}
          placeholderTextColor={Colors.muted}
          onChangeText={onChangeText}
          keyboardType={keyboardType}
          returnKeyType="done"
        />
      </View>
    </View>
  );
}

function SavingsAccountPicker({
  accounts,
  selectedId,
  unavailableIds,
  loading,
  onSelect,
}: {
  accounts: AccountSummary[];
  selectedId: string;
  unavailableIds: string[];
  loading: boolean;
  onSelect: (accountId: string) => void;
}) {
  if (loading) {
    return (
      <View style={styles.accountPickerLoading}>
        <ActivityIndicator size="small" color={Colors.gold} />
        <Text style={styles.accountPickerLoadingText}>Loading savings accounts...</Text>
      </View>
    );
  }

  return (
    <View style={styles.accountPickerList}>
      <Pressable
        style={[
          styles.accountPickerCard,
          !selectedId && styles.accountPickerCardActive,
        ]}
        onPress={() => {
          Haptics.selectionAsync();
          onSelect("");
        }}
      >
        <View style={styles.accountPickerIcon}>
          <Icon name="hand" size={16} color={Colors.navyMuted} strokeWidth={2.3} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.accountPickerName}>Manual only</Text>
          <Text style={styles.accountPickerMeta}>Log contributions yourself</Text>
        </View>
        {!selectedId ? <Icon name="check-circle" size={17} color={Colors.teal} /> : null}
      </Pressable>

      {accounts.map((account) => {
        const active = selectedId === account.id;
        const unavailable = unavailableIds.includes(account.id) && !active;
        return (
          <Pressable
            key={account.id}
            disabled={unavailable}
            style={[
              styles.accountPickerCard,
              active && styles.accountPickerCardActive,
              unavailable && styles.accountPickerCardDisabled,
            ]}
            onPress={() => {
              Haptics.selectionAsync();
              onSelect(account.id);
            }}
          >
            <View style={styles.accountPickerIcon}>
              <Icon name="piggy-bank" size={16} color={Colors.gold} strokeWidth={2.3} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.accountPickerName}>{account.name}</Text>
              <Text style={styles.accountPickerMeta}>
                {unavailable
                  ? "Already tracking another goal"
                  : `${account.institution ? `${account.institution} · ` : ""}${formatCurrency(account.balance)}`}
              </Text>
            </View>
            {active ? <Icon name="check-circle" size={17} color={Colors.teal} /> : null}
          </Pressable>
        );
      })}

      {accounts.length === 0 ? (
        <Text style={styles.accountPickerEmpty}>
          No savings account is available yet. Connect one in Profile, then edit this
          goal to turn on automatic tracking.
        </Text>
      ) : null}
    </View>
  );
}

function ReviewStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.reviewStat}>
      <Text style={styles.reviewStatLabel}>{label}</Text>
      <Text style={styles.reviewStatValue}>{value}</Text>
    </View>
  );
}

function moneyInput(value: string) {
  return value.replace(/[^0-9.]/g, "");
}

function moneyFromInput(value: string) {
  return Number(value.replace(/[^0-9.]/g, "")) || 0;
}

function deadlineFromMonths(months: number) {
  const deadline = new Date();
  deadline.setMonth(deadline.getMonth() + months);
  return deadline.toISOString();
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  scroll: {},
  body: { paddingHorizontal: 18, paddingTop: 12 },

  summaryRow: { flexDirection: "row", marginBottom: 14, padding: 16, borderRadius: 22, backgroundColor: Colors.card, borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border },
  summaryCell: { flex: 1, minWidth: 0, paddingHorizontal: 6, alignItems: "flex-start" },
  summaryLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: Colors.muted,
    letterSpacing: 1.1,
    marginBottom: 6,
    textTransform: "uppercase",
  },
  summaryValue: { fontSize: 20, fontWeight: "800", color: Colors.navy, fontVariant: ["tabular-nums"] },
  summarySub: { fontSize: 11, color: Colors.muted, marginTop: 3 },

  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 9,
    paddingLeft: 12,
    paddingRight: 14,
    borderRadius: 999,
    backgroundColor: Colors.accentAlpha12,
    borderWidth: 1,
    borderColor: Colors.accentAlpha40,
  },
  addBtnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },
  addBtnText: {
    fontSize: 13,
    fontWeight: "800",
    color: Colors.navy,
    letterSpacing: 0.2,
    marginLeft: 5,
  },

  goalsSectionHeading: { marginBottom: 12 },
  goalsSectionEyebrow: {
    fontSize: 11,
    fontWeight: "800",
    color: Colors.gold,
    letterSpacing: 1.5,
  },
  goalsSectionTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: Colors.navy,
    marginTop: 3,
  },

  grid: { gap: 12 },

  goalCard: { padding: 18, borderRadius: 22, backgroundColor: Colors.card, borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border },
  goalCardPressed: { opacity: 0.8 },
  goalTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  kindIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  goalName: { fontSize: 17, fontWeight: "800", color: Colors.navy },
  goalTitle: { flex: 1, minWidth: 0 },
  goalMeta: { marginTop: 2, fontSize: 12, fontWeight: "600", color: Colors.muted },
  percentText: { fontSize: 15, fontWeight: "800", color: Colors.navy, fontVariant: ["tabular-nums"] },

  goalReason: { fontSize: 13, lineHeight: 19, fontStyle: "italic", color: Colors.muted, marginBottom: 14 },

  amountRow: { flexDirection: "row", alignItems: "baseline", gap: 5, marginBottom: 9 },
  amountSaved: { flexShrink: 1, fontSize: 26, fontWeight: "800", color: Colors.navy, letterSpacing: -0.6 },
  amountCents: { color: Colors.muted, fontWeight: "700" },
  amountTarget: { flexShrink: 0, maxWidth: "55%", fontSize: 13, fontWeight: "600", color: Colors.muted },

  barTrack: { marginBottom: 14 },

  bottomRow: { flexDirection: "row", gap: 8 },
  bottomCell: { flex: 1, minWidth: 0, gap: 4, padding: 12, borderRadius: 14, backgroundColor: Colors.navy50 },
  bottomLabel: { fontSize: 11, fontWeight: "600", color: Colors.muted },
  bottomValue: { fontSize: 14, fontWeight: "700", color: Colors.navy },

  emptyCard: {
    alignItems: "center",
    backgroundColor: Colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 32,
    gap: 10,
  },
  emptyTitle: { fontSize: 16, fontWeight: "800", color: Colors.navy },
  emptyBody: { fontSize: 13, color: Colors.muted, textAlign: "center", lineHeight: 19 },

  modalRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.46)",
  },
  goalSheet: {
    maxHeight: "92%",
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: Colors.black,
    shadowOpacity: 0.22,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: -8 },
    elevation: 18,
  },
  sheetHandle: {
    alignSelf: "center",
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    marginBottom: 12,
  },
  sheetTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  sheetIconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sheetStepPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: Colors.greenSurface,
    borderWidth: 1,
    borderColor: Colors.greenBorder,
  },
  sheetStepText: {
    fontSize: 11,
    fontWeight: "800",
    color: Colors.gold,
    letterSpacing: 0.4,
  },
  sheetScroll: {
    paddingTop: 10,
    paddingBottom: 16,
  },
  sheetSection: {
    gap: 14,
  },
  sheetEyebrow: {
    fontSize: 11,
    fontWeight: "800",
    color: Colors.gold,
    letterSpacing: 1.6,
  },
  sheetTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: Colors.navy,
    letterSpacing: 0,
    lineHeight: 31,
  },
  sheetBody: {
    fontSize: 14,
    color: Colors.navyMuted,
    lineHeight: 21,
  },
  templateGrid: {
    gap: 10,
  },
  templateCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 16,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  templateCardActive: {
    borderColor: Colors.accentAlpha45,
    backgroundColor: Colors.greenSurface,
  },
  templateIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.accentAlpha10,
    borderWidth: 1,
    borderColor: Colors.accentAlpha25,
  },
  templateIconActive: {
    backgroundColor: Colors.gold,
    borderColor: Colors.gold,
  },
  templateCopy: {
    flex: 1,
    gap: 3,
  },
  templateTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: Colors.navy,
    letterSpacing: 0,
  },
  templateSub: {
    fontSize: 12,
    color: Colors.navyMuted,
    lineHeight: 17,
  },
  labeledInputGroup: {
    flex: 1,
    gap: 8,
  },
  labeledInputLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: Colors.muted,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  labeledInputWrap: {
    minHeight: 60,
    borderRadius: 16,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  inputPrefix: {
    fontSize: 20,
    fontWeight: "800",
    color: Colors.gold,
    marginRight: 6,
  },
  labeledInput: {
    flex: 1,
    color: Colors.navy,
    fontSize: 18,
    fontWeight: "700",
    paddingVertical: 14,
  },
  labeledInputWithPrefix: {
    fontSize: 20,
    fontWeight: "800",
  },
  amountGrid: {
    flexDirection: "row",
    gap: 14,
  },
  planRowLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: Colors.muted,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginTop: 20,
    marginBottom: 10,
  },
  planRow: {
    flexDirection: "row",
    gap: 10,
  },
  planChipWrap: {
    flex: 1,
  },
  planChip: {
    minHeight: 74,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 13,
    justifyContent: "center",
  },
  planChipTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: Colors.navy,
    letterSpacing: 0,
  },
  planChipTitleActive: {
    color: Colors.gold,
  },
  planChipSub: {
    fontSize: 11,
    color: Colors.muted,
    marginTop: 4,
  },
  planChipSubActive: {
    color: Colors.navyMuted,
  },
  accountPickerSection: { marginTop: 2 },
  accountPickerHelp: {
    marginTop: -4,
    marginBottom: 10,
    fontSize: 12,
    fontWeight: "600",
    color: Colors.navyMuted,
    lineHeight: 18,
  },
  accountPickerList: { gap: 9 },
  accountPickerCard: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderRadius: 15,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  accountPickerCardActive: {
    backgroundColor: Colors.greenSurface,
    borderColor: Colors.accentAlpha45,
  },
  accountPickerCardDisabled: { opacity: 0.45 },
  accountPickerIcon: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 11,
    backgroundColor: Colors.navy50,
  },
  accountPickerName: { fontSize: 13, fontWeight: "800", color: Colors.navy },
  accountPickerMeta: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: "600",
    color: Colors.muted,
  },
  accountPickerLoading: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    borderRadius: 15,
    backgroundColor: Colors.navy50,
  },
  accountPickerLoadingText: { fontSize: 12, fontWeight: "700", color: Colors.navyMuted },
  accountPickerEmpty: {
    padding: 12,
    borderRadius: 14,
    backgroundColor: Colors.navy50,
    fontSize: 11,
    fontWeight: "600",
    color: Colors.navyMuted,
    lineHeight: 17,
  },
  whyInputWrap: {
    minHeight: 142,
    backgroundColor: Colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
  },
  whyInput: {
    minHeight: 112,
    color: Colors.navy,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "600",
  },
  reviewCard: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 18,
    padding: 16,
    gap: 14,
  },
  reviewTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  reviewIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  reviewName: {
    fontSize: 18,
    fontWeight: "800",
    color: Colors.navy,
    letterSpacing: 0,
  },
  reviewMeta: {
    fontSize: 12,
    color: Colors.muted,
    fontWeight: "700",
    marginTop: 2,
  },
  reviewReason: {
    fontSize: 14,
    color: Colors.navyMuted,
    fontStyle: "italic",
    lineHeight: 21,
  },
  reviewStats: {
    flexDirection: "row",
    gap: 8,
  },
  reviewTrackingRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
    padding: 12,
    borderRadius: 14,
    backgroundColor: Colors.greenSurface,
    borderWidth: 1,
    borderColor: Colors.greenBorder,
  },
  reviewTrackingTitle: { fontSize: 12, fontWeight: "800", color: Colors.navy },
  reviewTrackingBody: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: "600",
    color: Colors.navyMuted,
    lineHeight: 16,
  },
  reviewStat: {
    flex: 1,
    borderRadius: 13,
    backgroundColor: Colors.navy50,
    padding: 11,
  },
  reviewStatLabel: {
    fontSize: 10,
    color: Colors.muted,
    fontWeight: "800",
    letterSpacing: 0.7,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  reviewStatValue: {
    fontSize: 13,
    color: Colors.navy,
    fontWeight: "800",
    letterSpacing: 0,
  },
  successSection: {
    alignItems: "center",
    paddingVertical: 16,
  },
  successBadge: {
    width: 90,
    height: 90,
    borderRadius: 45,
    overflow: "hidden",
    shadowColor: Colors.gold,
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 9,
  },
  successBadgeGrad: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  successTitle: {
    textAlign: "center",
  },
  successBody: {
    textAlign: "center",
    maxWidth: 300,
  },
  questTeaser: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: Colors.greenSurface,
    borderWidth: 1,
    borderColor: Colors.greenBorder,
  },
  questTeaserText: {
    fontSize: 12,
    fontWeight: "800",
    color: Colors.navy,
  },
  sheetPrimary: {
    borderRadius: 17,
    overflow: "hidden",
    shadowColor: Colors.gold,
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 6,
  },
  // Explicit disabled surface; opacity-faded gradient was unreadable in dark mode.
  sheetPrimaryDisabled: {
    shadowOpacity: 0,
    elevation: 0,
  },
  sheetPrimaryGrad: {
    minHeight: 54,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetPrimaryText: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.onAccent,
    letterSpacing: 0,
  },
  sheetPrimaryTextDisabled: { color: Colors.muted },
});

import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

import { Colors } from "@/constants/colors";
import { BrandHeader } from "@/components/BrandLogo";
import { Icon, type IconName } from "@/components/Icon";
import { goalsService } from "@/services/goalsService";
import { budgetService } from "@/services/budgetService";
import type { AccountSummary } from "@/mock/budget";
import type { Goal, GoalCategoryKind } from "@/mock/goals";
import { formatCurrency } from "@/utils/security";

type GoalAction = "contribute" | "edit" | "delete";

const ACTION_META: Record<
  GoalAction,
  { eyebrow: string; title: string; subtitle: string; icon: IconName }
> = {
  contribute: {
    eyebrow: "GOAL",
    title: "Log contribution",
    subtitle: "Add progress now. Linked savings transfers update the same goal automatically.",
    icon: "banknote",
  },
  edit: {
    eyebrow: "GOAL",
    title: "Edit goal",
    subtitle: "Update the plan and choose which savings account tracks it.",
    icon: "settings",
  },
  delete: {
    eyebrow: "GOAL",
    title: "Archive goal",
    subtitle: "Completed goals should become proof of progress, not disappear.",
    icon: "alert-circle",
  },
};

const KIND_LABEL: Record<GoalCategoryKind, string> = {
  emergency_fund: "Safety goal",
  debt_payoff: "Debt goal",
  savings_target: "Savings goal",
  invest: "Investing habit",
  income_growth: "Income goal",
  stop_overspending: "Budget control goal",
  custom: "Custom goal",
};

export default function GoalActionScreen() {
  const insets = useSafeAreaInsets();
  const { goalId, action } = useLocalSearchParams<{
    goalId?: string;
    action?: string;
  }>();
  const resolvedAction = normaliseAction(action);
  const meta = ACTION_META[resolvedAction];
  const [goal, setGoal] = useState<Goal | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (!goalId) return;
        const nextGoal = await goalsService.detail(String(goalId));
        if (alive) setGoal(nextGoal);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [goalId]);

  return (
    <View style={styles.container}>
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={goBack} hitSlop={10} style={styles.iconBtn}>
          <Icon name="arrow-left" size={18} color={Colors.navy} strokeWidth={2.4} />
        </Pressable>
        <BrandHeader style={styles.brandHeader} />
        <View style={styles.iconBtnGhost} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingBottom: insets.bottom + 32 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <View style={styles.heroIcon}>
              <Icon name={meta.icon} size={21} color={Colors.accent} strokeWidth={2.5} />
            </View>
            <Text style={styles.eyebrow}>{meta.eyebrow}</Text>
            <Text style={styles.title}>{meta.title}</Text>
            <Text style={styles.subtitle}>{meta.subtitle}</Text>
          </View>

          {loading ? (
            <View style={styles.loadingCard}>
              <ActivityIndicator color={Colors.accent} />
              <Text style={styles.loadingText}>Loading goal...</Text>
            </View>
          ) : null}

          {!loading && !goal ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>Goal not found</Text>
              <Text style={styles.emptyBody}>This goal may have been removed or archived.</Text>
            </View>
          ) : null}

          {goal && resolvedAction === "contribute" ? (
            <ContributeBody goal={goal} onUpdated={setGoal} />
          ) : null}
          {goal && resolvedAction === "edit" ? <EditBody goal={goal} /> : null}
          {goal && resolvedAction === "delete" ? <DeleteBody goal={goal} /> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function ContributeBody({
  goal,
  onUpdated,
}: {
  goal: Goal;
  onUpdated: (goal: Goal) => void;
}) {
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const parsed = moneyFromInput(amount);
  const progress = Math.round((goal.alreadySaved / goal.targetAmount) * 100);

  const save = async () => {
    if (parsed <= 0 || saving) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    setSaving(true);
    try {
      const updated = await goalsService.contribute(goal.id, parsed);
      onUpdated(updated);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Contribution logged", "That progress is now on the goal.");
      router.replace(`/goal/${goal.id}`);
    } catch {
      Alert.alert("Could not log contribution", "Try again in a moment.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.stack}>
      <GoalMiniCard goal={goal} />
      <View style={styles.fieldWrap}>
        <Text style={styles.fieldLabel}>Amount</Text>
        <TextInput
          value={amount}
          onChangeText={setAmount}
          placeholder="$0"
          placeholderTextColor={Colors.muted}
          keyboardType="decimal-pad"
          style={styles.input}
        />
      </View>
      <View style={styles.infoCard}>
        <Icon name="target" size={17} color={Colors.accent} strokeWidth={2.4} />
        <Text style={styles.infoText}>
          This goal is {progress}% complete. Manual contributions and linked
          savings transfers both update its 30-day pace.
        </Text>
      </View>
      <ActionButton
        label={saving ? "Logging..." : "Log contribution"}
        icon="check"
        onPress={save}
        disabled={parsed <= 0 || saving}
      />
    </View>
  );
}

function EditBody({ goal }: { goal: Goal }) {
  const [name, setName] = useState(goal.name);
  const [reason, setReason] = useState(goal.reason);
  const [monthly, setMonthly] = useState(String(goal.monthlyCommit));
  const [linkedAccountId, setLinkedAccountId] = useState(goal.linkedAccountId ?? "");
  const [accounts, setAccounts] = useState<AccountSummary[]>([]);
  const [unavailableAccountIds, setUnavailableAccountIds] = useState<string[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    setAccountsLoading(true);
    Promise.all([budgetService.getAccounts(), goalsService.list()])
      .then(([nextAccounts, goalList]) => {
        if (!alive) return;
        setAccounts(nextAccounts.filter((account) => account.kind === "savings"));
        setUnavailableAccountIds(
          goalList.goals.flatMap((item) =>
            item.id !== goal.id && item.linkedAccountId ? [item.linkedAccountId] : []
          )
        );
      })
      .catch(() => {
        if (alive) setAccounts([]);
      })
      .finally(() => {
        if (alive) setAccountsLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [goal.id]);

  const save = async () => {
    const monthlyCommit = moneyFromInput(monthly);
    if (!name.trim() || monthlyCommit < 0 || saving) return;
    setSaving(true);
    try {
      await goalsService.update(goal.id, {
        name: name.trim(),
        reason: reason.trim(),
        monthlyCommit,
        linkedAccountId,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Goal updated", "Your goal details are saved.");
      router.replace(`/goal/${goal.id}`);
    } catch {
      Alert.alert("Could not update goal", "Try again in a moment.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.stack}>
      <GoalMiniCard goal={goal} />
      <Field label="Goal name" value={name} onChangeText={setName} />
      <View style={styles.fieldWrap}>
        <Text style={styles.fieldLabel}>Monthly plan</Text>
        <TextInput
          value={monthly}
          onChangeText={setMonthly}
          placeholder="$0"
          placeholderTextColor={Colors.muted}
          keyboardType="decimal-pad"
          style={styles.input}
        />
      </View>
      <View style={styles.fieldWrap}>
        <Text style={styles.fieldLabel}>Automatic tracking</Text>
        <Text style={styles.fieldHelp}>
          Link one savings account. New Plaid transfers into it will increase this goal.
        </Text>
        <EditSavingsAccountPicker
          accounts={accounts}
          selectedId={linkedAccountId}
          unavailableIds={unavailableAccountIds}
          loading={accountsLoading}
          onSelect={setLinkedAccountId}
        />
      </View>
      <View style={styles.fieldWrap}>
        <Text style={styles.fieldLabel}>Why it matters</Text>
        <TextInput
          value={reason}
          onChangeText={setReason}
          placeholder="A reason Bud can bring back when motivation dips."
          placeholderTextColor={Colors.muted}
          multiline
          textAlignVertical="top"
          style={[styles.input, styles.textArea]}
        />
      </View>
      <ActionButton
        label={saving ? "Saving..." : "Save changes"}
        icon="check"
        onPress={save}
        disabled={!name.trim() || saving}
      />
    </View>
  );
}

function DeleteBody({ goal }: { goal: Goal }) {
  const archive = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      "Archive placeholder",
      "This screen is ready for archive/delete once the backend route exists.",
    );
  };

  return (
    <View style={styles.stack}>
      <GoalMiniCard goal={goal} />
      <View style={styles.warningCard}>
        <Icon name="alert-circle" size={18} color={Colors.coral} strokeWidth={2.5} />
        <Text style={styles.warningText}>
          Active goals should be archived carefully. Completed goals belong in
          the trophy shelf for progress reports and recaps.
        </Text>
      </View>
      <Pressable style={styles.deleteButton} onPress={archive}>
        <Icon name="alert-circle" size={17} color={Colors.coral} strokeWidth={2.5} />
        <Text style={styles.deleteButtonText}>Archive goal later</Text>
      </Pressable>
    </View>
  );
}

function GoalMiniCard({ goal }: { goal: Goal }) {
  const progress = Math.min(1, goal.alreadySaved / goal.targetAmount);
  return (
    <View style={styles.goalCard}>
      <Text style={styles.goalName}>{goal.name}</Text>
      <Text style={styles.goalMeta}>
        {formatCurrency(goal.alreadySaved)} of {formatCurrency(goal.targetAmount)}
      </Text>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${Math.round(progress * 100)}%` }]} />
      </View>
    </View>
  );
}

function EditSavingsAccountPicker({
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
      <View style={styles.accountLoading}>
        <ActivityIndicator size="small" color={Colors.accent} />
        <Text style={styles.accountLoadingText}>Loading savings accounts...</Text>
      </View>
    );
  }

  return (
    <View style={styles.accountList}>
      <Pressable
        style={[styles.accountOption, !selectedId && styles.accountOptionActive]}
        onPress={() => {
          Haptics.selectionAsync();
          onSelect("");
        }}
      >
        <View style={styles.accountOptionIcon}>
          <Icon name="hand" size={16} color={Colors.navyMuted} strokeWidth={2.3} />
        </View>
        <View style={styles.flex}>
          <Text style={styles.accountOptionName}>Manual only</Text>
          <Text style={styles.accountOptionMeta}>No account-linked updates</Text>
        </View>
        {!selectedId ? <Icon name="check-circle" size={17} color={Colors.emerald} /> : null}
      </Pressable>

      {accounts.map((account) => {
        const active = selectedId === account.id;
        const unavailable = unavailableIds.includes(account.id) && !active;
        return (
          <Pressable
            key={account.id}
            disabled={unavailable}
            style={[
              styles.accountOption,
              active && styles.accountOptionActive,
              unavailable && styles.accountOptionDisabled,
            ]}
            onPress={() => {
              Haptics.selectionAsync();
              onSelect(account.id);
            }}
          >
            <View style={styles.accountOptionIcon}>
              <Icon name="piggy-bank" size={16} color={Colors.accent} strokeWidth={2.3} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.accountOptionName}>{account.name}</Text>
              <Text style={styles.accountOptionMeta}>
                {unavailable
                  ? "Already linked to another goal"
                  : `${account.institution ? `${account.institution} · ` : ""}${formatCurrency(account.balance)}`}
              </Text>
            </View>
            {active ? <Icon name="check-circle" size={17} color={Colors.emerald} /> : null}
          </Pressable>
        );
      })}

      {accounts.length === 0 ? (
        <Text style={styles.accountEmpty}>
          No savings account is available. Connect one in Profile to enable automatic
          progress.
        </Text>
      ) : null}
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholderTextColor={Colors.muted}
        style={styles.input}
      />
    </View>
  );
}

function ActionButton({
  label,
  icon,
  onPress,
  disabled,
}: {
  label: string;
  icon: IconName;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      disabled={disabled}
      style={({ pressed }) => [
        styles.actionButtonWrap,
        disabled && styles.actionButtonDisabled,
        pressed && !disabled && styles.actionButtonPressed,
      ]}
      onPress={onPress}
    >
      <View style={[styles.actionButton, disabled && styles.actionButtonSurfaceDisabled]}>
        <View style={styles.actionButtonInner}>
          <Icon
            name={icon}
            size={17}
            color={disabled ? Colors.muted : Colors.onAccent}
            strokeWidth={2.5}
          />
          <Text
            style={[styles.actionButtonText, disabled && styles.actionButtonTextDisabled]}
          >
            {label}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

function normaliseAction(value?: string): GoalAction {
  const first = Array.isArray(value) ? value[0] : value;
  if (first === "edit" || first === "delete") return first;
  return "contribute";
}

function moneyFromInput(value: string) {
  const normalised = Number(value.replace(/[^0-9.]/g, ""));
  return Number.isFinite(normalised) ? normalised : 0;
}

function goBack() {
  Haptics.selectionAsync();
  router.back();
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  flex: { flex: 1 },
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
  title: {
    fontSize: 25,
    fontWeight: "900",
    color: Colors.navy,
    letterSpacing: 0,
    textAlign: "center",
  },
  subtitle: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: "600",
    color: Colors.navyMuted,
    textAlign: "center",
    lineHeight: 19,
  },
  loadingCard: {
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    minHeight: 150,
    backgroundColor: Colors.card,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  loadingText: { fontSize: 13, fontWeight: "700", color: Colors.navyMuted },
  emptyCard: {
    alignItems: "center",
    padding: 18,
    gap: 8,
    borderRadius: 17,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  emptyTitle: { fontSize: 15, fontWeight: "900", color: Colors.navy },
  emptyBody: { fontSize: 12, fontWeight: "600", color: Colors.navyMuted },
  stack: { gap: 14 },
  goalCard: {
    padding: 16,
    borderRadius: 17,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  goalName: { fontSize: 17, fontWeight: "900", color: Colors.navy },
  goalMeta: {
    marginTop: 5,
    fontSize: 13,
    fontWeight: "700",
    color: Colors.navyMuted,
  },
  track: {
    height: 8,
    borderRadius: 999,
    backgroundColor: Colors.border,
    overflow: "hidden",
    marginTop: 13,
  },
  fill: { height: 8, borderRadius: 999, backgroundColor: Colors.accent },
  fieldWrap: { gap: 8 },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: Colors.navyMuted,
    marginLeft: 4,
  },
  fieldHelp: {
    marginHorizontal: 4,
    marginTop: -3,
    fontSize: 11,
    fontWeight: "600",
    color: Colors.muted,
    lineHeight: 17,
  },
  input: {
    minHeight: 54,
    borderRadius: 16,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: "800",
    color: Colors.navy,
  },
  textArea: { minHeight: 112, lineHeight: 20 },
  accountList: { gap: 9 },
  accountOption: {
    minHeight: 60,
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
  accountOptionActive: {
    backgroundColor: Colors.greenSurface,
    borderColor: Colors.accentAlpha45,
  },
  accountOptionDisabled: { opacity: 0.45 },
  accountOptionIcon: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 11,
    backgroundColor: Colors.navy50,
  },
  accountOptionName: { fontSize: 13, fontWeight: "800", color: Colors.navy },
  accountOptionMeta: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: "600",
    color: Colors.muted,
  },
  accountLoading: {
    minHeight: 60,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    borderRadius: 15,
    backgroundColor: Colors.navy50,
  },
  accountLoadingText: { fontSize: 12, fontWeight: "700", color: Colors.navyMuted },
  accountEmpty: {
    padding: 12,
    borderRadius: 14,
    backgroundColor: Colors.navy50,
    fontSize: 11,
    fontWeight: "600",
    color: Colors.navyMuted,
    lineHeight: 17,
  },
  infoCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 14,
    borderRadius: 16,
    backgroundColor: Colors.greenSurface,
    borderWidth: 1,
    borderColor: Colors.greenBorder,
  },
  infoText: { flex: 1, fontSize: 12, fontWeight: "700", color: Colors.navy, lineHeight: 18 },
  actionButtonWrap: {
    borderRadius: 18,
    shadowColor: Colors.accent,
    shadowOpacity: 0.3,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  actionButton: {
    minHeight: 56,
    borderRadius: 18,
    backgroundColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  actionButtonInner: { flexDirection: "row", alignItems: "center", gap: 9 },
  actionButtonPressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
  // Explicit disabled surface: opacity-faded green with dark label was
  // invisible against the dark-mode background.
  actionButtonDisabled: { shadowOpacity: 0, elevation: 0 },
  actionButtonSurfaceDisabled: { backgroundColor: Colors.navy100 },
  actionButtonText: { fontSize: 15, fontWeight: "900", color: Colors.onAccent },
  actionButtonTextDisabled: { color: Colors.muted },
  warningCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 14,
    borderRadius: 16,
    backgroundColor: "rgba(239,68,68,0.09)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.18)",
  },
  warningText: { flex: 1, fontSize: 12, fontWeight: "700", color: Colors.navy, lineHeight: 18 },
  deleteButton: {
    minHeight: 54,
    borderRadius: 16,
    backgroundColor: "rgba(239,68,68,0.1)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.22)",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 9,
  },
  deleteButtonText: { fontSize: 15, fontWeight: "900", color: Colors.coral },
});

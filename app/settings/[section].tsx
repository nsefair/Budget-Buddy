import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
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
import { SectionHeader } from "@/components/ui/SectionHeader";
import { useAuthActions, useUser } from "@/hooks/useAuth";
import { usePlaidConnection } from "@/hooks/usePlaidConnection";
import { goalsService } from "@/services/goalsService";
import { authService } from "@/services/authService";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  notificationService,
  type NotificationPreferences,
} from "@/services/notificationService";
import { billingService, type SubscriptionStatus } from "@/services/billingService";
import type { Goal, GoalsSummary } from "@/mock/goals";
import { formatCurrency, secureLog } from "@/utils/security";

type SettingsScreen =
  | "edit-profile"
  | "goals"
  | "notifications"
  | "privacy"
  | "bank-connections"
  | "subscription"
  | "help"
  | "legal";

const SCREEN_META: Record<
  SettingsScreen,
  { eyebrow: string; title: string; subtitle: string; icon: IconName }
> = {
  "edit-profile": {
    eyebrow: "ACCOUNT",
    title: "Edit profile",
    subtitle: "Keep Bud's context current without exposing private financial details.",
    icon: "user",
  },
  goals: {
    eyebrow: "GOALS",
    title: "Goal management",
    subtitle: "Review what you are building and jump into the full Goals tab.",
    icon: "target",
  },
  notifications: {
    eyebrow: "PREFERENCES",
    title: "Notifications",
    subtitle: "Choose the nudges that help without letting the app get noisy.",
    icon: "bell",
  },
  privacy: {
    eyebrow: "PRIVACY",
    title: "What Buds see",
    subtitle: "Social stays about effort and wins. Financial data stays private.",
    icon: "lock",
  },
  "bank-connections": {
    eyebrow: "PLAID",
    title: "Bank connections",
    subtitle: "Connect and review the accounts Bud can use for private money context.",
    icon: "building",
  },
  subscription: {
    eyebrow: "MEMBERSHIP",
    title: "Subscription",
    subtitle: "Monthly, annual, and early lifetime paths in one clear place.",
    icon: "badge-check",
  },
  help: {
    eyebrow: "SUPPORT",
    title: "Help",
    subtitle: "Fast answers, contact paths, and the Bud support boundary.",
    icon: "message-circle",
  },
  legal: {
    eyebrow: "LEGAL",
    title: "Disclaimers",
    subtitle: "Bud is educational and motivational, not a financial advisor.",
    icon: "info",
  },
};

export default function SettingsDetailScreen() {
  const insets = useSafeAreaInsets();
  // NOTE: the dynamic segment is named [section] because "screen" is a
  // reserved React Navigation param and never reaches useLocalSearchParams.
  const { section } = useLocalSearchParams<{ section?: string }>();
  const key = normaliseScreen(section);
  const meta = SCREEN_META[key];

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
              <Icon name={meta.icon} size={20} color={Colors.accent} strokeWidth={2.5} />
            </View>
            <Text style={styles.eyebrow}>{meta.eyebrow}</Text>
            <Text style={styles.title}>{meta.title}</Text>
            <Text style={styles.subtitle}>{meta.subtitle}</Text>
          </View>

          {key === "edit-profile" && <EditProfileBody />}
          {key === "goals" && <GoalSettingsBody />}
          {key === "notifications" && <NotificationsBody />}
          {key === "privacy" && <PrivacyBody />}
          {key === "bank-connections" && <BankConnectionsBody />}
          {key === "subscription" && <SubscriptionBody />}
          {key === "help" && <HelpBody />}
          {key === "legal" && <LegalBody />}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function EditProfileBody() {
  const user = useUser();
  const { updateUser, logout } = useAuthActions();
  const [firstName, setFirstName] = useState(user?.firstName ?? "");
  const [lastName, setLastName] = useState(user?.lastName ?? "");
  const [why, setWhy] = useState(user?.why ?? "");
  const [saving, setSaving] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [deletePassword, setDeletePassword] = useState("");

  if (!user) return null;

  const canSave = firstName.trim().length > 0 && lastName.trim().length > 0;

  const save = async () => {
    if (!canSave) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    setSaving(true);
    try {
      const updated = await authService.updateProfile({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        why: why.trim(),
      });
      updateUser(updated);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Profile updated", "Your account profile is saved.");
    } catch {
      Alert.alert("Could not save", "Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  const requestVerification = async () => {
    try {
      const result = await authService.requestEmailVerification();
      Alert.alert("Verification email", result.message);
    } catch {
      Alert.alert("Could not send email", "Try again in a moment.");
    }
  };

  const changeEmail = async () => {
    if (!newEmail.trim() || !emailPassword) return;
    try {
      const result = await authService.requestEmailChange(newEmail.trim().toLowerCase(), emailPassword);
      setEmailPassword("");
      Alert.alert("Check your new email", result.message);
    } catch {
      Alert.alert("Could not change email", "Check the email and current password, then try again.");
    }
  };

  const changePassword = async () => {
    if (newPassword.length < 8 || newPassword !== confirmPassword) {
      Alert.alert("Check the password", "Use at least 8 characters and make sure both new passwords match.");
      return;
    }
    try {
      const result = await authService.changePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      Alert.alert("Password updated", result.message, [
        { text: "Sign in", onPress: async () => { await logout(); router.replace("/(auth)/login"); } },
      ]);
    } catch {
      Alert.alert("Could not change password", "Check your current password and try again.");
    }
  };

  const confirmDelete = () => {
    if (!deletePassword) return;
    Alert.alert(
      "Delete account permanently?",
      "This removes your Budget Buddy account and stored app data. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete account",
          style: "destructive",
          onPress: async () => {
            try {
              await authService.deleteAccount(deletePassword);
              await logout();
              router.replace("/(auth)/welcome");
            } catch {
              Alert.alert("Could not delete account", "Check your password and try again.");
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.stack}>
      <Field label="First name" value={firstName} onChangeText={setFirstName} />
      <Field label="Last name" value={lastName} onChangeText={setLastName} />
      <View style={styles.fieldWrap}>
        <Text style={styles.fieldLabel}>Email</Text>
        <View style={styles.readOnlyField}>
          <Text style={styles.readOnlyText}>{user.email} {user.emailVerified ? "· Verified" : "· Unverified"}</Text>
        </View>
      </View>
      <View style={styles.fieldWrap}>
        <Text style={styles.fieldLabel}>Your why</Text>
        <TextInput
          value={why}
          onChangeText={setWhy}
          placeholder="The reason you want this to stick."
          placeholderTextColor={Colors.muted}
          multiline
          style={[styles.input, styles.textArea]}
          textAlignVertical="top"
        />
      </View>
      <ActionButton label={saving ? "Saving..." : "Save profile"} icon="check" onPress={save} disabled={!canSave || saving} />

      {!user.emailVerified ? (
        <ActionButton label="Send verification email" icon="badge-check" onPress={requestVerification} />
      ) : null}

      <SectionHeader title="CHANGE EMAIL" />
      <Field label="New email" value={newEmail} onChangeText={setNewEmail} />
      <SecureField label="Current password" value={emailPassword} onChangeText={setEmailPassword} />
      <ActionButton label="Confirm new email" icon="user" onPress={changeEmail} disabled={!newEmail.trim() || !emailPassword} />

      <SectionHeader title="CHANGE PASSWORD" />
      <SecureField label="Current password" value={currentPassword} onChangeText={setCurrentPassword} />
      <SecureField label="New password" value={newPassword} onChangeText={setNewPassword} />
      <SecureField label="Confirm new password" value={confirmPassword} onChangeText={setConfirmPassword} />
      <ActionButton label="Update password" icon="lock" onPress={changePassword} disabled={!currentPassword || !newPassword || !confirmPassword} />

      <SectionHeader title="DANGER ZONE" />
      <SecureField label="Password to confirm deletion" value={deletePassword} onChangeText={setDeletePassword} />
      <ActionButton label="Delete account" icon="x" onPress={confirmDelete} disabled={!deletePassword} />
    </View>
  );
}

function GoalSettingsBody() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [summary, setSummary] = useState<GoalsSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const result = await goalsService.list();
        if (!alive) return;
        setGoals(result.goals);
        setSummary(result.summary);
      } catch (error) {
        secureLog.error("settings.goals failed", error);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingCard}>
        <ActivityIndicator color={Colors.accent} />
        <Text style={styles.loadingText}>Loading your goals...</Text>
      </View>
    );
  }

  return (
    <View style={styles.stack}>
      {summary ? (
        <View style={styles.metricGrid}>
          <Metric label="Active" value={String(summary.activeCount)} />
          <Metric
            label="Saved"
            value={formatCurrency(summary.totalSaved, { compact: true })}
          />
          <Metric
            label="Monthly"
            value={formatCurrency(summary.monthlyCommittedTotal, { compact: true })}
          />
        </View>
      ) : null}

      <ActionButton
        label="Open Goals tab"
        icon="target"
        onPress={() => {
          Haptics.selectionAsync();
          router.push("/(tabs)/goals");
        }}
      />

      <View style={styles.stackTight}>
        {goals.length === 0 ? (
          <InfoCard
            icon="sparkles"
            title="No active goals yet"
            body="The Goals tab has the full creation flow ready when you are."
          />
        ) : (
          goals.slice(0, 4).map((goal) => (
            <Pressable
              key={goal.id}
              style={({ pressed }) => [styles.goalRow, pressed && styles.rowPressed]}
              onPress={() => {
                Haptics.selectionAsync();
                router.push(`/goal/${goal.id}`);
              }}
            >
              <View style={styles.goalIcon}>
                <Icon name="target" size={16} color={Colors.accent} strokeWidth={2.4} />
              </View>
              <View style={styles.goalTextWrap}>
                <Text style={styles.goalName} numberOfLines={1}>
                  {goal.name}
                </Text>
                <Text style={styles.goalMeta}>
                  {Math.round((goal.alreadySaved / goal.targetAmount) * 100)}% complete
                </Text>
              </View>
              <Icon name="chevron-right" size={17} color={Colors.muted} strokeWidth={2.4} />
            </Pressable>
          ))
        )}
      </View>
    </View>
  );
}

function NotificationsBody() {
  const [values, setValues] = useState<NotificationPreferences>(DEFAULT_NOTIFICATION_PREFERENCES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    notificationService.getPreferences()
      .then((preferences) => active && setValues(preferences))
      .catch((error) => secureLog.error("settings.notifications failed", error))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  const set = async (key: keyof NotificationPreferences, value: boolean) => {
    Haptics.selectionAsync();
    let next = { ...values, [key]: value };
    setValues(next);
    setSaving(true);
    try {
      if (key === "pushEnabled" && value) {
        const result = await notificationService.registerForPush();
        if (!result.registered) {
          next = { ...next, pushEnabled: false };
          setValues(next);
          Alert.alert(
            "Push not ready",
            result.reason === "project_not_configured"
              ? "Add EXPO_PUBLIC_EAS_PROJECT_ID after creating the Expo project. Your other preferences are saved."
              : result.reason === "native_module_unavailable"
                ? "Rebuild the development client so it includes expo-notifications. Your other preferences are saved."
              : "Notification permission was not granted."
          );
        }
      }
      await notificationService.updatePreferences(next);
    } catch {
      setValues(values);
      Alert.alert("Could not save", "Notification preferences were not updated.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <View style={styles.loadingCard}><ActivityIndicator color={Colors.accent} /></View>;
  }

  return (
    <View style={styles.stack}>
      <ToggleRow
        icon="flame"
        title="Streak warning"
        body="One evening reminder when your flame has not checked in."
        value={values.streakEnabled}
        onValueChange={(value) => set("streakEnabled", value)}
      />
      <ToggleRow
        icon="target"
        title="Quest nudges"
        body="Helpful prompts for active quests and progress moments."
        value={values.questsEnabled}
        onValueChange={(value) => set("questsEnabled", value)}
      />
      <ToggleRow
        icon="trophy"
        title="Wealth League"
        body="Promotion, reset, and rank movement updates."
        value={values.weeklyEnabled}
        onValueChange={(value) => set("weeklyEnabled", value)}
      />
      <ToggleRow
        icon="users"
        title="Bud activity"
        body="Wins from people you follow and Fist Bumps you receive."
        value={values.budsEnabled}
        onValueChange={(value) => set("budsEnabled", value)}
      />
      <ToggleRow
        icon="calendar"
        title="Bills"
        body="A quiet heads-up before recurring charges."
        value={values.billsEnabled}
        onValueChange={(value) => set("billsEnabled", value)}
      />
      <ToggleRow
        icon="sparkles"
        title="Smart suggestions"
        body="Reserved for post-Plaid context-aware nudges."
        value={values.smartEnabled}
        onValueChange={(value) => set("smartEnabled", value)}
      />
      <ToggleRow
        icon="bell"
        title="Push notifications"
        body="Allow alerts on this device when push credentials are configured."
        value={values.pushEnabled}
        onValueChange={(value) => set("pushEnabled", value)}
      />
      <ToggleRow
        icon="badge-check"
        title="Email notifications"
        body="Security, account, and selected progress emails."
        value={values.emailEnabled}
        onValueChange={(value) => set("emailEnabled", value)}
      />
      <ActionButton
        label={saving ? "Saving..." : "Send local test"}
        icon="bell"
        disabled={saving}
        onPress={async () => {
          try {
            const result = await notificationService.createLocalTest();
            if (!result.sent) {
              Alert.alert(
                "Notifications are off",
                result.reason === "native_module_unavailable"
                  ? "Rebuild the development client so it includes expo-notifications."
                  : "Enable notification permission before sending a local test.",
                result.reason === "native_module_unavailable"
                  ? undefined
                  : [
                      { text: "Cancel", style: "cancel" },
                      { text: "Open settings", onPress: () => Linking.openSettings() },
                    ]
              );
            } else {
              Alert.alert(
                result.delivered ? "Local notification delivered" : "Local notification scheduled",
                result.delivered
                  ? "Budget Buddy confirmed the test in iOS Notification Center."
                  : "The test was scheduled, but iOS has not reported it in Notification Center yet."
              );
            }
          } catch {
            Alert.alert("Could not send test", "Check your connection and try again.");
          }
        }}
      />
    </View>
  );
}

function PrivacyBody() {
  const [values, setValues] = useState({
    level: true,
    streak: true,
    league: true,
    wins: true,
  });

  const set = (key: keyof typeof values, value: boolean) => {
    Haptics.selectionAsync();
    setValues((current) => ({ ...current, [key]: value }));
  };

  return (
    <View style={styles.stack}>
      <InfoCard
        icon="shield-check"
        title="Always private"
        body="Balances, transactions, income, budgets, debt, and dollar amounts never appear on Bud profiles or the feed."
      />
      <ToggleRow
        icon="star"
        title="Level and badges"
        body="Show your public gamification identity."
        value={values.level}
        onValueChange={(value) => set("level", value)}
      />
      <ToggleRow
        icon="flame"
        title="Streak"
        body="Let Buds see your streak count."
        value={values.streak}
        onValueChange={(value) => set("streak", value)}
      />
      <ToggleRow
        icon="trophy"
        title="Wealth League tier"
        body="Show your current public league tier."
        value={values.league}
        onValueChange={(value) => set("league", value)}
      />
      <ToggleRow
        icon="users"
        title="Shareable wins"
        body="Allow explicit opt-in sharing from milestones and quests."
        value={values.wins}
        onValueChange={(value) => set("wins", value)}
      />
    </View>
  );
}

function BankConnectionsBody() {
  const {
    status,
    loadingStatus,
    linking,
    readyForLink,
    hasConnections,
    startLink,
  } = usePlaidConnection({
    source: "settings.plaid",
    successAlert: {
      title: "Bank linked",
      message: "Your Sandbox institution is connected.",
    },
  });

  return (
    <View style={styles.stack}>
      {loadingStatus ? (
        <View style={styles.loadingCard}>
          <ActivityIndicator color={Colors.accent} />
          <Text style={styles.loadingText}>Checking Plaid setup...</Text>
        </View>
      ) : (
        <InfoCard
          icon={readyForLink ? "shield-check" : "lock"}
          title={readyForLink ? "Sandbox link is ready" : "Plaid setup needed"}
          body={
            status?.message ??
            "Connect a bank here and Bud can use read-only account context inside private app surfaces."
          }
        />
      )}

      <InfoCard
        icon="eye"
        title="Private to you"
        body="Buds never see balances, transactions, income, debts, account names, or dollar amounts."
      />

      <View style={styles.stackTight}>
        {hasConnections ? (
          status?.connections.map((connection) => (
            <View key={connection.id} style={styles.connectionCard}>
              <View style={styles.connectionHeader}>
                <View style={styles.connectionBankIcon}>
                  <Icon name="building" size={17} color={Colors.accent} strokeWidth={2.4} />
                </View>
                <View style={styles.flex}>
                  <Text style={styles.connectionTitle}>
                    {connection.institutionName || "Linked institution"}
                  </Text>
                  <Text style={styles.rowBody}>
                    {connection.accountCount} linked account{connection.accountCount === 1 ? "" : "s"}
                  </Text>
                </View>
                <Text style={styles.linkedText}>{connection.status}</Text>
              </View>
              {connection.accounts.map((account) => (
                <ConnectionRow
                  key={account.id}
                  title={account.name}
                  body={[account.subtype || account.type, account.mask ? `ending ${account.mask}` : ""]
                    .filter(Boolean)
                    .join(" / ")}
                  status={account.active ? "Linked" : "Inactive"}
                  active={account.active}
                />
              ))}
            </View>
          ))
        ) : (
          <>
            <ConnectionRow
              title="Checking and savings"
              body="Budget, Today, goals, and net worth input."
              status={readyForLink ? "Ready" : "Pending"}
              active={readyForLink}
            />
            <ConnectionRow
              title="Credit cards and loans"
              body="Debt, recurring bills, and net worth input."
            />
            <ConnectionRow
              title="Investment accounts"
              body="Read-only Invest and net worth input."
            />
          </>
        )}
      </View>

      <ActionButton
        label={
          linking
            ? "Opening Plaid..."
            : readyForLink
              ? hasConnections
                ? "Connect another bank"
                : "Connect a bank"
              : "View Plaid setup"
        }
        icon="building"
        onPress={() => {
          startLink();
        }}
        disabled={linking || loadingStatus}
      />
    </View>
  );
}

function SubscriptionBody() {
  const [annual, setAnnual] = useState(true);
  const [status, setStatus] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    billingService.getStatus()
      .then((value) => active && setStatus(value))
      .catch((error) => secureLog.error("settings.subscription failed", error))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  if (loading) {
    return <View style={styles.loadingCard}><ActivityIndicator color={Colors.accent} /></View>;
  }

  return (
    <View style={styles.stack}>
      <View style={styles.billingToggle}>
        <Pressable
          style={[styles.billingPill, !annual && styles.billingPillActive]}
          onPress={() => setAnnual(false)}
        >
          <Text style={[styles.billingText, !annual && styles.billingTextActive]}>
            Monthly
          </Text>
        </Pressable>
        <Pressable
          style={[styles.billingPill, annual && styles.billingPillActive]}
          onPress={() => setAnnual(true)}
        >
          <Text style={[styles.billingText, annual && styles.billingTextActive]}>
            Annual
          </Text>
        </Pressable>
      </View>

      <PlanCard
        title="Free"
        price="$0"
        body="Core budget, goals, XP, streaks, and Buds."
        active={status?.tier === "free"}
      />
      <PlanCard
        title="Premium"
        price={annual ? "Annual" : "Monthly"}
        body="Personalized quests, 90-day blueprint, and more Bud Sessions."
        badge="Coming soon"
        active={status?.tier === "premium"}
      />
      <PlanCard
        title="Elite"
        price={annual ? "Annual" : "Monthly"}
        body="Scenario tools, smart suggestions, priority support, and advanced reports."
        badge="Coming soon"
        active={status?.tier === "elite"}
      />
      <InfoCard
        icon="badge-check"
        title="App Store billing foundation ready"
        body="Product IDs and entitlement webhooks are configured. Purchases stay disabled until App Store Connect is active."
      />
      <ActionButton
        label="Purchases not enabled"
        icon="credit-card"
        onPress={() => {}}
        disabled
      />
    </View>
  );
}

function HelpBody() {
  return (
    <View style={styles.stack}>
      <InfoCard
        icon="message-circle"
        title="Ask Bud"
        body="Bud can explain app features and financial concepts in plain language."
      />
      <InfoCard
        icon="info"
        title="Support"
        body="In-app contact, billing support, and account deletion requests will live here."
      />
      <ActionButton
        label="Go to Bud"
        icon="sparkles"
        onPress={() => {
          Haptics.selectionAsync();
          router.push("/(tabs)/bud");
        }}
      />
    </View>
  );
}

function LegalBody() {
  return (
    <View style={styles.stack}>
      <InfoCard
        icon="shield-check"
        title="Educational only"
        body="Bud explains concepts and tradeoffs. Bud does not make investment, tax, legal, or personalized financial decisions for the user."
      />
      <InfoCard
        icon="lock"
        title="Social privacy"
        body="Buds surfaces behavior and progress signals only. Public posts must not include balances, income, debt, transaction details, or dollar amounts."
      />
      <InfoCard
        icon="info"
        title="Data requests"
        body="Account export and deletion workflows belong here before launch."
      />
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

function SecureField({
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
        secureTextEntry
        autoCapitalize="none"
        placeholderTextColor={Colors.muted}
        style={styles.input}
      />
    </View>
  );
}

function ToggleRow({
  icon,
  title,
  body,
  value,
  onValueChange,
}: {
  icon: IconName;
  title: string;
  body: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.toggleRow}>
      <View style={styles.rowIcon}>
        <Icon name={icon} size={17} color={Colors.accent} strokeWidth={2.4} />
      </View>
      <View style={styles.toggleTextWrap}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowBody}>{body}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: Colors.navy100, true: Colors.accentAlpha40 }}
        thumbColor={value ? Colors.accent : Colors.card}
        ios_backgroundColor={Colors.navy100}
      />
    </View>
  );
}

function ConnectionRow({
  title,
  body,
  status = "Pending",
  active = false,
}: {
  title: string;
  body: string;
  status?: string;
  active?: boolean;
}) {
  return (
    <View style={styles.connectionRow}>
      <View style={[styles.connectionDot, active && styles.connectionDotActive]} />
      <View style={styles.flex}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowBody}>{body}</Text>
      </View>
      <Text style={[styles.pendingText, active && styles.linkedText]}>{status}</Text>
    </View>
  );
}

function PlanCard({
  title,
  price,
  body,
  badge,
  active,
}: {
  title: string;
  price: string;
  body: string;
  badge?: string;
  active?: boolean;
}) {
  return (
    <View style={[styles.planCard, active && styles.planCardActive]}>
      <View style={styles.planTop}>
        <View>
          <Text style={styles.planTitle}>{title}</Text>
          <Text style={styles.planBody}>{body}</Text>
        </View>
        <Text style={styles.planPrice}>{price}</Text>
      </View>
      <View style={styles.planBottom}>
        {badge ? <Text style={styles.planBadge}>{badge}</Text> : <View />}
        {active ? <Text style={styles.activePlan}>Current</Text> : null}
      </View>
    </View>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function InfoCard({
  icon,
  title,
  body,
}: {
  icon: IconName;
  title: string;
  body: string;
}) {
  return (
    <View style={styles.infoCard}>
      <View style={styles.infoIcon}>
        <Icon name={icon} size={17} color={Colors.accent} strokeWidth={2.4} />
      </View>
      <View style={styles.flex}>
        <Text style={styles.infoTitle}>{title}</Text>
        <Text style={styles.infoBody}>{body}</Text>
      </View>
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
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      style={({ pressed }) => [
        styles.actionButton,
        disabled && styles.actionButtonDisabled,
        pressed && !disabled && styles.actionButtonPressed,
      ]}
      onPress={onPress}
    >
      <Icon
        name={icon}
        size={17}
        color={disabled ? Colors.navyMuted : Colors.onAction}
        strokeWidth={2.5}
      />
      <Text
        style={[styles.actionButtonText, disabled && styles.actionButtonTextDisabled]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function normaliseScreen(value?: string): SettingsScreen {
  const first = Array.isArray(value) ? value[0] : value;
  if (first && first in SCREEN_META) return first as SettingsScreen;
  return "edit-profile";
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
  hero: {
    alignItems: "center",
    paddingVertical: 18,
    marginBottom: 16,
  },
  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
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
  stack: { gap: 14 },
  stackTight: { gap: 10 },
  fieldWrap: { gap: 8 },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: Colors.navyMuted,
    marginLeft: 4,
  },
  input: {
    minHeight: 52,
    borderRadius: 15,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: "700",
    color: Colors.navy,
  },
  textArea: { minHeight: 108, lineHeight: 20 },
  readOnlyField: {
    minHeight: 52,
    borderRadius: 15,
    backgroundColor: Colors.navy50,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 15,
    justifyContent: "center",
  },
  readOnlyText: { fontSize: 15, fontWeight: "700", color: Colors.navyMuted },
  loadingCard: {
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    minHeight: 150,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 18,
  },
  loadingText: { fontSize: 13, fontWeight: "700", color: Colors.navyMuted },
  metricGrid: { flexDirection: "row", gap: 10 },
  metric: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 15,
    borderRadius: 16,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  metricValue: { fontSize: 17, fontWeight: "900", color: Colors.navy },
  metricLabel: { marginTop: 4, fontSize: 11, fontWeight: "700", color: Colors.muted },
  goalRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 70,
    padding: 13,
    borderRadius: 16,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  rowPressed: { backgroundColor: Colors.navy50, transform: [{ scale: 0.99 }] },
  goalIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.greenSurface,
    borderWidth: 1,
    borderColor: Colors.greenBorder,
  },
  goalTextWrap: { flex: 1, minWidth: 0 },
  goalName: { fontSize: 14, fontWeight: "900", color: Colors.navy },
  goalMeta: { marginTop: 3, fontSize: 12, fontWeight: "700", color: Colors.muted },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 16,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  rowIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.greenSurface,
    borderWidth: 1,
    borderColor: Colors.greenBorder,
  },
  toggleTextWrap: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 14, fontWeight: "900", color: Colors.navy },
  rowBody: { marginTop: 3, fontSize: 12, fontWeight: "600", color: Colors.navyMuted, lineHeight: 17 },
  connectionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 16,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  connectionCard: {
    gap: 10,
    padding: 12,
    borderRadius: 18,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  connectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 2,
    paddingBottom: 2,
  },
  connectionBankIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.greenSurface,
    borderWidth: 1,
    borderColor: Colors.greenBorder,
  },
  connectionTitle: { fontSize: 15, fontWeight: "900", color: Colors.navy },
  connectionDot: {
    width: 12,
    height: 12,
    borderRadius: 999,
    backgroundColor: Colors.accentAlpha30,
    borderWidth: 2,
    borderColor: Colors.accent,
  },
  connectionDotActive: { backgroundColor: Colors.accent },
  pendingText: { fontSize: 11, fontWeight: "900", color: Colors.muted },
  linkedText: { fontSize: 11, fontWeight: "900", color: Colors.accent },
  billingToggle: {
    flexDirection: "row",
    padding: 4,
    borderRadius: 999,
    backgroundColor: Colors.navy50,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  billingPill: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 11,
    borderRadius: 999,
  },
  billingPillActive: { backgroundColor: Colors.card },
  billingText: { fontSize: 13, fontWeight: "900", color: Colors.muted },
  billingTextActive: { color: Colors.navy },
  planCard: {
    padding: 16,
    borderRadius: 18,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 12,
  },
  planCardActive: { borderColor: Colors.accentAlpha45, backgroundColor: Colors.greenSurface },
  planTop: { flexDirection: "row", justifyContent: "space-between", gap: 14 },
  planTitle: { fontSize: 16, fontWeight: "900", color: Colors.navy },
  planBody: { marginTop: 5, maxWidth: 220, fontSize: 12, fontWeight: "600", color: Colors.navyMuted, lineHeight: 17 },
  planPrice: { fontSize: 15, fontWeight: "900", color: Colors.accent },
  planBottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  planBadge: { fontSize: 11, fontWeight: "900", color: Colors.accent },
  activePlan: { fontSize: 11, fontWeight: "900", color: Colors.navyMuted },
  infoCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 15,
    borderRadius: 17,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  infoIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.greenSurface,
    borderWidth: 1,
    borderColor: Colors.greenBorder,
  },
  infoTitle: { fontSize: 14, fontWeight: "900", color: Colors.navy },
  infoBody: { marginTop: 4, fontSize: 12, fontWeight: "600", color: Colors.navyMuted, lineHeight: 18 },
  actionButton: {
    minHeight: 54,
    borderRadius: 16,
    backgroundColor: Colors.actionSurface,
    borderWidth: 1,
    borderColor: Colors.actionBorder,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 9,
    shadowColor: Colors.accent,
    shadowOpacity: 0.24,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },
  actionButtonPressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
  // Disabled uses an explicit surface instead of opacity so the button stays
  // visible in dark mode (faded green + near-black label vanished on black).
  actionButtonDisabled: {
    backgroundColor: Colors.navy100,
    borderColor: Colors.border,
    shadowOpacity: 0,
    elevation: 0,
  },
  actionButtonText: { fontSize: 15, fontWeight: "900", color: Colors.onAction },
  actionButtonTextDisabled: { color: Colors.navyMuted },
});

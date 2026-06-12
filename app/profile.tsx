/**
 * Profile & Settings — accessible from any tab (developer review §6).
 *
 * Presented as a stack screen over the tabs. Shows the user's public
 * gamification identity (level, streak, XP, net worth) plus the settings
 * menus the review calls for: goal management, notifications, privacy,
 * bank connections, subscription, and legal.
 *
 * Frontend-only for now — rows that need a backend are wired to clear
 * placeholders so the structure is real and ready to connect.
 */

import React, { useEffect, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { MotiView } from "moti";

import { Colors } from "@/constants/colors";
import { Icon, type IconName } from "@/components/Icon";
import { FadeInUp } from "@/animations";
import { useUser, useAuthActions } from "@/hooks/useAuth";
import { budgetService, linkedAccountNetWorth } from "@/services/budgetService";
import { formatCurrency, secureLog } from "@/utils/security";

const TIER_LABEL: Record<string, string> = {
  free: "Free plan",
  premium: "Premium",
  elite: "Elite",
};

type SettingsScreen =
  | "edit-profile"
  | "goals"
  | "notifications"
  | "privacy"
  | "bank-connections"
  | "subscription"
  | "help"
  | "legal";

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const user = useUser();
  const { logout } = useAuthActions();
  const [linkedNetWorth, setLinkedNetWorth] = useState<number | null>(null);

  useEffect(() => {
    if (!user) return;
    let alive = true;

    (async () => {
      try {
        const accounts = await budgetService.getAccounts();
        if (alive) setLinkedNetWorth(linkedAccountNetWorth(accounts));
      } catch (error) {
        secureLog.warn("profile.accounts failed", error);
      }
    })();

    return () => {
      alive = false;
    };
  }, [user]);

  if (!user) return null;

  const initials = `${user.firstName?.[0] ?? ""}${user.lastName?.[0] ?? ""}`.toUpperCase();
  const memberSince = new Date(user.joinedAt).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
  const xpPct = user.xpToNextLevel
    ? Math.min(1, user.xp / user.xpToNextLevel)
    : 0;
  const displayNetWorth = linkedNetWorth ?? user.netWorth;

  const close = () => {
    Haptics.selectionAsync();
    router.back();
  };

  const handleLogout = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    logout();
    router.replace("/(auth)/welcome");
  };

  const openRoute = (href: Parameters<typeof router.push>[0]) => {
    Haptics.selectionAsync();
    router.push(href);
  };

  const openSettings = (screen: SettingsScreen) => {
    openRoute(`/settings/${screen}`);
  };

  return (
    <View style={styles.container}>
      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.topTitle}>Profile</Text>
        <Pressable onPress={close} hitSlop={10} style={styles.closeBtn}>
          <Icon name="x" size={18} color={Colors.navy} strokeWidth={2.4} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + 32 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Identity hero */}
        <FadeInUp>
          <View style={styles.hero}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials || "BB"}</Text>
            </View>
            <Text style={styles.name}>
              {user.firstName} {user.lastName}
            </Text>
            <Text style={styles.email}>{user.email}</Text>

            <View style={styles.heroChips}>
              <View style={styles.levelChip}>
                <Icon name="star" size={12} color={Colors.gold} strokeWidth={2.6} />
                <Text style={styles.levelChipText}>Level {user.level}</Text>
              </View>
              <View style={styles.tierChip}>
                <Icon name="badge-check" size={12} color={Colors.teal} strokeWidth={2.6} />
                <Text style={styles.tierChipText}>
                  {TIER_LABEL[user.subscriptionTier] ?? "Free plan"}
                </Text>
              </View>
            </View>

            {/* XP toward next level */}
            <View style={styles.xpWrap}>
              <View style={styles.xpLabelRow}>
                <Text style={styles.xpLabel}>{user.xp} XP</Text>
                <Text style={styles.xpLabelMuted}>
                  {user.xpToNextLevel} to level {user.level + 1}
                </Text>
              </View>
              <View style={styles.xpTrack}>
                <MotiView
                  from={{ width: "0%" }}
                  animate={{ width: `${xpPct * 100}%` }}
                  transition={{ type: "timing", duration: 700, delay: 150 }}
                  style={styles.xpFill}
                />
              </View>
            </View>

            <Text style={styles.memberSince}>Member since {memberSince}</Text>
          </View>
        </FadeInUp>

        {/* Quick stats */}
        <FadeInUp delay={80}>
          <View style={styles.statsRow}>
            <StatCell icon="flame" tint={Colors.gold} value={`${user.streak}`} label="Day streak" />
            <View style={styles.statDivider} />
            <StatCell
              icon="wallet"
              tint={Colors.teal}
              value={formatCurrency(displayNetWorth, { compact: true })}
              label="Net worth"
            />
            <View style={styles.statDivider} />
            <StatCell
              icon="shield-check"
              tint={Colors.emerald}
              value={user.financialHealthScore ? `${user.financialHealthScore}` : "—"}
              label="Health"
            />
          </View>
        </FadeInUp>

        {/* Account */}
        <FadeInUp delay={140}>
          <SettingsGroup title="ACCOUNT">
            <Row icon="user" label="Edit profile" onPress={() => openSettings("edit-profile")} />
            <Row
              icon="target"
              label="Goal management"
              onPress={() => openSettings("goals")}
            />
            <Row
              icon="building"
              label="Bank connections"
              sub="Connect or manage"
              onPress={() => openSettings("bank-connections")}
              last
            />
          </SettingsGroup>
        </FadeInUp>

        {/* Billing */}
        <FadeInUp delay={200}>
          <SettingsGroup title="MEMBERSHIP">
            <Row icon="badge-check" label="Subscription & billing" sub="App Store" onPress={() => openSettings("subscription")} />
            <Row icon="user-plus" label="Invite Buds - earn rewards" onPress={() => openRoute("/buds/invite")} last />
          </SettingsGroup>
        </FadeInUp>

        {/* Preferences */}
        <FadeInUp delay={260}>
          <SettingsGroup title="PREFERENCES">
            <Row icon="bell" label="Notifications" onPress={() => openSettings("notifications")} />
            <Row icon="lock" label="Privacy & what Buds see" onPress={() => openSettings("privacy")} last />
          </SettingsGroup>
        </FadeInUp>

        {/* Support */}
        <FadeInUp delay={320}>
          <SettingsGroup title="SUPPORT">
            <Row icon="message-circle" label="Help & contact" onPress={() => openSettings("help")} />
            <Row icon="info" label="Legal & disclaimers" onPress={() => openSettings("legal")} last />
          </SettingsGroup>
        </FadeInUp>

        {/* Sign out */}
        <FadeInUp delay={380}>
          <Pressable
            style={({ pressed }) => [styles.signOut, pressed && { opacity: 0.85 }]}
            onPress={handleLogout}
          >
            <Text style={styles.signOutText}>Sign out</Text>
          </Pressable>
        </FadeInUp>
      </ScrollView>
    </View>
  );
}

function StatCell({
  icon,
  tint,
  value,
  label,
}: {
  icon: IconName;
  tint: string;
  value: string;
  label: string;
}) {
  return (
    <View style={styles.statCell}>
      <View style={[styles.statIcon, { backgroundColor: `${tint}1A` }]}>
        <Icon name={icon} size={15} color={tint} strokeWidth={2.4} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function SettingsGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.group}>
      <Text style={styles.groupTitle}>{title}</Text>
      <View style={styles.groupCard}>{children}</View>
    </View>
  );
}

function Row({
  icon,
  label,
  sub,
  onPress,
  last,
}: {
  icon: IconName;
  label: string;
  sub?: string;
  onPress: () => void;
  last?: boolean;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.row,
        !last && styles.rowBorder,
        pressed && styles.rowPressed,
      ]}
      onPress={onPress}
    >
      <View style={styles.rowContent}>
        <View style={styles.rowIcon}>
          <Icon name={icon} size={17} color={Colors.navy} strokeWidth={2.2} />
        </View>
        <View style={styles.rowTextWrap}>
          <Text style={styles.rowLabel}>{label}</Text>
          {sub ? <Text style={styles.rowSub}>{sub}</Text> : null}
        </View>
        <Icon name="chevron-right" size={16} color={Colors.muted} strokeWidth={2.2} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  topTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: Colors.navy,
  },
  closeBtn: {
    position: "absolute",
    right: 16,
    top: undefined,
    bottom: 6,
    width: 34,
    height: 34,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.navy50,
  },

  scroll: {
    paddingHorizontal: 20,
  },

  hero: {
    alignItems: "center",
    paddingVertical: 8,
    marginBottom: 18,
  },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 999,
    backgroundColor: Colors.gold,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: Colors.gold,
    shadowOpacity: 0.3,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  avatarText: {
    fontSize: 30,
    fontWeight: "800",
    color: Colors.onGreen,
  },
  name: {
    marginTop: 14,
    fontSize: 22,
    fontWeight: "800",
    color: Colors.navy,
    letterSpacing: -0.3,
  },
  email: {
    marginTop: 3,
    fontSize: 13,
    fontWeight: "600",
    color: Colors.muted,
  },
  heroChips: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  levelChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: Colors.accentAlpha10,
    borderWidth: 1,
    borderColor: Colors.accentAlpha40,
  },
  levelChipText: { fontSize: 12, fontWeight: "800", color: Colors.gold },
  tierChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: Colors.emerald50,
    borderWidth: 1,
    borderColor: Colors.emerald100,
  },
  tierChipText: { fontSize: 12, fontWeight: "800", color: Colors.teal },

  xpWrap: { alignSelf: "stretch", marginTop: 18 },
  xpLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 7,
  },
  xpLabel: { fontSize: 12, fontWeight: "800", color: Colors.navy },
  xpLabelMuted: { fontSize: 12, fontWeight: "600", color: Colors.muted },
  xpTrack: {
    height: 8,
    borderRadius: 5,
    backgroundColor: Colors.border,
    overflow: "hidden",
  },
  xpFill: { height: 8, borderRadius: 5, backgroundColor: Colors.gold },

  memberSince: {
    marginTop: 16,
    fontSize: 12,
    fontWeight: "600",
    color: Colors.muted,
  },

  statsRow: {
    flexDirection: "row",
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 18,
    paddingVertical: 16,
    marginBottom: 22,
    shadowColor: Colors.navy,
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  statCell: { flex: 1, alignItems: "center", gap: 6 },
  statDivider: { width: 1, backgroundColor: Colors.border, marginVertical: 4 },
  statIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  statValue: { fontSize: 17, fontWeight: "800", color: Colors.navy, letterSpacing: -0.2 },
  statLabel: { fontSize: 11, fontWeight: "600", color: Colors.muted },

  group: { marginBottom: 22 },
  groupTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: Colors.muted,
    letterSpacing: 1.2,
    marginBottom: 10,
    marginLeft: 6,
  },
  groupCard: {
    backgroundColor: Colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: "hidden",
    shadowColor: Colors.navy,
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  row: {
    backgroundColor: Colors.card,
    paddingHorizontal: 14,
  },
  rowContent: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 64,
    paddingVertical: 12,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  rowPressed: { backgroundColor: Colors.navy50 },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.greenSurface,
    borderWidth: 1,
    borderColor: Colors.greenBorder,
    marginRight: 13,
  },
  rowTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  rowLabel: { fontSize: 15, fontWeight: "700", color: Colors.navy },
  rowSub: { fontSize: 12, fontWeight: "600", color: Colors.muted, marginTop: 2 },

  signOut: {
    alignItems: "center",
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  signOutText: { fontSize: 15, fontWeight: "800", color: Colors.coral },
});

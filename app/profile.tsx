/**
 * Profile — identity, money at a glance, and settings in the calm card
 * language of the tabs. Presented as a modal from the Today avatar.
 *
 * Only live numbers appear: net worth from linked accounts (the same figure
 * Budget shows), the financial health score that weekly quests move, and
 * quest XP. Streak and level stay off until the backend advances them.
 */

import React, { useCallback, useRef } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useQuery } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";

import { CountUp, FadeInUp, GrowBar, Shimmer, useFocusReplay } from "@/animations";
import { BrandLogo } from "@/components/BrandLogo";
import { Icon, type IconName } from "@/components/Icon";
import { Colors } from "@/constants/colors";
import { Type } from "@/constants/tokens";
import { useUser, useAuthActions } from "@/hooks/useAuth";
import type { AccountSummary } from "@/mock/budget";
import {
  BUDGET_KEYS,
  budgetService,
  linkedAccountNetWorth,
} from "@/services/budgetService";
import { formatCurrency } from "@/utils/security";

const TIER_LABEL: Record<string, string> = {
  free: "Free plan",
  premium: "Premium",
  elite: "Elite",
};

// The financial health score runs 1–500 (backend/internal/quests/score.go).
const HEALTH_MAX = 500;

type SettingsScreen =
  | "edit-profile"
  | "goals"
  | "notifications"
  | "privacy"
  | "bank-connections"
  | "subscription"
  | "help"
  | "legal";

// Tile tints stay static styles; only opacity and size ever animate.
const TONES = {
  brand: { tile: Colors.accentAlpha12, icon: Colors.gold },
  neutral: { tile: Colors.navy50, icon: Colors.navyMuted },
  danger: { tile: "rgba(239, 68, 68, 0.1)", icon: Colors.coral },
} as const;

type Tone = keyof typeof TONES;

const formatXp = (n: number) => Math.round(n).toLocaleString("en-US");

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const user = useUser();
  const { logout } = useAuthActions();
  // Numbers roll in again whenever Profile regains focus.
  const replay = useFocusReplay();

  // Keyed by user so one account's balances never render for another.
  const accounts = useQuery({
    queryKey: [...BUDGET_KEYS.accounts(), user?.id],
    queryFn: () => budgetService.getAccounts(),
    enabled: Boolean(user),
    retry: 1,
  });

  // Returning from Bank connections should show newly linked accounts.
  const { refetch } = accounts;
  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      void refetch();
    }, [refetch])
  );

  if (!user) return null;

  const fullName = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || "Your profile";
  const initials =
    `${user.firstName?.[0] ?? ""}${user.lastName?.[0] ?? ""}`.toUpperCase() ||
    user.email?.[0]?.toUpperCase() ||
    "?";
  const joined = new Date(user.joinedAt);
  const memberSince = Number.isNaN(joined.getTime())
    ? null
    : joined.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const score = user.financialHealthScore;
  const hasScore = Number.isFinite(score) && score > 0;
  // iOS presents this route as a page sheet that starts below the status
  // bar; elsewhere it covers the whole screen.
  const topPad = Platform.OS === "ios" ? 18 : insets.top + 12;

  const close = () => {
    Haptics.selectionAsync();
    router.back();
  };

  const openSettings = (screen: SettingsScreen) => {
    Haptics.selectionAsync();
    router.push(`/settings/${screen}`);
  };

  const signOut = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    void logout();
    router.replace("/(auth)/welcome");
  };

  const confirmSignOut = () => {
    Haptics.selectionAsync();
    Alert.alert("Sign out?", "You can sign back in anytime.", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: signOut },
    ]);
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.header, { paddingTop: topPad }]}>
          <LinearGradient
            pointerEvents="none"
            colors={[Colors.accentAlpha14, Colors.accentAlpha05, "transparent"]}
            style={styles.glow}
          />
          <View style={styles.brandRow}>
            <BrandLogo variant="mark" markSize={26} />
            <Text style={styles.brandEyebrow}>PROFILE</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close profile"
              hitSlop={8}
              onPress={close}
              style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}
            >
              <Icon name="x" size={18} color={Colors.navy} strokeWidth={2.4} />
            </Pressable>
          </View>

          <FadeInUp>
            <View style={styles.identity}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText} maxFontSizeMultiplier={1.2}>
                  {initials}
                </Text>
              </View>
              <View style={styles.identityCopy}>
                <Text
                  style={styles.name}
                  accessibilityRole="header"
                  maxFontSizeMultiplier={1.3}
                >
                  {fullName}
                </Text>
                <Text style={styles.email} numberOfLines={1} ellipsizeMode="middle">
                  {user.email}
                </Text>
              </View>
            </View>
            <View style={styles.metaRow}>
              <View style={styles.planPill}>
                <Icon name="badge-check" size={13} color={Colors.teal} strokeWidth={2.4} />
                <Text style={styles.planPillText}>
                  {TIER_LABEL[user.subscriptionTier] ?? "Free plan"}
                </Text>
              </View>
              {memberSince ? (
                <Text style={styles.memberSince}>Member since {memberSince}</Text>
              ) : null}
            </View>
          </FadeInUp>
        </View>

        <View style={styles.body}>
          <FadeInUp delay={60}>
            <NetWorthCard
              accounts={accounts.data}
              loading={accounts.isPending}
              failed={accounts.isError}
              replayKey={replay}
              onRetry={() => {
                Haptics.selectionAsync();
                void refetch();
              }}
              onConnect={() => openSettings("bank-connections")}
            />
          </FadeInUp>

          {/* Quiet strip: live game stats only (streak and level wait for the backend). */}
          <FadeInUp delay={120}>
            <View style={styles.strip}>
              <View
                style={styles.stripCell}
                accessible
                accessibilityLabel={
                  hasScore
                    ? `Financial health ${score} out of ${HEALTH_MAX}`
                    : "Financial health not available yet"
                }
              >
                <Text style={styles.stripLabel}>Financial health</Text>
                {/* One line that shrinks to fit, so large text never runs into the divider. */}
                <Text
                  style={styles.stripValue}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.5}
                >
                  {hasScore ? (
                    <CountUp
                      value={score}
                      from={score * 0.85}
                      replayKey={replay}
                      style={styles.stripValue}
                    />
                  ) : (
                    "—"
                  )}
                  <Text style={styles.stripOf}>{` / ${HEALTH_MAX}`}</Text>
                </Text>
                <GrowBar
                  progress={hasScore ? score / HEALTH_MAX : 0}
                  color={Colors.gold}
                  trackColor={Colors.navy50}
                  height={5}
                  delay={120}
                  replayKey={replay}
                  style={styles.stripBar}
                />
              </View>
              <View style={styles.stripDivider} />
              <View
                style={styles.stripCell}
                accessible
                accessibilityLabel={`${formatXp(user.xp)} quest XP, earned from weekly quests`}
              >
                <Text style={styles.stripLabel}>Quest XP</Text>
                <CountUp
                  value={user.xp}
                  from={user.xp * 0.85}
                  replayKey={replay}
                  format={formatXp}
                  fit
                  style={styles.stripValue}
                />
                <Text style={styles.stripSub}>from weekly quests</Text>
              </View>
            </View>
          </FadeInUp>

          <FadeInUp delay={180}>
            <MenuGroup title="Account">
              <MenuRow icon="user" label="Edit profile" onPress={() => openSettings("edit-profile")} />
              <MenuRow icon="target" label="Goal management" onPress={() => openSettings("goals")} />
              <MenuRow
                icon="building"
                label="Bank connections"
                sub="Connect or manage"
                onPress={() => openSettings("bank-connections")}
                last
              />
            </MenuGroup>
          </FadeInUp>

          <FadeInUp delay={240}>
            <MenuGroup title="Membership">
              <MenuRow
                icon="badge-check"
                label="Subscription & billing"
                sub="App Store"
                onPress={() => openSettings("subscription")}
                last
              />
            </MenuGroup>
          </FadeInUp>

          <FadeInUp delay={300}>
            <MenuGroup title="Preferences">
              <MenuRow icon="bell" label="Notifications" onPress={() => openSettings("notifications")} />
              <MenuRow icon="lock" label="Privacy" onPress={() => openSettings("privacy")} last />
            </MenuGroup>
          </FadeInUp>

          <FadeInUp delay={360}>
            <MenuGroup title="Support">
              <MenuRow
                icon="message-circle"
                label="Help & contact"
                tone="neutral"
                onPress={() => openSettings("help")}
              />
              <MenuRow
                icon="info"
                label="Legal & disclaimers"
                tone="neutral"
                onPress={() => openSettings("legal")}
                last
              />
            </MenuGroup>
          </FadeInUp>

          <FadeInUp delay={420}>
            <View style={[styles.groupCard, styles.signOutCard]}>
              <MenuRow
                icon="log-out"
                label="Sign out"
                tone="danger"
                accessibilityHint="Asks you to confirm before signing out"
                onPress={confirmSignOut}
                last
              />
            </View>
          </FadeInUp>
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Net worth ──────────────────────────────────────────────────────────────

function NetWorthCard({
  accounts,
  loading,
  failed,
  replayKey,
  onRetry,
  onConnect,
}: {
  accounts: AccountSummary[] | undefined;
  loading: boolean;
  failed: boolean;
  replayKey: number;
  onRetry: () => void;
  onConnect: () => void;
}) {
  if (!accounts) {
    if (loading) {
      return (
        <View style={styles.card}>
          <Text style={styles.eyebrow}>NET WORTH</Text>
          <Shimmer style={styles.amountSkeleton} radius={10} />
          <Shimmer style={styles.subSkeleton} radius={6} />
        </View>
      );
    }
    return (
      <View style={styles.card}>
        <Text style={styles.eyebrow}>NET WORTH</Text>
        <Text style={styles.cardBody} accessibilityRole={failed ? "alert" : undefined}>
          Couldn't load your balances right now.
        </Text>
        <PillButton label="Try again" onPress={onRetry} />
      </View>
    );
  }

  if (accounts.length === 0) {
    return (
      <View style={styles.card}>
        <Text style={styles.eyebrow}>NET WORTH</Text>
        <Text style={styles.cardBody}>Link a bank to see your net worth here and on Budget.</Text>
        <PillButton label="Connect a bank" icon="building" onPress={onConnect} />
      </View>
    );
  }

  // Same figure as Budget: linked balances, investments excluded.
  const netWorth = linkedAccountNetWorth(accounts);
  const count = accounts.length;

  return (
    <View
      style={styles.card}
      accessible
      accessibilityLabel={`Net worth ${formatCurrency(netWorth)}, across ${count} linked ${count === 1 ? "account" : "accounts"}`}
    >
      <Text style={styles.eyebrow}>NET WORTH</Text>
      <CountUp
        value={netWorth}
        from={netWorth * 0.9}
        replayKey={replayKey}
        format={formatCurrency}
        fit
        style={styles.netWorth}
        centsStyle={styles.netWorthCents}
      />
      <Text style={styles.cardSub}>
        Across {count} linked {count === 1 ? "account" : "accounts"}
      </Text>
    </View>
  );
}

function PillButton({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon?: IconName;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      hitSlop={6}
      onPress={onPress}
      style={({ pressed }) => [styles.pillButton, pressed && styles.pressed]}
    >
      {icon ? <Icon name={icon} size={14} color={Colors.navy} strokeWidth={2.4} /> : null}
      <Text style={styles.pillButtonText}>{label}</Text>
    </Pressable>
  );
}

// ─── Menu ───────────────────────────────────────────────────────────────────

function MenuGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View>
      <Text style={styles.groupTitle} accessibilityRole="header">
        {title}
      </Text>
      <View style={styles.groupCard}>{children}</View>
    </View>
  );
}

function MenuRow({
  icon,
  label,
  sub,
  tone = "brand",
  accessibilityHint,
  onPress,
  last,
}: {
  icon: IconName;
  label: string;
  sub?: string;
  tone?: Tone;
  accessibilityHint?: string;
  onPress: () => void;
  last?: boolean;
}) {
  const colors = TONES[tone];
  const danger = tone === "danger";

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={sub ? `${label}, ${sub}` : label}
        accessibilityHint={accessibilityHint}
        onPress={onPress}
        style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      >
        <View style={[styles.rowTile, { backgroundColor: colors.tile }]}>
          <Icon name={icon} size={17} color={colors.icon} strokeWidth={2.3} />
        </View>
        <View style={styles.rowCopy}>
          <Text style={[styles.rowLabel, danger && styles.rowLabelDanger]}>{label}</Text>
          {sub ? <Text style={styles.rowSub}>{sub}</Text> : null}
        </View>
        {danger ? null : (
          <Icon name="chevron-right" size={16} color={Colors.muted} strokeWidth={2.2} />
        )}
      </Pressable>
      {last ? null : <View style={styles.rowDivider} />}
    </>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const ROW_TILE = 36;
const ROW_INSET = 16;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  pressed: { opacity: 0.7 },

  // Header — the tabs' calm glow, with the mark, eyebrow, and close.
  header: { paddingHorizontal: 20 },
  glow: { position: "absolute", top: 0, left: 0, right: 0, height: 360 },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 22 },
  brandEyebrow: { ...Type.eyebrow, flex: 1, fontSize: 10, color: Colors.muted },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },

  // Identity
  identity: { flexDirection: "row", alignItems: "center", gap: 14 },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  avatarText: { fontSize: 21, fontWeight: "800", color: Colors.navy },
  identityCopy: { flex: 1, minWidth: 0 },
  name: {
    fontSize: 28,
    lineHeight: 33,
    fontWeight: "800",
    letterSpacing: -0.6,
    color: Colors.navy,
  },
  email: { marginTop: 2, fontSize: 13, fontWeight: "600", color: Colors.muted },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 14,
  },
  planPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: Colors.emerald50,
    borderWidth: 1,
    borderColor: Colors.emerald100,
  },
  planPillText: { fontSize: 11, fontWeight: "800", color: Colors.navy },
  memberSince: { fontSize: 12, fontWeight: "600", color: Colors.muted },

  body: { paddingHorizontal: 18, paddingTop: 22, gap: 12 },

  // Net worth card
  card: {
    padding: 18,
    borderRadius: 22,
    backgroundColor: Colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  eyebrow: { fontSize: 10, fontWeight: "800", letterSpacing: 1.6, color: Colors.muted },
  netWorth: {
    marginTop: 6,
    fontSize: 34,
    fontWeight: "800",
    letterSpacing: -1,
    color: Colors.navy,
  },
  // Cents sit quieter than dollars.
  netWorthCents: { color: Colors.muted, fontWeight: "700" },
  cardSub: { marginTop: 6, fontSize: 12, fontWeight: "600", color: Colors.muted },
  cardBody: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
    color: Colors.navyMuted,
  },
  amountSkeleton: { height: 34, width: "55%", marginTop: 8 },
  subSkeleton: { height: 12, width: "38%", marginTop: 10 },
  pillButton: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 36,
    marginTop: 14,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: Colors.navy50,
  },
  pillButtonText: { fontSize: 13, fontWeight: "700", color: Colors.navy },

  // Quiet strip (matches the Goals summary row)
  strip: {
    flexDirection: "row",
    padding: 16,
    borderRadius: 22,
    backgroundColor: Colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  stripCell: { flex: 1, minWidth: 0, paddingHorizontal: 6 },
  stripDivider: {
    width: StyleSheet.hairlineWidth,
    marginHorizontal: 8,
    backgroundColor: Colors.border,
  },
  stripLabel: {
    marginBottom: 6,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.1,
    textTransform: "uppercase",
    color: Colors.muted,
  },
  stripValue: { fontSize: 20, fontWeight: "800", color: Colors.navy, fontVariant: ["tabular-nums"] },
  stripOf: { fontSize: 13, fontWeight: "700", color: Colors.muted },
  stripBar: { marginTop: 10 },
  stripSub: { marginTop: 3, fontSize: 11, color: Colors.muted },

  // Menu
  groupTitle: {
    marginTop: 12,
    marginBottom: 8,
    marginLeft: 4,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: Colors.muted,
  },
  groupCard: {
    overflow: "hidden",
    borderRadius: 22,
    backgroundColor: Colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  signOutCard: { marginTop: 20 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 60,
    paddingHorizontal: ROW_INSET,
    paddingVertical: 10,
  },
  rowPressed: { backgroundColor: Colors.navy50 },
  rowTile: {
    width: ROW_TILE,
    height: ROW_TILE,
    borderRadius: ROW_TILE / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  rowCopy: { flex: 1, minWidth: 0 },
  rowLabel: { fontSize: 15, fontWeight: "700", color: Colors.navy },
  rowLabelDanger: { color: Colors.coral },
  rowSub: { marginTop: 1, fontSize: 12, fontWeight: "500", color: Colors.muted },
  // Hairlines start under the text, like grouped iOS lists.
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: ROW_INSET + ROW_TILE + 12,
    backgroundColor: Colors.border,
  },
});

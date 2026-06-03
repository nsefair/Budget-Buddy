import React from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

import { Colors } from "@/constants/colors";
import { BrandHeader } from "@/components/BrandLogo";
import { Icon, type IconName } from "@/components/Icon";
import { useUser } from "@/hooks/useAuth";

export default function InviteBudsScreen() {
  const insets = useSafeAreaInsets();
  const user = useUser();
  const code = user ? `BUD-${user.id.slice(-6).toUpperCase()}` : "BUD-READY";
  const referralLink = `https://budgetbuddy.app/invite/${code}`;

  const showInvite = () => {
    Haptics.selectionAsync();
    Alert.alert("Invite link", referralLink);
  };

  return (
    <View style={styles.container}>
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={goBack} hitSlop={10} style={styles.iconBtn}>
          <Icon name="arrow-left" size={18} color={Colors.navy} strokeWidth={2.4} />
        </Pressable>
        <BrandHeader style={styles.brandHeader} />
        <View style={styles.iconBtnGhost} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + 32 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Icon name="user-plus" size={22} color={Colors.accent} strokeWidth={2.5} />
          </View>
          <Text style={styles.eyebrow}>REFERRALS</Text>
          <Text style={styles.title}>Invite Buds</Text>
          <Text style={styles.subtitle}>
            Share Budget Buddy with people who would actually cheer for your wins.
          </Text>
        </View>

        <View style={styles.linkCard}>
          <Text style={styles.linkLabel}>Your referral code</Text>
          <Text style={styles.codeText}>{code}</Text>
          <Text style={styles.linkText}>{referralLink}</Text>
          <Pressable style={styles.primaryBtn} onPress={showInvite}>
            <Icon name="user-plus" size={17} color={Colors.onAccent} strokeWidth={2.5} />
            <Text style={styles.primaryBtnText}>Share invite</Text>
          </Pressable>
        </View>

        <View style={styles.rewardGrid}>
          <RewardCard icon="zap" value="+500 XP" label="When a friend finishes onboarding" />
          <RewardCard icon="badge-check" value="30 days" label="Premium extension after bank link" />
        </View>

        <InfoCard
          icon="users"
          title="Community Builder"
          body="Three successful referrals unlock the Community Builder badge. The referral leaderboard will live here as the network grows."
        />

        <Text style={styles.sectionTitle}>Referral status</Text>
        <View style={styles.statusCard}>
          <StatusRow name="Invites sent" value="0" />
          <StatusRow name="Friends onboarded" value="0" />
          <StatusRow name="Rewards earned" value="0 XP" />
        </View>
      </ScrollView>
    </View>
  );
}

function RewardCard({
  icon,
  value,
  label,
}: {
  icon: IconName;
  value: string;
  label: string;
}) {
  return (
    <View style={styles.rewardCard}>
      <Icon name={icon} size={18} color={Colors.accent} strokeWidth={2.4} />
      <Text style={styles.rewardValue}>{value}</Text>
      <Text style={styles.rewardLabel}>{label}</Text>
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
      <View style={{ flex: 1 }}>
        <Text style={styles.infoTitle}>{title}</Text>
        <Text style={styles.infoBody}>{body}</Text>
      </View>
    </View>
  );
}

function StatusRow({ name, value }: { name: string; value: string }) {
  return (
    <View style={styles.statusRow}>
      <Text style={styles.statusName}>{name}</Text>
      <Text style={styles.statusValue}>{value}</Text>
    </View>
  );
}

function goBack() {
  Haptics.selectionAsync();
  router.back();
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
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
  scroll: { paddingHorizontal: 20, paddingTop: 8, gap: 14 },
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
  title: { fontSize: 26, fontWeight: "900", color: Colors.navy, letterSpacing: 0 },
  subtitle: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: "600",
    color: Colors.navyMuted,
    textAlign: "center",
    lineHeight: 19,
  },
  linkCard: {
    alignItems: "center",
    gap: 10,
    padding: 18,
    borderRadius: 18,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  linkLabel: { fontSize: 11, fontWeight: "900", color: Colors.muted, letterSpacing: 1 },
  codeText: { fontSize: 24, fontWeight: "900", color: Colors.navy, letterSpacing: 0 },
  linkText: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.navyMuted,
    textAlign: "center",
  },
  primaryBtn: {
    marginTop: 8,
    minHeight: 52,
    alignSelf: "stretch",
    borderRadius: 16,
    backgroundColor: Colors.accent,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
  },
  primaryBtnText: { fontSize: 15, fontWeight: "900", color: Colors.onAccent },
  rewardGrid: { flexDirection: "row", gap: 10 },
  rewardCard: {
    flex: 1,
    alignItems: "center",
    gap: 7,
    padding: 15,
    borderRadius: 17,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  rewardValue: { fontSize: 17, fontWeight: "900", color: Colors.navy },
  rewardLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.muted,
    textAlign: "center",
    lineHeight: 16,
  },
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
  infoBody: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: "600",
    color: Colors.navyMuted,
    lineHeight: 18,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "900",
    color: Colors.muted,
    letterSpacing: 1.1,
    marginTop: 4,
    marginLeft: 3,
  },
  statusCard: {
    borderRadius: 17,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: "hidden",
  },
  statusRow: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 15,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  statusName: { fontSize: 13, fontWeight: "800", color: Colors.navy },
  statusValue: { fontSize: 13, fontWeight: "900", color: Colors.accent },
});

/**
 * Step 9 — Optional Buds share.
 *
 * Per the onboarding flow: user can post a starting moment to the social
 * feed. Strictly opt-in. Privacy is non-negotiable.
 */

import React, { useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { BudBubble } from "../components/BudBubble";
import { Headline, Subheadline } from "../components/Headline";
import { Icon, type IconName } from "@/components/Icon";
import { Colors } from "@/constants/colors";

interface Props {
  firstName: string;
  whyIcon: IconName;
  share: boolean;
  onChangeShare: (v: boolean) => void;
}

export function StepShare({ firstName, whyIcon, share, onChangeShare }: Props) {
  const press = useRef(new Animated.Value(1)).current;

  const toggle = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onChangeShare(!share);
    Animated.sequence([
      Animated.timing(press, { toValue: 0.96, duration: 100, useNativeDriver: true }),
      Animated.spring(press, { toValue: 1, damping: 12, stiffness: 220, useNativeDriver: true }),
    ]).start();
  };

  return (
    <View style={{ gap: 18 }}>
      <BudBubble label="Buds — optional" />
      <Headline>Tell your Buds.</Headline>
      <Subheadline>
        Sharing your starting moment is the kind of accountability that sticks.
        No money numbers ever — just the win that you started.
      </Subheadline>

      {/* Preview card — what would post */}
      <Animated.View style={{ transform: [{ scale: press }] }}>
        <Pressable onPress={toggle}>
          <LinearGradient
            colors={
              share
                ? ["rgba(0,180,166,0.18)", "rgba(0,180,166,0.04)"]
                : ["rgba(255,255,255,0.06)", "rgba(255,255,255,0.02)"]
            }
            style={[
              styles.previewCard,
              share && { borderColor: Colors.teal },
            ]}
          >
            <View style={styles.avatarRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarLetter}>
                  {firstName?.[0]?.toUpperCase() ?? "?"}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.userName}>{firstName || "You"}</Text>
                <Text style={styles.timestamp}>just now</Text>
              </View>
              <View style={styles.dayPill}>
                <Text style={styles.dayPillText}>DAY 1</Text>
              </View>
            </View>
            <View style={styles.postRow}>
              <View style={styles.whyChip}>
                <Icon name={whyIcon} size={13} color={Colors.gold} strokeWidth={2.4} />
              </View>
              <Text style={styles.postText}>
                <Text style={{ fontWeight: "700" }}>
                  Starting today, I'm taking control of my finances.
                </Text>{" "}
                First quest in. Streak alive. Let's go.
              </Text>
            </View>

            <View style={styles.bumpRow}>
              <Icon name="hand" size={13} color={Colors.muted} />
              <Text style={styles.bumpLabel}>Fist Bump · 0</Text>
            </View>

            {/* Toggle indicator */}
            <View style={[styles.toggle, share && styles.toggleOn]}>
              {share && <Icon name="check" size={13} color="#FFFFFF" strokeWidth={3} />}
              <Text style={styles.toggleText}>
                {share ? "Share to Buds" : "Tap to share"}
              </Text>
            </View>
          </LinearGradient>
        </Pressable>
      </Animated.View>

      <View style={styles.privacyRow}>
        <Icon name="lock" size={12} color={Colors.muted} strokeWidth={2.4} />
        <Text style={styles.privacy}>
          No balances, no transactions, no numbers. Ever.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  previewCard: {
    borderRadius: 18,
    padding: 16,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.10)",
    gap: 12,
  },
  avatarRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.gold,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarLetter: { fontSize: 18, fontWeight: "800", color: Colors.navy },
  userName: { fontSize: 14, fontWeight: "700", color: "#FFFFFF" },
  timestamp: { fontSize: 11, color: Colors.muted, marginTop: 2 },
  dayPill: {
    backgroundColor: "rgba(244,168,50,0.18)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(244,168,50,0.4)",
  },
  dayPillText: {
    fontSize: 10,
    fontWeight: "800",
    color: Colors.gold,
    letterSpacing: 1,
  },

  postRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  whyChip: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: "rgba(244,168,50,0.18)",
    borderWidth: 1,
    borderColor: "rgba(244,168,50,0.4)",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  postText: {
    flex: 1,
    fontSize: 14,
    color: "rgba(255,255,255,0.92)",
    lineHeight: 21,
  },
  bumpRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  bumpLabel: { fontSize: 12, color: Colors.muted, fontWeight: "500" },

  toggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.06)",
    paddingVertical: 11,
    borderRadius: 12,
    marginTop: 4,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  toggleOn: {
    backgroundColor: Colors.teal,
    borderColor: Colors.teal,
  },
  toggleText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 0.2,
  },

  privacyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  privacy: {
    fontSize: 12,
    color: Colors.muted,
    fontWeight: "500",
    letterSpacing: 0.2,
  },
});

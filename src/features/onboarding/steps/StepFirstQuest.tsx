/**
 * Step 8 — First quest assignment + Streak Day 1 ignition.
 *
 * The Bud-suggested quest is fetched from onboardingService (mock returns
 * a hand-written one keyed off the primary goal kind; production hits the
 * personalization engine). The streak flame fires up — Day 1 is alive.
 */

import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BudBubble } from "../components/BudBubble";
import { Headline } from "../components/Headline";
import { onboardingService } from "@/services/onboardingService";
import type { FirstQuest, GoalKind } from "../types";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";

interface Props {
  goalKinds: GoalKind[];
  quest: FirstQuest | null;
  onLoaded: (quest: FirstQuest) => void;
}

export function StepFirstQuest({ goalKinds, quest, onLoaded }: Props) {
  const [loading, setLoading] = useState(!quest);
  const fade = useRef(new Animated.Value(quest ? 1 : 0)).current;
  const flame = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (quest) return;
    let cancelled = false;
    (async () => {
      try {
        const q = await onboardingService.suggestFirstQuest(goalKinds);
        if (cancelled) return;
        onLoaded(q);
        Animated.timing(fade, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }).start();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Flame heartbeat
  useEffect(() => {
    if (loading) return;
    Animated.loop(
      Animated.sequence([
        Animated.timing(flame, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(flame, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, [loading, flame]);

  const flameScale = flame.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.12],
  });

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator color={Colors.gold} size="large" />
        <Text style={styles.loadingText}>Bud is picking your first move…</Text>
      </View>
    );
  }

  return (
    <Animated.View style={{ opacity: fade, gap: 16 }}>
      <BudBubble label="Your first quest" />
      <Headline>Here's where we start.</Headline>

      {/* Quest card */}
      <LinearGradient
        colors={["rgba(244,168,50,0.18)", "rgba(244,168,50,0.06)"]}
        style={styles.questCard}
      >
        <View style={styles.questHeader}>
          <Text style={styles.questDuration}>{quest!.durationLabel.toUpperCase()}</Text>
          <View style={styles.xpPill}>
            <Text style={styles.xpText}>+{quest!.xpReward} XP</Text>
          </View>
        </View>
        <Text style={styles.questName}>{quest!.name}</Text>
        <Text style={styles.whyLabel}>Why this matters</Text>
        <Text style={styles.whyText}>{quest!.whyItMatters}</Text>
      </LinearGradient>

      {/* Streak ignition */}
      <View style={styles.streakBox}>
        <Animated.View style={[styles.flameWell, { transform: [{ scale: flameScale }] }]}>
          <Icon name="flame" size={28} color={Colors.gold} strokeWidth={2.4} />
        </Animated.View>
        <View style={{ flex: 1 }}>
          <Text style={styles.streakTitle}>Day 1 streak — alive.</Text>
          <Text style={styles.streakSub}>
            Open Budget Buddy tomorrow to keep your flame growing. Most habits
            break on day 3 — let's prove yours won't.
          </Text>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    paddingVertical: 80,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.muted,
    fontWeight: "500",
    marginTop: 4,
  },

  questCard: {
    borderRadius: 18,
    padding: 18,
    borderWidth: 1.5,
    borderColor: "rgba(244,168,50,0.4)",
  },
  questHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  questDuration: {
    fontSize: 10,
    fontWeight: "800",
    color: Colors.gold,
    letterSpacing: 1.5,
  },
  xpPill: {
    backgroundColor: Colors.gold,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  xpText: {
    fontSize: 11,
    fontWeight: "800",
    color: Colors.navy,
    letterSpacing: 0.4,
  },
  questName: {
    fontSize: 22,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0,
    lineHeight: 28,
    marginBottom: 14,
  },
  whyLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: Colors.gold,
    letterSpacing: 1.4,
    marginBottom: 6,
  },
  whyText: {
    fontSize: 14,
    color: "rgba(255,255,255,0.85)",
    lineHeight: 21,
  },

  streakBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 18,
    padding: 16,
  },
  flameWell: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: "rgba(244,168,50,0.14)",
    borderWidth: 1,
    borderColor: "rgba(244,168,50,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  streakTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 4,
    letterSpacing: 0,
  },
  streakSub: { fontSize: 13, color: "rgba(255,255,255,0.7)", lineHeight: 19 },
});

/**
 * Step 6 — Pricing.
 *
 * Per Section 4 + Section 5 of the developer review.
 *   • Monthly / Annual toggle (annual shows ~17% off inline)
 *   • Three tiers: Free, Premium, Elite
 *   • Founders' Lifetime CTA surfaced as scarcity card
 *   • All paid tiers come with a 14-day trial
 *
 * Free is always available. The CTA copy adapts to the selection.
 */

import React, { useRef } from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import { BudBubble } from "../components/BudBubble";
import { Headline, Subheadline } from "../components/Headline";
import {
  PRICING,
  LIFETIME_OFFER,
  FREE_TRIAL_DAYS,
} from "../data";
import type { BillingCycle, SubscriptionTier } from "../types";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";

interface Props {
  selectedTier: SubscriptionTier;
  cycle: BillingCycle;
  isLifetime: boolean;
  onChangeTier: (tier: SubscriptionTier) => void;
  onChangeCycle: (cycle: BillingCycle) => void;
  onChangeLifetime: (v: boolean) => void;
}

export function StepPricing({
  selectedTier,
  cycle,
  isLifetime,
  onChangeTier,
  onChangeCycle,
  onChangeLifetime,
}: Props) {
  return (
    <View style={{ gap: 16 }}>
      <BudBubble />
      <Headline>Pick the version that fits.</Headline>
      <Subheadline>
        Free is real Free. Premium unlocks me — fully personal. Elite is everything.
      </Subheadline>

      {/* Cycle toggle */}
      <CycleToggle
        cycle={cycle}
        onChange={(c) => {
          Haptics.selectionAsync();
          onChangeCycle(c);
          if (c === "monthly") onChangeLifetime(false);
        }}
      />

      {/* Plan cards */}
      <View style={{ gap: 12 }}>
        {PRICING.map((p) => (
          <PlanCard
            key={p.id}
            plan={p}
            cycle={cycle}
            selected={selectedTier === p.id && !isLifetime}
            onPress={() => {
              Haptics.selectionAsync();
              onChangeTier(p.id);
              onChangeLifetime(false);
            }}
          />
        ))}
      </View>

      {/* Lifetime founder card (only shown on annual to avoid clutter) */}
      {cycle === "annual" && (
        <LifetimeCard
          selected={isLifetime}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onChangeLifetime(!isLifetime);
            if (!isLifetime) onChangeTier("elite");
          }}
        />
      )}

      {/* Trial reminder for paid tiers */}
      {selectedTier !== "free" && (
        <Text style={styles.trial}>
          {FREE_TRIAL_DAYS}-day free trial · Cancel anytime · We'll remind you before billing
        </Text>
      )}
    </View>
  );
}

// ─── Cycle toggle ────────────────────────────────────────────────────────────

function CycleToggle({
  cycle,
  onChange,
}: {
  cycle: BillingCycle;
  onChange: (c: BillingCycle) => void;
}) {
  const slide = useRef(new Animated.Value(cycle === "annual" ? 1 : 0)).current;

  React.useEffect(() => {
    Animated.spring(slide, {
      toValue: cycle === "annual" ? 1 : 0,
      damping: 18,
      stiffness: 220,
      useNativeDriver: false,
    }).start();
  }, [cycle, slide]);

  const left = slide.interpolate({
    inputRange: [0, 1],
    outputRange: ["1%", "50%"],
  });

  return (
    <View style={styles.toggleWrap}>
      <Animated.View style={[styles.toggleThumb, { left }]} />
      <Pressable style={styles.toggleSide} onPress={() => onChange("monthly")}>
        <Text style={[styles.toggleText, cycle === "monthly" && styles.toggleTextActive]}>
          Monthly
        </Text>
      </Pressable>
      <Pressable style={styles.toggleSide} onPress={() => onChange("annual")}>
        <Text style={[styles.toggleText, cycle === "annual" && styles.toggleTextActive]}>
          Annual
        </Text>
        <View style={styles.savePill}>
          <Text style={styles.savePillText}>SAVE 20%</Text>
        </View>
      </Pressable>
    </View>
  );
}

// ─── Plan card ───────────────────────────────────────────────────────────────

function PlanCard({
  plan,
  cycle,
  selected,
  onPress,
}: {
  plan: (typeof PRICING)[number];
  cycle: BillingCycle;
  selected: boolean;
  onPress: () => void;
}) {
  const isFree = plan.id === "free";
  const price = isFree ? 0 : cycle === "annual" ? plan.annualPerMonth : plan.monthly;

  return (
    <Pressable
      onPress={onPress}
      style={[styles.planCard, selected && styles.planCardSelected]}
    >
      {plan.recommended && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>RECOMMENDED</Text>
        </View>
      )}

      <View style={styles.planTop}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.planName, selected && { color: Colors.gold }]}>
            {plan.name}
          </Text>
          <Text style={styles.planTagline}>{plan.tagline}</Text>
        </View>
        <View style={styles.priceCol}>
          {isFree ? (
            <Text style={styles.priceFree}>Free</Text>
          ) : (
            <>
              <Text style={styles.priceMain}>${price}</Text>
              <Text style={styles.priceSub}>/ month</Text>
              {cycle === "annual" && (
                <Text style={styles.priceAnnual}>billed ${plan.annualTotal} / yr</Text>
              )}
            </>
          )}
        </View>
      </View>

      <View style={styles.featureList}>
        {plan.features.slice(0, 4).map((f) => (
          <View key={f} style={styles.featureRow}>
            <Icon name="check" size={12} color={Colors.gold} strokeWidth={3} />
            <Text style={styles.featureText}>{f}</Text>
          </View>
        ))}
        {plan.features.length > 4 && (
          <Text style={styles.featureMore}>+{plan.features.length - 4} more</Text>
        )}
      </View>

      <View style={[styles.radio, selected && styles.radioActive]}>
        {selected && <View style={styles.radioDot} />}
      </View>
    </Pressable>
  );
}

// ─── Lifetime card ───────────────────────────────────────────────────────────

function LifetimeCard({
  selected,
  onPress,
}: {
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.lifetimeCard, selected && styles.lifetimeCardSelected]}
    >
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text style={styles.lifetimeName}>{LIFETIME_OFFER.name}</Text>
          <View style={styles.scarcityPill}>
            <Text style={styles.scarcityText}>
              {LIFETIME_OFFER.spotsRemaining} left
            </Text>
          </View>
        </View>
        <Text style={styles.lifetimeBlurb}>{LIFETIME_OFFER.blurb}</Text>
      </View>
      <View style={[styles.radio, selected && styles.radioActive]}>
        {selected && <View style={styles.radioDot} />}
      </View>
    </Pressable>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  toggleWrap: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 999,
    padding: 4,
    height: 48,
    position: "relative",
  },
  toggleThumb: {
    position: "absolute",
    top: 4,
    bottom: 4,
    width: "49%",
    backgroundColor: Colors.gold,
    borderRadius: 999,
  },
  toggleSide: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    zIndex: 1,
  },
  toggleText: {
    fontSize: 14,
    fontWeight: "700",
    color: "rgba(255,255,255,0.6)",
  },
  toggleTextActive: { color: Colors.navy },
  savePill: {
    backgroundColor: "rgba(255,255,255,0.18)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  savePillText: {
    fontSize: 9,
    fontWeight: "800",
    color: Colors.navy,
    letterSpacing: 0.6,
  },

  planCard: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.10)",
    borderRadius: 18,
    padding: 18,
    paddingRight: 50,
    position: "relative",
  },
  planCardSelected: {
    borderColor: Colors.gold,
    backgroundColor: "rgba(244,168,50,0.08)",
  },
  badge: {
    position: "absolute",
    top: -10,
    left: 18,
    backgroundColor: Colors.gold,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: "800",
    color: Colors.navy,
    letterSpacing: 0.8,
  },

  planTop: { flexDirection: "row", alignItems: "flex-start", marginBottom: 14 },
  planName: { fontSize: 20, fontWeight: "800", color: "#FFFFFF", letterSpacing: -0.4 },
  planTagline: { fontSize: 13, color: Colors.muted, marginTop: 4, lineHeight: 18 },
  priceCol: { alignItems: "flex-end" },
  priceFree: { fontSize: 22, fontWeight: "800", color: Colors.emerald },
  priceMain: { fontSize: 28, fontWeight: "800", color: "#FFFFFF", letterSpacing: -1 },
  priceSub: { fontSize: 12, color: Colors.muted, marginTop: -2 },
  priceAnnual: { fontSize: 11, color: Colors.muted, marginTop: 4 },

  featureList: { gap: 6 },
  featureRow: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
  featureCheck: { fontSize: 12, color: Colors.gold, fontWeight: "800", marginTop: 2 },
  featureText: { fontSize: 13, color: "rgba(255,255,255,0.78)", flex: 1, lineHeight: 18 },
  featureMore: { fontSize: 12, color: Colors.gold, fontWeight: "600", marginTop: 4 },

  radio: {
    position: "absolute",
    top: 22,
    right: 18,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  radioActive: { borderColor: Colors.gold, backgroundColor: Colors.gold },
  radioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.navy,
  },

  lifetimeCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    paddingRight: 50,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(0,180,166,0.06)",
    position: "relative",
  },
  lifetimeCardSelected: {
    borderColor: Colors.teal,
    backgroundColor: "rgba(0,180,166,0.14)",
  },
  lifetimeName: {
    fontSize: 15,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -0.2,
  },
  lifetimeBlurb: {
    fontSize: 12,
    color: "rgba(255,255,255,0.7)",
    lineHeight: 17,
    marginTop: 4,
  },
  scarcityPill: {
    backgroundColor: Colors.coral,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  scarcityText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.4,
  },

  trial: {
    fontSize: 12,
    color: Colors.muted,
    textAlign: "center",
    marginTop: 8,
    lineHeight: 18,
  },
});

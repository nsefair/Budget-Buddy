/**
 * Step 5 — Connect Bank (Plaid).
 *
 * Per Section 4 + Section 16 of the developer review.
 * Plaid is the engine — but onboarding must never feel mandatory or scary.
 * Users can skip and connect later (CTA persists across the app).
 *
 * The actual Plaid Link SDK call lives in onboardingService.connectBank().
 * This screen only triggers it and reflects state.
 */

import React, { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import { BudBubble } from "../components/BudBubble";
import { Headline, Subheadline } from "../components/Headline";
import { onboardingService } from "@/services/onboardingService";
import { Colors } from "@/constants/colors";
import { Icon, type IconName } from "@/components/Icon";

interface Props {
  bankConnected: boolean;
  onConnected: () => void;
}

export function StepBank({ bankConnected, onConnected }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    setError(null);
    try {
      const { connected } = await onboardingService.connectBank();
      if (connected) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onConnected();
      } else {
        setError("Bud couldn't reach your bank. We can try again any time.");
      }
    } catch {
      setError("Connection didn't go through. We can try again any time.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ gap: 16 }}>
      <BudBubble />
      <Headline>Let me see your money.</Headline>
      <Subheadline>
        Connecting your bank means real numbers, real quests, real progress.
        You stay in control — read-only, encrypted, secured by Plaid.
      </Subheadline>

      {/* Trust strip */}
      <View style={styles.trustCard}>
        <TrustRow icon="lock" text="Bank-level encryption — your credentials never touch our servers." />
        <TrustRow icon="eye" text="Read-only access. We can see, never move money." />
        <TrustRow icon="x" text="Disconnect any time from settings." />
      </View>

      {/* Connect / connected state */}
      {bankConnected ? (
        <View style={styles.successCard}>
          <View style={styles.successCheck}>
            <Icon name="check" size={18} color="#FFFFFF" strokeWidth={3} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.successTitle}>You're connected</Text>
            <Text style={styles.successSub}>
              I'll start syncing your transactions in the background.
            </Text>
          </View>
        </View>
      ) : (
        <Pressable
          onPress={handleConnect}
          disabled={loading}
          style={({ pressed }) => [
            styles.connectBtn,
            loading && styles.connectBtnLoading,
            pressed && !loading && { opacity: 0.85 },
          ]}
        >
          {loading ? (
            <>
              <ActivityIndicator color={Colors.gold} />
              <Text style={styles.connectLoadingText}>Reaching your bank…</Text>
            </>
          ) : (
            <>
              <Icon name="building" size={20} color={Colors.gold} strokeWidth={2.4} />
              <Text style={styles.connectText}>Connect with Plaid</Text>
            </>
          )}
        </Pressable>
      )}

      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

function TrustRow({ icon, text }: { icon: IconName; text: string }) {
  return (
    <View style={styles.trustRow}>
      <View style={styles.trustIconBox}>
        <Icon name={icon} size={14} color={Colors.gold} strokeWidth={2.4} />
      </View>
      <Text style={styles.trustText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  trustCard: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  trustRow: { flexDirection: "row", gap: 12, alignItems: "center" },
  trustIconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "rgba(244,168,50,0.12)",
    borderWidth: 1,
    borderColor: "rgba(244,168,50,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  trustText: {
    flex: 1,
    fontSize: 13,
    color: "rgba(255,255,255,0.78)",
    lineHeight: 19,
  },

  connectBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingVertical: 18,
    backgroundColor: "rgba(244,168,50,0.12)",
    borderWidth: 1.5,
    borderColor: Colors.gold,
    borderRadius: 16,
  },
  connectBtnLoading: {
    backgroundColor: "rgba(244,168,50,0.06)",
    borderColor: "rgba(244,168,50,0.4)",
  },
  connectText: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.gold,
    letterSpacing: -0.2,
  },
  connectLoadingText: {
    fontSize: 14,
    color: Colors.gold,
    fontWeight: "600",
    marginLeft: 4,
  },

  successCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    backgroundColor: "rgba(16,185,129,0.10)",
    borderWidth: 1.5,
    borderColor: Colors.emerald,
    borderRadius: 16,
  },
  successCheck: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.emerald,
    alignItems: "center",
    justifyContent: "center",
  },
  successTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 2,
  },
  successSub: { fontSize: 13, color: "rgba(255,255,255,0.7)", lineHeight: 19 },

  error: {
    fontSize: 13,
    color: Colors.coral,
    textAlign: "center",
    marginTop: 4,
  },
});

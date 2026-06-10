/**
 * Step 5 — Connect Bank (Plaid).
 *
 * Per Section 4 + Section 16 of the developer review.
 * Plaid is the engine — but onboarding must never feel mandatory or scary.
 * Users can skip and connect later (CTA persists across the app).
 *
 * The native Plaid Link flow is shared with Settings via usePlaidConnection.
 */

import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { BudBubble } from "../components/BudBubble";
import { Headline, Subheadline } from "../components/Headline";
import { usePlaidConnection } from "@/hooks/usePlaidConnection";
import { Colors } from "@/constants/colors";
import { Icon, type IconName } from "@/components/Icon";

interface Props {
  bankConnected: boolean;
  onConnected: () => void;
}

export function StepBank({ bankConnected, onConnected }: Props) {
  const [error, setError] = useState<string | null>(null);
  const {
    status,
    loadingStatus,
    linking,
    readyForLink,
    hasConnections,
    startLink,
  } = usePlaidConnection({
    source: "onboarding.plaid",
    onConnected: () => onConnected(),
  });

  useEffect(() => {
    if (!bankConnected && hasConnections) {
      onConnected();
    }
  }, [bankConnected, hasConnections, onConnected]);

  const handleConnect = async () => {
    setError(null);
    const outcome = await startLink();
    if (outcome.connected) {
      return;
    }
    if (outcome.reason === "closed") {
      setError("No rush. You can try again here or connect later.");
      return;
    }
    if (outcome.reason === "not-configured") {
      setError("Plaid needs the local backend setup before this can open.");
      return;
    }
    if (outcome.reason === "sdk-unavailable") {
      setError("Use the Expo development build to open Plaid Link.");
      return;
    }
    setError("Connection didn't go through. We can try again any time.");
  };

  return (
    <View style={{ gap: 16 }}>
      <BudBubble />
      <Headline>Let me see your money.</Headline>
      <Subheadline>
        Connecting your bank means real numbers, real quests, real progress.
        You stay in control — read-only, encrypted, secured by Plaid.
      </Subheadline>

      <View style={styles.statusCard}>
        <View style={styles.statusIcon}>
          {loadingStatus ? (
            <ActivityIndicator color={Colors.gold} />
          ) : (
            <Icon
              name={readyForLink || bankConnected ? "shield-check" : "lock"}
              size={17}
              color={Colors.gold}
              strokeWidth={2.5}
            />
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.statusTitle}>
            {bankConnected || hasConnections
              ? "Bank connection saved"
              : readyForLink
                ? "Sandbox link is ready"
                : "Plaid setup needed"}
          </Text>
          <Text style={styles.statusText}>
            {status?.message ??
              "You'll connect through Plaid, then Budget Buddy saves only the read-only connection."}
          </Text>
        </View>
      </View>

      {/* Trust strip */}
      <View style={styles.trustCard}>
        <TrustRow icon="lock" text="Bank-level encryption — your credentials never touch our servers." />
        <TrustRow icon="eye" text="Read-only access. We can see, never move money." />
        <TrustRow icon="x" text="Disconnect any time from settings." />
      </View>

      {/* Connect / connected state */}
      {bankConnected || hasConnections ? (
        <View style={styles.successCard}>
          <View style={styles.successCheck}>
            <Icon name="check" size={18} color={Colors.onGreen} strokeWidth={3} />
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
          disabled={linking || loadingStatus}
          style={({ pressed }) => [
            styles.connectBtn,
            (linking || loadingStatus) && styles.connectBtnLoading,
            pressed && !linking && !loadingStatus && { opacity: 0.85 },
          ]}
        >
          {linking || loadingStatus ? (
            <>
              <ActivityIndicator color={Colors.gold} />
              <Text style={styles.connectLoadingText}>
                {linking ? "Opening Plaid..." : "Checking setup..."}
              </Text>
            </>
          ) : (
            <>
              <Icon name="building" size={20} color={Colors.gold} strokeWidth={2.4} />
              <Text style={styles.connectText}>Connect a bank</Text>
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
  statusCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    padding: 14,
  },
  statusIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: Colors.accentAlpha12,
    borderWidth: 1,
    borderColor: Colors.accentAlpha30,
    alignItems: "center",
    justifyContent: "center",
  },
  statusTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: Colors.navy,
    marginBottom: 3,
  },
  statusText: {
    fontSize: 12,
    color: Colors.navyMuted,
    lineHeight: 17,
    fontWeight: "600",
  },
  trustCard: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  trustRow: { flexDirection: "row", gap: 12, alignItems: "center" },
  trustIconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: Colors.accentAlpha12,
    borderWidth: 1,
    borderColor: Colors.accentAlpha30,
    alignItems: "center",
    justifyContent: "center",
  },
  trustText: {
    flex: 1,
    fontSize: 13,
    color: Colors.navyMuted,
    lineHeight: 19,
  },

  connectBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingVertical: 18,
    backgroundColor: Colors.accentAlpha12,
    borderWidth: 1.5,
    borderColor: Colors.gold,
    borderRadius: 16,
  },
  connectBtnLoading: {
    backgroundColor: Colors.accentAlpha06,
    borderColor: Colors.accentAlpha40,
  },
  connectText: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.gold,
    letterSpacing: 0,
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
    backgroundColor: Colors.emerald50,
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
    color: Colors.navy,
    marginBottom: 2,
  },
  successSub: { fontSize: 13, color: Colors.navyMuted, lineHeight: 19 },

  error: {
    fontSize: 13,
    color: Colors.coral,
    textAlign: "center",
    marginTop: 4,
  },
});

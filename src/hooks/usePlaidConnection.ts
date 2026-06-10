import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert } from "react-native";
import * as Haptics from "expo-haptics";

import {
  plaidService,
  type PlaidExchangeMetadata,
  type PlaidStatus,
} from "@/services/plaidService";
import { secureLog } from "@/utils/security";

type PlaidLinkReason =
  | "connected"
  | "closed"
  | "not-configured"
  | "sdk-unavailable"
  | "error";

export type PlaidLinkOutcome = {
  connected: boolean;
  reason: PlaidLinkReason;
  status?: PlaidStatus;
};

type UsePlaidConnectionOptions = {
  source?: string;
  autoLoadStatus?: boolean;
  onConnected?: (status: PlaidStatus) => void;
  successAlert?: {
    title: string;
    message: string;
  };
};

const FALLBACK_STATUS: PlaidStatus = {
  configured: false,
  encryptionConfigured: false,
  oauthConfigured: false,
  environment: "sandbox",
  products: ["transactions"],
  optionalProducts: [],
  countryCodes: ["US"],
  message: "Run the latest backend and Plaid migration to enable connection status.",
  connections: [],
};

export function usePlaidConnection({
  source = "plaid",
  autoLoadStatus = true,
  onConnected,
  successAlert,
}: UsePlaidConnectionOptions = {}) {
  const [status, setStatus] = useState<PlaidStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(autoLoadStatus);
  const [linking, setLinking] = useState(false);

  const refreshStatus = useCallback(async (): Promise<PlaidStatus> => {
    setLoadingStatus(true);
    try {
      const result = await plaidService.status();
      setStatus(result);
      return result;
    } catch (error) {
      secureLog.error(`${source}.status failed`, error);
      setStatus(FALLBACK_STATUS);
      return FALLBACK_STATUS;
    } finally {
      setLoadingStatus(false);
    }
  }, [source]);

  useEffect(() => {
    if (!autoLoadStatus) return;
    let alive = true;
    setLoadingStatus(true);
    (async () => {
      try {
        const result = await plaidService.status();
        if (alive) setStatus(result);
      } catch (error) {
        secureLog.error(`${source}.status failed`, error);
        if (alive) setStatus(FALLBACK_STATUS);
      } finally {
        if (alive) setLoadingStatus(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [autoLoadStatus, source]);

  const readyForLink = useMemo(
    () => Boolean(status?.configured) && Boolean(status?.encryptionConfigured),
    [status],
  );
  const hasConnections = useMemo(
    () => Boolean(status?.connections.length),
    [status],
  );

  const startLink = useCallback(async (): Promise<PlaidLinkOutcome> => {
    Haptics.selectionAsync();
    const currentStatus = status ?? (await refreshStatus());
    const canOpenLink =
      Boolean(currentStatus.configured) &&
      Boolean(currentStatus.encryptionConfigured);

    if (!canOpenLink) {
      showPlaidSetupChecklist(currentStatus);
      return {
        connected: false,
        reason: "not-configured",
        status: currentStatus,
      };
    }

    setLinking(true);
    try {
      const result = await plaidService.createLinkToken();
      if (!result.configured || !result.linkToken) {
        Alert.alert(
          "Plaid is not ready",
          result.message ?? "The backend did not return a Link token.",
        );
        return {
          connected: false,
          reason: "not-configured",
          status: currentStatus,
        };
      }

      const sdk = await loadPlaidSdk(source);
      if (!sdk) {
        return {
          connected: false,
          reason: "sdk-unavailable",
          status: currentStatus,
        };
      }

      await sdk.destroy?.();
      sdk.create({ token: result.linkToken });

      return await new Promise<PlaidLinkOutcome>((resolve) => {
        let resolved = false;
        const finish = (outcome: PlaidLinkOutcome) => {
          if (resolved) return;
          resolved = true;
          resolve(outcome);
        };

        sdk.open({
          iOSPresentationStyle: sdk.LinkIOSPresentationStyle?.MODAL,
          logLevel: sdk.LinkLogLevel?.ERROR,
          onSuccess: async (success) => {
            try {
              await plaidService.exchangePublicToken(
                success.publicToken,
                normalizePlaidMetadata(success.metadata),
              );
              await plaidService.sync();
              const refreshed = await plaidService.status();
              setStatus(refreshed);
              onConnected?.(refreshed);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              if (successAlert) {
                Alert.alert(successAlert.title, successAlert.message);
              }
              finish({
                connected: true,
                reason: "connected",
                status: refreshed,
              });
            } catch (error) {
              secureLog.error(`${source}.exchange failed`, error);
              Alert.alert(
                "Plaid exchange issue",
                "Plaid linked, but the backend could not save the connection.",
              );
              finish({
                connected: false,
                reason: "error",
                status: currentStatus,
              });
            }
          },
          onExit: (exit) => {
            // The native SDK reports an error object with empty fields on a
            // plain user dismissal — only treat populated errors as failures.
            const hasRealError = Boolean(
              exit.error?.errorCode ||
                exit.error?.errorMessage ||
                exit.error?.displayMessage,
            );
            if (hasRealError && exit.error) {
              secureLog.warn(`${source}.exit`, exit.error);
              Alert.alert(
                "Plaid closed",
                exit.error.displayMessage ||
                  exit.error.errorMessage ||
                  "Plaid Link was closed before connecting.",
              );
              finish({
                connected: false,
                reason: "error",
                status: currentStatus,
              });
              return;
            }
            finish({
              connected: false,
              reason: "closed",
              status: currentStatus,
            });
          },
        });
      });
    } catch (error) {
      secureLog.error(`${source}.linkToken failed`, error);
      Alert.alert(
        "Plaid issue",
        "Could not create a Link token from the backend.",
      );
      return {
        connected: false,
        reason: "error",
        status: currentStatus,
      };
    } finally {
      setLinking(false);
    }
  }, [onConnected, refreshStatus, source, status, successAlert]);

  return {
    status,
    loadingStatus,
    linking,
    readyForLink,
    hasConnections,
    refreshStatus,
    startLink,
  };
}

function showPlaidSetupChecklist(status: PlaidStatus | null) {
  const missing = [
    status?.configured ? null : "PLAID_CLIENT_ID and PLAID_SECRET",
    status?.encryptionConfigured ? null : "PLAID_TOKEN_ENCRYPTION_KEY",
  ].filter(Boolean);

  Alert.alert(
    "Plaid setup checklist",
    [
      "Needed on the Go backend only:",
      ...missing.map((item) => `- ${item}`),
      "- Use Sandbox here; production Plaid work comes later.",
    ].join("\n"),
  );
}

async function loadPlaidSdk(source: string) {
  try {
    return await import("react-native-plaid-link-sdk");
  } catch (error) {
    secureLog.warn(`${source}.sdk unavailable`, error);
    Alert.alert(
      "Plaid SDK build needed",
      "The backend is ready, but native Plaid Link needs an Expo development build. Expo Go cannot load this native module.",
    );
    return null;
  }
}

function normalizePlaidMetadata(metadata: {
  institution?: { id?: string; name?: string };
  accounts?: Array<{
    id?: string;
    account_id?: string;
    name?: string;
    mask?: string;
    type?: string;
    subtype?: { type?: string; value?: string } | string;
    verificationStatus?: string;
    verification_status?: string;
  }>;
  linkSessionId?: string;
}): PlaidExchangeMetadata {
  return {
    institution: metadata.institution
      ? {
          id: metadata.institution.id,
          name: metadata.institution.name,
        }
      : undefined,
    accounts: (metadata.accounts ?? []).map((account) => ({
      id: account.id,
      account_id: account.account_id,
      name: account.name,
      mask: account.mask,
      type: account.type,
      subtype:
        typeof account.subtype === "string"
          ? account.subtype
          : account.subtype?.value ?? account.subtype?.type,
      verification_status:
        account.verification_status ?? account.verificationStatus,
    })),
    linkSessionId: metadata.linkSessionId,
  };
}

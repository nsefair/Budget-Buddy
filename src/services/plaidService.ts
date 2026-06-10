/**
 * Plaid Service
 *
 * All bank-linking calls live here. The Expo app only receives short-lived
 * Link tokens and connection summaries; Plaid secrets and access tokens stay
 * on the Go backend.
 */

import { api, IS_MOCK } from "@/api/client";
import { ENDPOINTS } from "@/api/endpoints";

export type PlaidAccount = {
  id: string;
  plaidAccountId: string;
  name: string;
  mask?: string;
  type: string;
  subtype: string;
  active: boolean;
};

export type PlaidConnection = {
  id: string;
  institutionId?: string;
  institutionName: string;
  status: "active" | "relink_required" | "error" | "archived" | string;
  accountCount: number;
  createdAt: string;
  accounts: PlaidAccount[];
};

export type PlaidStatus = {
  configured: boolean;
  encryptionConfigured: boolean;
  oauthConfigured?: boolean;
  environment: "sandbox" | "development" | "production" | string;
  products: string[];
  optionalProducts: string[];
  countryCodes: string[];
  message?: string;
  connections: PlaidConnection[];
};

export type PlaidLinkToken = {
  configured: boolean;
  linkToken?: string;
  expiration?: string;
  requestId?: string;
  message?: string;
};

export type PlaidExchangeMetadata = {
  institution?: {
    id?: string;
    institution_id?: string;
    name?: string;
  };
  accounts?: Array<{
    id?: string;
    account_id?: string;
    name?: string;
    mask?: string;
    type?: string;
    subtype?: string;
    verification_status?: string;
  }>;
  linkSessionId?: string;
};

const mockStatus: PlaidStatus = {
  configured: false,
  encryptionConfigured: false,
  environment: "sandbox",
  products: ["transactions"],
  optionalProducts: [],
  countryCodes: ["US"],
  message: "Plaid is not configured in this local build yet.",
  connections: [],
};

export const plaidService = {
  status: async (): Promise<PlaidStatus> => {
    if (IS_MOCK) return mockStatus;
    return api.get<PlaidStatus>(ENDPOINTS.PLAID.STATUS);
  },

  createLinkToken: async (): Promise<PlaidLinkToken> => {
    if (IS_MOCK) {
      return {
        configured: false,
        message: "Plaid Link is disabled while the app is using mock data.",
      };
    }
    return api.post<PlaidLinkToken>(ENDPOINTS.PLAID.LINK_TOKEN);
  },

  exchangePublicToken: async (
    publicToken: string,
    metadata: PlaidExchangeMetadata = {}
  ) => {
    return api.post(ENDPOINTS.PLAID.EXCHANGE, {
      publicToken,
      metadata: {
        institution: metadata.institution ?? {},
        accounts: metadata.accounts ?? [],
        linkSessionId: metadata.linkSessionId,
      },
    });
  },

  sync: async (): Promise<{
    synced: boolean;
    message?: string;
    items?: Array<{
      itemId: string;
      addedCount: number;
      modifiedCount: number;
      removedCount: number;
      totalTransactions: number;
    }>;
  }> => api.post(ENDPOINTS.PLAID.SYNC),
};

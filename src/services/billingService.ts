import { api, IS_MOCK } from "@/api/client";
import { ENDPOINTS } from "@/api/endpoints";

export interface BillingPlan {
  tier: "free" | "premium" | "elite";
  name: string;
  productIds: Record<string, string>;
  available: boolean;
}

export interface SubscriptionStatus {
  tier: "free" | "premium" | "elite";
  status: "inactive" | "trialing" | "active" | "grace_period" | "expired" | "revoked";
  provider: "none" | "apple" | "google" | "revenuecat" | "manual";
  productId?: string;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd: boolean;
  environment: "sandbox" | "production";
}

const MOCK_PLANS: BillingPlan[] = [
  { tier: "free", name: "Free", productIds: {}, available: true },
  { tier: "premium", name: "Premium", productIds: {}, available: false },
  { tier: "elite", name: "Elite", productIds: {}, available: false },
];

export const billingService = {
  getPlans: async () => {
    if (IS_MOCK) return { provider: "app_store", plans: MOCK_PLANS };
    return api.get<{ provider: string; plans: BillingPlan[] }>(ENDPOINTS.PAYMENTS.PLANS);
  },

  getStatus: async (): Promise<SubscriptionStatus> => {
    if (IS_MOCK) {
      return {
        tier: "free",
        status: "inactive",
        provider: "none",
        cancelAtPeriodEnd: false,
        environment: "sandbox",
      };
    }
    return api.get<SubscriptionStatus>(ENDPOINTS.PAYMENTS.STATUS);
  },
};

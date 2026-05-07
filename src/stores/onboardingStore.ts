/**
 * Onboarding draft store (Zustand).
 *
 * Holds the in-progress draft as the user moves through the multi-step flow.
 * Each step reads + writes to this store via shallow selector hooks below.
 *
 * On the final step, screens call `submit()` which routes through
 * onboardingService — the service decides whether to call the real
 * backend or stay in mock mode based on EXPO_PUBLIC_USE_MOCK.
 *
 * The store NEVER imports from api/client or mock/ directly. That keeps
 * this file unchanged when we wire up the real backend.
 */

import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import type { OnboardingDraft } from "@/features/onboarding/types";

const INITIAL_DRAFT: OnboardingDraft = {
  firstName: "",
  ageRange: null,
  situation: null,
  goalKinds: [],
  customGoalLabel: "",
  whyId: null,
  whyText: "",
  whyEmoji: "✨",
  bankConnected: false,
  plan: { tier: "free", cycle: "monthly", isLifetime: false },
  firstGoal: null,
  firstQuest: null,
  shareToBuds: false,
};

interface OnboardingState {
  draft: OnboardingDraft;
  step: number;

  setStep: (step: number) => void;
  patch: (updates: Partial<OnboardingDraft>) => void;
  reset: () => void;
}

export const useOnboardingStore = create<OnboardingState>((set) => ({
  draft: INITIAL_DRAFT,
  step: 0,

  setStep: (step) => set({ step }),

  patch: (updates) =>
    set((s) => ({ draft: { ...s.draft, ...updates } })),

  reset: () => set({ draft: INITIAL_DRAFT, step: 0 }),
}));

// ─── Selector hooks — keep screens lean ──────────────────────────────────────

export const useDraft = () => useOnboardingStore((s) => s.draft);

export const useDraftActions = () =>
  useOnboardingStore(
    useShallow((s) => ({
      patch: s.patch,
      setStep: s.setStep,
      reset: s.reset,
    }))
  );

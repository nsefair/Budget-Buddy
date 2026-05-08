/**
 * Onboarding Container
 *
 * Implements the 9-step flow specified in Section 4 of the developer review:
 *
 *   0. Welcome             — Bud hero moment
 *   1. Profile             — name + age + life situation
 *   2. Goals               — pick 1–3 goal kinds
 *   3. Why                 — emotional anchor
 *   4. Bank                — Plaid connect (skippable)
 *   5. Pricing             — tier select + monthly/annual + lifetime
 *   6. First Goal          — concrete target + deadline + reason
 *   7. First Quest + Streak — Bud assigns + flame ignites
 *   8. Buds Share          — opt-in starting moment
 *
 * Architecture:
 *   • Each step is a self-contained component in src/features/onboarding/steps/.
 *   • Draft state lives in useOnboardingStore (zustand).
 *   • All API/IO goes through onboardingService — never touched directly here.
 *   • Final submission is one atomic call to onboardingService.complete(draft).
 *
 * Backend integration:
 *   When EXPO_PUBLIC_USE_MOCK=false the service flips to real endpoints.
 *   Nothing in this file changes.
 */

import React, { useEffect, useMemo, useState } from "react";
import { Alert } from "react-native";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";

import { OnboardingShell } from "@/features/onboarding/components/OnboardingShell";
import { PrimaryButton, SecondaryButton } from "@/features/onboarding/components/PrimaryButton";

import { StepWelcome } from "@/features/onboarding/steps/StepWelcome";
import { StepProfile } from "@/features/onboarding/steps/StepProfile";
import { StepGoals } from "@/features/onboarding/steps/StepGoals";
import { StepWhy } from "@/features/onboarding/steps/StepWhy";
import { StepBank } from "@/features/onboarding/steps/StepBank";
import { StepPricing } from "@/features/onboarding/steps/StepPricing";
import { StepFirstGoal } from "@/features/onboarding/steps/StepFirstGoal";
import { StepFirstQuest } from "@/features/onboarding/steps/StepFirstQuest";
import { StepShare } from "@/features/onboarding/steps/StepShare";

import { WHY_OPTIONS } from "@/features/onboarding/data";
import { onboardingService } from "@/services/onboardingService";
import type { IconName } from "@/components/Icon";

import {
  useDraft,
  useDraftActions,
  useOnboardingStore,
} from "@/stores/onboardingStore";
import { useUser, useAuthActions } from "@/hooks/useAuth";

const TOTAL_STEPS = 9;

export default function OnboardingScreen() {
  const user = useUser();
  const { updateUser, setOnboardingComplete } = useAuthActions();

  const draft = useDraft();
  const { patch, reset } = useDraftActions();
  const step = useOnboardingStore((s) => s.step);
  const setStep = useOnboardingStore((s) => s.setStep);

  const [submitting, setSubmitting] = useState(false);

  // Pre-fill the draft with the registered user's first name once on mount.
  useEffect(() => {
    if (user?.firstName && !draft.firstName) {
      patch({ firstName: user.firstName });
    }
    // We intentionally only run this once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Per-step "can advance" gates ──────────────────────────────────────────
  const canAdvance = useMemo(() => {
    switch (step) {
      case 0:
        return true;
      case 1:
        return Boolean(draft.firstName.trim() && draft.ageRange && draft.situation);
      case 2:
        if (draft.goalKinds.length === 0) return false;
        if (draft.goalKinds.includes("custom") && !draft.customGoalLabel.trim()) {
          return false;
        }
        return true;
      case 3:
        if (!draft.whyId) return false;
        if (draft.whyId === "custom" && !draft.whyText.trim()) return false;
        return true;
      case 4:
        // Bank step is skippable — always allow advance
        return true;
      case 5:
        return Boolean(draft.plan.tier);
      case 6:
        return Boolean(
          draft.firstGoal &&
            draft.firstGoal.name.trim() &&
            draft.firstGoal.targetAmount > 0
        );
      case 7:
        return Boolean(draft.firstQuest);
      case 8:
        return true;
      default:
        return false;
    }
  }, [step, draft]);

  // ─── Navigation ────────────────────────────────────────────────────────────
  const goNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (step < TOTAL_STEPS - 1) setStep(step + 1);
  };
  const goBack = () => {
    if (step === 0) return;
    Haptics.selectionAsync();
    setStep(step - 1);
  };

  // Resolve the final "why" string + icon from the user's selection.
  const resolveWhy = (): { text: string; icon: IconName } => {
    if (draft.whyId === "custom") {
      return { text: draft.whyText, icon: "sparkles" };
    }
    const found = WHY_OPTIONS.find((w) => w.id === draft.whyId);
    return {
      text: found?.label ?? "",
      icon: (found?.icon as IconName) ?? "sparkles",
    };
  };

  // ─── Final submission ──────────────────────────────────────────────────────
  const handleFinish = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSubmitting(true);
    try {
      const { text, icon } = resolveWhy();
      const finalDraft = { ...draft, whyText: text, whyIcon: icon };
      patch({ whyText: text, whyIcon: icon });

      // Send everything to the backend in one atomic call.
      await onboardingService.complete(finalDraft);

      // Update the local user with the bits the home screen reads.
      updateUser({
        firstName: finalDraft.firstName,
        why: text,
        whyIcon: icon,
        subscriptionTier: finalDraft.plan.tier,
        streak: 1,
      });

      await setOnboardingComplete();
      reset();
      router.replace("/(tabs)/today");
    } catch {
      Alert.alert(
        "Couldn't save your setup",
        "Bud will keep your answers ready. Let's try that again in a moment."
      );
      setSubmitting(false);
    }
  };

  // ─── Footer (next / skip / finish) ─────────────────────────────────────────
  const footer = (() => {
    if (step === 0) {
      return <PrimaryButton label="Let's start" onPress={goNext} />;
    }
    if (step === 4) {
      // Bank step has its own connect button inline. Footer offers Continue + Skip.
      return (
        <>
          <PrimaryButton
            label={draft.bankConnected ? "Continue" : "Continue without connecting"}
            onPress={goNext}
          />
          {!draft.bankConnected && (
            <SecondaryButton label="I'll connect later" onPress={goNext} />
          )}
        </>
      );
    }
    if (step === 7) {
      return <PrimaryButton label="Sounds good" onPress={goNext} />;
    }
    if (step === TOTAL_STEPS - 1) {
      return (
        <PrimaryButton
          label={
            draft.shareToBuds ? "Post & enter Budget Buddy" : "Enter Budget Buddy"
          }
          onPress={handleFinish}
          loading={submitting}
        />
      );
    }
    return (
      <PrimaryButton
        label="Continue"
        onPress={goNext}
        disabled={!canAdvance}
      />
    );
  })();

  return (
    <OnboardingShell
      step={step}
      totalSteps={TOTAL_STEPS}
      onBack={step === 0 ? undefined : goBack}
      hideProgress={step === 0}
      centerContent={step === 0}
      footer={footer}
    >
      {step === 0 && (
        <StepWelcome firstName={draft.firstName || user?.firstName || ""} onNext={goNext} />
      )}

      {step === 1 && (
        <StepProfile
          firstName={draft.firstName}
          ageRange={draft.ageRange}
          situation={draft.situation}
          onChangeName={(v) => patch({ firstName: v })}
          onChangeAge={(v) => patch({ ageRange: v })}
          onChangeSituation={(v) => patch({ situation: v })}
        />
      )}

      {step === 2 && (
        <StepGoals
          selected={draft.goalKinds}
          customLabel={draft.customGoalLabel}
          onToggle={(kind) => {
            const has = draft.goalKinds.includes(kind);
            const next = has
              ? draft.goalKinds.filter((g) => g !== kind)
              : [...draft.goalKinds, kind].slice(0, 3);
            patch({ goalKinds: next });
          }}
          onChangeCustom={(v) => patch({ customGoalLabel: v })}
        />
      )}

      {step === 3 && (
        <StepWhy
          selectedId={draft.whyId}
          customText={draft.whyText}
          onSelect={(id) => {
            const opt = WHY_OPTIONS.find((w) => w.id === id);
            patch({
              whyId: id,
              // Keep the canonical label in whyText unless they're typing custom.
              whyText: id === "custom" ? draft.whyText : opt?.label ?? "",
              whyIcon: (opt?.icon as IconName) ?? "sparkles",
            });
          }}
          onChangeCustom={(v) => patch({ whyText: v })}
        />
      )}

      {step === 4 && (
        <StepBank
          bankConnected={draft.bankConnected}
          onConnected={() => patch({ bankConnected: true })}
        />
      )}

      {step === 5 && (
        <StepPricing
          selectedTier={draft.plan.tier}
          cycle={draft.plan.cycle}
          isLifetime={draft.plan.isLifetime}
          onChangeTier={(tier) =>
            patch({ plan: { ...draft.plan, tier } })
          }
          onChangeCycle={(cycle) =>
            patch({ plan: { ...draft.plan, cycle } })
          }
          onChangeLifetime={(isLifetime) =>
            patch({ plan: { ...draft.plan, isLifetime } })
          }
        />
      )}

      {step === 6 && (
        <StepFirstGoal
          goalKind={draft.goalKinds[0] ?? "custom"}
          customGoalLabel={draft.customGoalLabel}
          goal={draft.firstGoal}
          onChange={(g) => patch({ firstGoal: g })}
        />
      )}

      {step === 7 && (
        <StepFirstQuest
          goalKinds={draft.goalKinds.length ? draft.goalKinds : ["custom"]}
          quest={draft.firstQuest}
          onLoaded={(q) => patch({ firstQuest: q })}
        />
      )}

      {step === 8 && (
        <StepShare
          firstName={draft.firstName}
          whyIcon={draft.whyIcon}
          share={draft.shareToBuds}
          onChangeShare={(v) => patch({ shareToBuds: v })}
        />
      )}
    </OnboardingShell>
  );
}

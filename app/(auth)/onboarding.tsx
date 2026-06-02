/**
 * Onboarding Container
 *
 * Implements the onboarding flow specified in Section 4 of the developer review:
 *
 *   0. Welcome             — Bud hero moment
 *   1. Profile             — name + age + life situation
 *   2. Goals               — pick 1–3 goal kinds
 *   3. Why                 — emotional anchor
 *   4. Bank                — Plaid connect (skippable)
 *   5. Pricing             — tier select + monthly/annual + lifetime
 *   6. First Goal          — concrete target + deadline + reason
 *   7. First Quest + Streak — Bud assigns + flame ignites
 *   8. Account             — create credentials when this is a new user
 *   9. Buds Share          — opt-in starting moment
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
import { StepAccount } from "@/features/onboarding/steps/StepAccount";
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

type StepKey =
  | "welcome"
  | "profile"
  | "goals"
  | "why"
  | "bank"
  | "pricing"
  | "firstGoal"
  | "firstQuest"
  | "account"
  | "share";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function OnboardingScreen() {
  const user = useUser();
  const { register, updateUser, setOnboardingComplete } = useAuthActions();

  const draft = useDraft();
  const { patch, reset } = useDraftActions();
  const step = useOnboardingStore((s) => s.step);
  const setStep = useOnboardingStore((s) => s.setStep);

  const [submitting, setSubmitting] = useState(false);
  const needsAccount = !user;
  const steps = useMemo<StepKey[]>(
    () => [
      "welcome",
      "profile",
      "goals",
      "why",
      "bank",
      "pricing",
      "firstGoal",
      "firstQuest",
      ...(needsAccount ? (["account"] as const) : []),
      "share",
    ],
    [needsAccount],
  );
  const currentStep = steps[step] ?? "welcome";

  useEffect(() => {
    if (step >= steps.length) {
      setStep(steps.length - 1);
    }
  }, [setStep, step, steps.length]);

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
    switch (currentStep) {
      case "welcome":
        return true;
      case "profile":
        return Boolean(draft.firstName.trim() && draft.ageRange && draft.situation);
      case "goals":
        if (draft.goalKinds.length === 0) return false;
        if (draft.goalKinds.includes("custom") && !draft.customGoalLabel.trim()) {
          return false;
        }
        return true;
      case "why":
        if (!draft.whyId) return false;
        if (draft.whyId === "custom" && !draft.whyText.trim()) return false;
        return true;
      case "bank":
        // Bank step is skippable — always allow advance
        return true;
      case "pricing":
        return Boolean(draft.plan.tier);
      case "firstGoal":
        return Boolean(
          draft.firstGoal &&
            draft.firstGoal.name.trim() &&
            draft.firstGoal.targetAmount > 0
        );
      case "firstQuest":
        return Boolean(draft.firstQuest);
      case "account":
        return Boolean(
          emailPattern.test(draft.accountEmail.trim()) &&
            draft.accountPassword.length >= 8 &&
            draft.accountPassword === draft.accountPasswordConfirm
        );
      case "share":
        return true;
      default:
        return false;
    }
  }, [currentStep, draft]);

  // ─── Navigation ────────────────────────────────────────────────────────────
  const goNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (step < steps.length - 1) setStep(step + 1);
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

      if (!user) {
        await register({
          firstName: finalDraft.firstName.trim(),
          lastName: "",
          email: finalDraft.accountEmail.trim().toLowerCase(),
          password: finalDraft.accountPassword,
        });
      }

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
        "Check the account details and try again. Your answers are still here."
      );
      setSubmitting(false);
    }
  };

  // ─── Footer (next / skip / finish) ─────────────────────────────────────────
  const footer = (() => {
    if (currentStep === "welcome") {
      return <PrimaryButton label="Let's start" onPress={goNext} />;
    }
    if (currentStep === "bank") {
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
    if (currentStep === "firstQuest") {
      return (
        <PrimaryButton
          label={canAdvance ? "Sounds good" : "Picking your quest..."}
          onPress={goNext}
          disabled={!canAdvance}
        />
      );
    }
    if (currentStep === "share") {
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
      totalSteps={steps.length}
      onBack={step === 0 ? undefined : goBack}
      hideProgress={currentStep === "welcome"}
      centerContent={currentStep === "welcome"}
      footer={footer}
    >
      {currentStep === "welcome" && (
        <StepWelcome
          firstName={draft.firstName || user?.firstName || ""}
          onNext={goNext}
          onLogin={() => router.replace("/(auth)/login")}
        />
      )}

      {currentStep === "profile" && (
        <StepProfile
          firstName={draft.firstName}
          ageRange={draft.ageRange}
          situation={draft.situation}
          onChangeName={(v) => patch({ firstName: v })}
          onChangeAge={(v) => patch({ ageRange: v })}
          onChangeSituation={(v) => patch({ situation: v })}
        />
      )}

      {currentStep === "goals" && (
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

      {currentStep === "why" && (
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

      {currentStep === "bank" && (
        <StepBank
          bankConnected={draft.bankConnected}
          onConnected={() => patch({ bankConnected: true })}
        />
      )}

      {currentStep === "pricing" && (
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

      {currentStep === "firstGoal" && (
        <StepFirstGoal
          goalKind={draft.goalKinds[0] ?? "custom"}
          customGoalLabel={draft.customGoalLabel}
          goal={draft.firstGoal}
          onChange={(g) => patch({ firstGoal: g })}
        />
      )}

      {currentStep === "firstQuest" && (
        <StepFirstQuest
          goalKinds={draft.goalKinds.length ? draft.goalKinds : ["custom"]}
          quest={draft.firstQuest}
          onLoaded={(q) => patch({ firstQuest: q })}
        />
      )}

      {currentStep === "account" && (
        <StepAccount
          email={draft.accountEmail}
          password={draft.accountPassword}
          passwordConfirm={draft.accountPasswordConfirm}
          onChangeEmail={(v) => patch({ accountEmail: v })}
          onChangePassword={(v) => patch({ accountPassword: v })}
          onChangePasswordConfirm={(v) => patch({ accountPasswordConfirm: v })}
        />
      )}

      {currentStep === "share" && (
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

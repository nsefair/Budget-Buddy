/**
 * Onboarding Container
 *
 * Implements the onboarding flow specified in Section 4 of the developer review:
 *
 *   0. Welcome             — Bud hero moment
 *   1. Profile             — name + age + life situation
 *   2. Goals               — pick 1–3 goal kinds
 *   3. Why                 — emotional anchor
 *   4. Account             — create credentials before Plaid when this is a new user
 *   5. Bank                — Plaid connect (skippable)
 *   6. Pricing             — tier select + monthly/annual + lifetime
 *   7. First Goal          — concrete target + deadline + reason
 *   8. First Quest + Streak — Bud assigns + flame ignites
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
  | "account";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function OnboardingScreen() {
  const user = useUser();
  const { register, updateUser, setOnboardingComplete } = useAuthActions();

  const draft = useDraft();
  const { patch, reset } = useDraftActions();
  const step = useOnboardingStore((s) => s.step);
  const setStep = useOnboardingStore((s) => s.setStep);

  const [submitting, setSubmitting] = useState(false);
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [requiresAccount] = useState(() => !user);
  const [accountCreated, setAccountCreated] = useState(Boolean(user));
  const steps = useMemo<StepKey[]>(
    () => [
      "welcome",
      "profile",
      "goals",
      "why",
      ...(requiresAccount ? (["account"] as const) : []),
      "bank",
      "pricing",
      "firstGoal",
      "firstQuest",
    ],
    [requiresAccount],
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

  const createAccount = async (): Promise<boolean> => {
    if (accountCreated || user) {
      setAccountCreated(true);
      return true;
    }
    if (
      !emailPattern.test(draft.accountEmail.trim()) ||
      draft.accountPassword.length < 8 ||
      draft.accountPassword !== draft.accountPasswordConfirm
    ) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return false;
    }

    setCreatingAccount(true);
    try {
      await register({
        firstName: draft.firstName.trim(),
        lastName: "",
        email: draft.accountEmail.trim().toLowerCase(),
        password: draft.accountPassword,
      });
      updateUser({ firstName: draft.firstName.trim() });
      setAccountCreated(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return true;
    } catch {
      Alert.alert(
        "Couldn't create your account",
        "Check the email and password, then try again. Your setup is still here."
      );
      return false;
    } finally {
      setCreatingAccount(false);
    }
  };

  const handleAccountContinue = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const ready = await createAccount();
    if (ready) goNext();
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
      const finalDraft = { ...draft, whyText: text, whyIcon: icon, shareToBuds: false };
      patch({ whyText: text, whyIcon: icon, shareToBuds: false });

      if (requiresAccount && !accountCreated) {
        const ready = await createAccount();
        if (!ready) {
          setSubmitting(false);
          return;
        }
      }

      // Send everything to the backend in one atomic call.
      await onboardingService.complete(finalDraft);

      // Update the local user with the bits the home screen reads.
      updateUser({
        firstName: finalDraft.firstName,
        why: text,
        whyIcon: icon,
        subscriptionTier: "free",
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
    if (currentStep === "account") {
      return (
        <PrimaryButton
          label={accountCreated ? "Continue" : "Create account"}
          onPress={handleAccountContinue}
          disabled={!canAdvance}
          loading={creatingAccount}
        />
      );
    }
    if (currentStep === "firstQuest") {
      return (
        <PrimaryButton
          label={canAdvance ? "Enter Budget Buddy" : "Picking your quest..."}
          onPress={handleFinish}
          disabled={!canAdvance}
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

    </OnboardingShell>
  );
}

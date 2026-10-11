/**
 * The four-question money plan (first setup on Today and "Edit plan"), in the
 * onboarding's calm language: segmented progress, hairline cards, chips and
 * segmented choices that invert when selected, and "$" amount fields like
 * "I spent". Validation, steps, and the saved profile are unchanged; the
 * server does all the math.
 */

import React, { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { GrowBar } from "@/animations";
import { Icon, type IconName } from "@/components/Icon";
import { Colors } from "@/constants/colors";
import { moneyService, type MoneyProfile } from "@/services/moneyService";
import { dollarsToCents, isFutureDate, localDate } from "./input";

type SourceDraft = { id: string; label: string; amount: string; cadence: "weekly" | "biweekly" | "monthly"; arrival: string };
type BillDraft = { name: string; amount: string };
const sourceNames = ["Job", "Parents", "Financial aid", "Other"];
const cadences = ["weekly", "biweekly", "monthly"] as const;
const cadenceLabel = { weekly: "Weekly", biweekly: "Every 2 weeks", monthly: "Monthly" } as const;
const TITLES = ["Where does your money come from?", "When does it arrive next?", "What are your fixed bills?", "What can you set aside?"];

export function MoneySetup({ onSaved, initialProfile, onCancel }: { onSaved: () => Promise<unknown>; initialProfile?: MoneyProfile; onCancel?: () => void }) {
  const [step, setStep] = useState(0);
  const [sources, setSources] = useState<SourceDraft[]>(() => initialProfile?.sources.map(source => ({ id: source.id, label: "Other", amount: String(source.amountCents / 100), cadence: source.monthly ? "monthly" : source.periodDays === 7 ? "weekly" : "biweekly", arrival: source.nextArrival })) ?? [{ id: "income-1", label: "Job", amount: "", cadence: "biweekly", arrival: "" }]);
  const [bills, setBills] = useState<BillDraft[]>(() => initialProfile?.bills.map(bill => ({ name: bill.name, amount: String(bill.monthlyCents / 100) })) ?? []);
  const [goal, setGoal] = useState(String((initialProfile?.goalMonthlyCents ?? 0) / 100));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);
  const patchSource = (index: number, patch: Partial<SourceDraft>) => setSources(current => current.map((source, i) => i === index ? { ...source, ...patch } : source));

  const next = async () => {
    if (busy.current) return;
    setError("");
    if (step === 0 && sources.some(source => dollarsToCents(source.amount) === null || dollarsToCents(source.amount) === 0)) {
      setError("Enter a positive amount for each income source, with up to two decimal places."); return;
    }
    if (step === 1 && sources.some(source => !isFutureDate(source.arrival.trim()))) {
      setError("Use a real future date within the next year, in YYYY-MM-DD format."); return;
    }
    if (step === 2 && bills.some(bill => !bill.name.trim() || dollarsToCents(bill.amount) === null)) {
      setError("Give each bill a name and monthly amount, or remove it."); return;
    }
    if (step < 3) { setStep(step + 1); return; }
    const goalCents = dollarsToCents(goal);
    if (goalCents === null) { setError("Enter a monthly goal amount. Zero is fine."); return; }
    busy.current = true; setSaving(true);
    const profile: MoneyProfile = {
      timezone: initialProfile?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
      startDate: initialProfile?.startDate ?? localDate(),
      sources: sources.map(source => ({
        ...initialProfile?.sources.find(saved => saved.id === source.id),
        id: source.id, amountCents: dollarsToCents(source.amount)!,
        periodDays: source.cadence === "weekly" ? 7 : source.cadence === "biweekly" ? 14 : 0,
        monthly: source.cadence === "monthly", nextArrival: source.arrival.trim(),
      })),
      bills: bills.map(bill => ({ name: bill.name.trim(), monthlyCents: dollarsToCents(bill.amount)!, merchants: initialProfile?.bills.find(saved => saved.name === bill.name.trim())?.merchants ?? [bill.name.trim()] })),
      goalMonthlyCents: goalCents,
    };
    try { await moneyService.saveProfile(profile); await onSaved(); }
    catch { setError("Couldn't save your plan. Check your connection and try again."); }
    finally { busy.current = false; setSaving(false); }
  };

  return (
    <View style={styles.panel}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>
          {initialProfile ? "EDIT YOUR PLAN" : "YOUR DAILY NUMBER"} · {step + 1} OF 4
        </Text>
        <View style={styles.segments} accessible accessibilityRole="progressbar" accessibilityLabel={`Step ${step + 1} of 4`}>
          {TITLES.map((_, index) => (
            <GrowBar
              key={index}
              progress={index <= step ? 1 : 0}
              color={Colors.gold}
              trackColor={Colors.navy100}
              height={3}
              duration={index === step ? 520 : 0}
              style={styles.segment}
            />
          ))}
        </View>
      </View>
      <Text style={styles.title} accessibilityRole="header">{TITLES[step]}</Text>
      <Text style={styles.body}>
        {initialProfile
          ? "Update your income and plan. Today's morning allowance stays fixed; your remaining money and future days use the updated plan."
          : "A bank connection is optional. Start with what you know."}
      </Text>

      {step === 0 && sources.map((source, index) => (
        <View key={source.id} style={styles.group}>
          <View style={styles.groupTop}>
            <Text style={styles.groupLabel}>INCOME {index + 1}</Text>
            {sources.length > 1 && (
              <QuietButton icon="trash" label="Remove" onPress={() => setSources(current => current.filter((_, i) => i !== index))} />
            )}
          </View>
          <View style={styles.chips} accessibilityRole="radiogroup">
            {sourceNames.map(name => (
              <Chip key={name} label={name} selected={source.label === name} onPress={() => patchSource(index, { label: name })} />
            ))}
          </View>
          <AmountField label={`${source.label}: amount each time`} value={source.amount} onChangeText={amount => patchSource(index, { amount })} />
          <View style={styles.segmentControl} accessibilityRole="radiogroup">
            {cadences.map(cadence => (
              <SegmentOption key={cadence} label={cadenceLabel[cadence]} selected={source.cadence === cadence} onPress={() => patchSource(index, { cadence })} />
            ))}
          </View>
        </View>
      ))}
      {step === 0 && sources.length < 20 && (
        <AddRow label="Add income source" onPress={() => setSources(current => [...current, { id: `income-${Date.now()}`, label: "Other", amount: "", cadence: "monthly", arrival: "" }])} />
      )}

      {step === 1 && sources.map((source, index) => (
        <Field
          key={source.id}
          icon="calendar"
          // Saved plans don't keep the source type, so number them instead of repeating "Other".
          label={`Income ${index + 1}${source.label === "Other" ? "" : ` (${source.label})`}: next arrival`}
          hint="YYYY-MM-DD"
          value={source.arrival}
          onChangeText={arrival => patchSource(index, { arrival })}
          placeholder="2026-10-16"
        />
      ))}

      {step === 2 && (
        <>
          <Text style={styles.note}>
            Monthly amounts only, no due dates. Use the merchant name (for example, Spotify) so synced bills are left out of flexible spending.
          </Text>
          {bills.map((bill, index) => (
            <View key={index} style={styles.group}>
              <View style={styles.groupTop}>
                <Text style={styles.groupLabel}>BILL {index + 1}</Text>
                <QuietButton icon="trash" label="Remove" onPress={() => setBills(current => current.filter((_, i) => i !== index))} />
              </View>
              <Field label="Bill or merchant name" value={bill.name} onChangeText={name => setBills(current => current.map((value, i) => i === index ? { ...value, name } : value))} />
              <AmountField label="Monthly amount" value={bill.amount} onChangeText={amount => setBills(current => current.map((value, i) => i === index ? { ...value, amount } : value))} />
            </View>
          ))}
          <AddRow label="Add a bill" onPress={() => setBills(current => [...current, { name: "", amount: "" }])} />
          {bills.length === 0 && <Text style={styles.note}>No fixed bills? Continue with zero.</Text>}
        </>
      )}

      {step === 3 && (
        <>
          <AmountField label="Monthly goal contribution" value={goal} onChangeText={setGoal} />
          <Text style={styles.note}>
            Zero is fine. This reserves part of your plan; it does not move money or add a contribution to a goal. A separate 10% income buffer is always kept aside.
          </Text>
        </>
      )}

      {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: saving }}
        disabled={saving}
        style={({ pressed }) => [styles.primary, saving && styles.disabled, pressed && !saving && styles.pressed]}
        onPress={next}
      >
        <Text style={styles.primaryText}>
          {saving ? "Saving…" : step === 3 ? (initialProfile ? "Save and recalculate" : "See my number") : "Continue"}
        </Text>
      </Pressable>
      {(step > 0 || onCancel) && (
        <View style={styles.secondaryRow}>
          {step > 0 && <SecondaryButton label="Back" disabled={saving} onPress={() => { setError(""); setStep(step - 1); }} />}
          {onCancel && <SecondaryButton label="Cancel changes" disabled={saving} onPress={onCancel} />}
        </View>
      )}
    </View>
  );
}

function Field({ label, value, onChangeText, placeholder, hint, icon }: { label: string; value: string; onChangeText: (value: string) => void; placeholder?: string; hint?: string; icon?: IconName }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}{hint ? <Text style={styles.fieldHint}>{`  ${hint}`}</Text> : null}</Text>
      <View style={styles.inputBox}>
        {icon ? <Icon name={icon} size={16} color={Colors.muted} strokeWidth={2.3} /> : null}
        <TextInput
          accessibilityLabel={label}
          value={value}
          onChangeText={onChangeText}
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor={Colors.muted}
          autoCorrect={false}
          maxLength={100}
        />
      </View>
    </View>
  );
}

function AmountField({ label, value, onChangeText }: { label: string; value: string; onChangeText: (value: string) => void }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.inputBox}>
        <Text style={styles.prefix}>$</Text>
        <TextInput
          accessibilityLabel={`${label} in dollars`}
          value={value}
          onChangeText={onChangeText}
          style={[styles.input, styles.amountInput]}
          keyboardType="decimal-pad"
          placeholder="0"
          placeholderTextColor={Colors.muted}
          maxLength={12}
        />
      </View>
    </View>
  );
}

// Selected choices invert, like the onboarding's option rows.
function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="radio" accessibilityState={{ checked: selected }} onPress={onPress} style={[styles.chip, selected && styles.chipSelected]}>
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

function SegmentOption({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="radio" accessibilityState={{ checked: selected }} onPress={onPress} style={[styles.segmentOption, selected && styles.segmentOptionSelected]}>
      <Text style={[styles.segmentText, selected && styles.segmentTextSelected]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
        {label}
      </Text>
    </Pressable>
  );
}

function AddRow({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.addRow, pressed && styles.pressed]}>
      <View style={styles.addTile}>
        <Icon name="plus" size={15} color={Colors.gold} strokeWidth={2.6} />
      </View>
      <Text style={styles.addText}>{label}</Text>
    </Pressable>
  );
}

function QuietButton({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} hitSlop={10} onPress={onPress} style={({ pressed }) => [styles.quiet, pressed && styles.pressed]}>
      <Icon name={icon} size={14} color={Colors.muted} strokeWidth={2.3} />
      <Text style={styles.quietText}>{label}</Text>
    </Pressable>
  );
}

function SecondaryButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.secondary, disabled && styles.disabled, pressed && !disabled && styles.pressed]}
    >
      <Text style={styles.secondaryText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  panel: { gap: 14, padding: 20, borderRadius: 22, backgroundColor: Colors.card, borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border },
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.5 },

  header: { gap: 10 },
  eyebrow: { fontSize: 10, fontWeight: "800", letterSpacing: 1.6, color: Colors.muted },
  segments: { flexDirection: "row", gap: 4 },
  segment: { flex: 1 },
  title: { fontSize: 24, lineHeight: 30, fontWeight: "800", letterSpacing: -0.4, color: Colors.navy },
  body: { fontSize: 14, lineHeight: 21, color: Colors.navyMuted },
  note: { fontSize: 13, lineHeight: 19, color: Colors.muted },

  group: { gap: 12, padding: 14, borderRadius: 18, backgroundColor: Colors.navy50 },
  groupTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  groupLabel: { fontSize: 10, fontWeight: "800", letterSpacing: 1.4, color: Colors.muted },

  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { minHeight: 40, justifyContent: "center", paddingHorizontal: 14, borderRadius: 999, backgroundColor: Colors.card, borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border },
  chipSelected: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  chipText: { fontSize: 14, fontWeight: "600", color: Colors.navy },
  chipTextSelected: { color: Colors.card, fontWeight: "700" },

  segmentControl: { flexDirection: "row", padding: 3, borderRadius: 999, backgroundColor: Colors.card, borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border },
  segmentOption: { flex: 1, minHeight: 40, alignItems: "center", justifyContent: "center", paddingHorizontal: 6, borderRadius: 999 },
  segmentOptionSelected: { backgroundColor: Colors.navy },
  segmentText: { fontSize: 13, fontWeight: "600", color: Colors.muted },
  segmentTextSelected: { color: Colors.card, fontWeight: "700" },

  field: { gap: 7 },
  fieldLabel: { fontSize: 13, fontWeight: "600", color: Colors.navy },
  fieldHint: { fontWeight: "500", color: Colors.muted },
  inputBox: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 50, paddingHorizontal: 14, borderRadius: 14, backgroundColor: Colors.card, borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border },
  input: { flex: 1, paddingVertical: 12, fontSize: 16, color: Colors.navy },
  prefix: { fontSize: 18, fontWeight: "700", color: Colors.muted },
  amountInput: { fontSize: 18, fontWeight: "700", fontVariant: ["tabular-nums"] },

  addRow: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 48, paddingHorizontal: 14, borderRadius: 16, borderWidth: 1, borderStyle: "dashed", borderColor: Colors.navy200 },
  addTile: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: Colors.accentAlpha12 },
  addText: { fontSize: 15, fontWeight: "700", color: Colors.navy },
  quiet: { flexDirection: "row", alignItems: "center", gap: 5, minHeight: 32 },
  quietText: { fontSize: 13, fontWeight: "600", color: Colors.muted },

  // Calm, like the rest of Today: no red, even for a validation message.
  error: { fontSize: 14, lineHeight: 20, fontWeight: "600", color: Colors.navy },
  primary: { minHeight: 52, alignItems: "center", justifyContent: "center", paddingHorizontal: 16, borderRadius: 18, backgroundColor: Colors.gold },
  primaryText: { fontSize: 16, fontWeight: "700", color: Colors.onAccent },
  secondaryRow: { flexDirection: "row", gap: 10 },
  secondary: { flex: 1, minHeight: 48, alignItems: "center", justifyContent: "center", paddingHorizontal: 12, borderRadius: 16, backgroundColor: Colors.card, borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border },
  secondaryText: { fontSize: 15, fontWeight: "700", color: Colors.navy },
});

import React, { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Colors } from "@/constants/colors";
import { moneyService, type MoneyProfile } from "@/services/moneyService";
import { dollarsToCents, isFutureDate, localDate } from "./input";

type SourceDraft = { id: string; label: string; amount: string; cadence: "weekly" | "biweekly" | "monthly"; arrival: string };
type BillDraft = { name: string; amount: string };
const sourceNames = ["Job", "Parents", "Financial aid", "Other"];
const cadences = ["weekly", "biweekly", "monthly"] as const;

export function MoneySetup({ onSaved }: { onSaved: () => Promise<unknown> }) {
  const [step, setStep] = useState(0);
  const [sources, setSources] = useState<SourceDraft[]>([{ id: "income-1", label: "Job", amount: "", cadence: "biweekly", arrival: "" }]);
  const [bills, setBills] = useState<BillDraft[]>([]);
  const [goal, setGoal] = useState("0");
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
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      startDate: localDate(),
      sources: sources.map(source => ({
        id: source.id, amountCents: dollarsToCents(source.amount)!,
        periodDays: source.cadence === "weekly" ? 7 : source.cadence === "biweekly" ? 14 : 0,
        monthly: source.cadence === "monthly", nextArrival: source.arrival.trim(),
      })),
      bills: bills.map(bill => ({ name: bill.name.trim(), monthlyCents: dollarsToCents(bill.amount)!, merchants: [bill.name.trim()] })),
      goalMonthlyCents: goalCents,
    };
    try { await moneyService.saveProfile(profile); await onSaved(); }
    catch { setError("Couldn't save your plan. Check your connection and try again."); }
    finally { busy.current = false; setSaving(false); }
  };

  return <View style={styles.panel}>
    <Text style={styles.eyebrow}>YOUR DAILY NUMBER · {step + 1} OF 4</Text>
    <Text style={styles.title}>{["Where does your money come from?", "When does it arrive next?", "What are your fixed bills?", "What can you set aside?"][step]}</Text>
    <Text style={styles.body}>A bank connection is optional. Start with what you know.</Text>
    {step === 0 && sources.map((source, index) => <View key={source.id} style={styles.group}>
      <Text style={styles.label}>Income {index + 1}</Text>
      <View style={styles.choices}>{sourceNames.map(name => <Choice key={name} label={name} selected={source.label === name} onPress={() => patchSource(index, { label: name })} />)}</View>
      <Field label={`${source.label}: amount each time ($)`} value={source.amount} onChangeText={amount => patchSource(index, { amount })} numeric />
      <View style={styles.choices}>{cadences.map(cadence => <Choice key={cadence} label={cadence === "biweekly" ? "Every 2 weeks" : cadence === "weekly" ? "Weekly" : "Monthly"} selected={source.cadence === cadence} onPress={() => patchSource(index, { cadence })} />)}</View>
      {sources.length > 1 && <TextButton label="Remove income" onPress={() => setSources(current => current.filter((_, i) => i !== index))} />}
    </View>)}
    {step === 0 && sources.length < 20 && <TextButton label="+ Add income source" onPress={() => setSources(current => [...current, { id: `income-${Date.now()}`, label: "Other", amount: "", cadence: "monthly", arrival: "" }])} />}
    {step === 1 && sources.map((source, index) => <Field key={source.id} label={`${source.label}: next arrival (YYYY-MM-DD)`} value={source.arrival} onChangeText={arrival => patchSource(index, { arrival })} placeholder="2026-10-16" />)}
    {step === 2 && <>
      <Text style={styles.body}>Monthly amounts only—no due dates. Use the merchant name (for example, Spotify) so synced bills can be excluded from flexible spending.</Text>
      {bills.map((bill, index) => <View key={index} style={styles.group}>
        <Field label="Bill or merchant name" value={bill.name} onChangeText={name => setBills(current => current.map((value, i) => i === index ? { ...value, name } : value))} />
        <Field label="Monthly amount ($)" value={bill.amount} numeric onChangeText={amount => setBills(current => current.map((value, i) => i === index ? { ...value, amount } : value))} />
        <TextButton label="Remove bill" onPress={() => setBills(current => current.filter((_, i) => i !== index))} />
      </View>)}
      <TextButton label="+ Add a bill" onPress={() => setBills(current => [...current, { name: "", amount: "" }])} />
      {bills.length === 0 && <Text style={styles.body}>No fixed bills? Continue with zero.</Text>}
    </>}
    {step === 3 && <>
      <Field label="Monthly goal contribution ($)" value={goal} onChangeText={setGoal} numeric />
      <Text style={styles.body}>Zero is fine. This reserves part of your plan; it does not move money or add a contribution to a goal. A separate 10% income buffer is always kept aside.</Text>
    </>}
    {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
    <Pressable accessibilityRole="button" disabled={saving} style={[styles.button, saving && { opacity: 0.5 }]} onPress={next}><Text style={styles.buttonText}>{saving ? "Saving…" : step === 3 ? "See my number" : "Continue"}</Text></Pressable>
    {step > 0 && <TextButton disabled={saving} label="Back" onPress={() => { setError(""); setStep(step - 1); }} />}
  </View>;
}

function Field({ label, value, onChangeText, numeric, placeholder }: { label: string; value: string; onChangeText: (value: string) => void; numeric?: boolean; placeholder?: string }) {
  return <View style={{ gap: 7, marginVertical: 8 }}><Text style={styles.label}>{label}</Text><TextInput accessibilityLabel={label} value={value} onChangeText={onChangeText} style={styles.input} keyboardType={numeric ? "decimal-pad" : "default"} placeholder={placeholder} placeholderTextColor={Colors.muted} autoCorrect={false} maxLength={numeric ? 12 : 100} /></View>;
}
function Choice({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="radio" accessibilityState={{ checked: selected }} onPress={onPress} style={[styles.choice, selected && { borderColor: Colors.gold, backgroundColor: Colors.greenSurface }]}><Text style={styles.label}>{label}</Text></Pressable>;
}
function TextButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" onPress={onPress} disabled={disabled} style={{ paddingVertical: 14, minHeight: 44 }}><Text style={styles.link}>{label}</Text></Pressable>;
}
const styles = StyleSheet.create({
  panel: { gap: 12, padding: 22, borderRadius: 24, backgroundColor: Colors.card },
  eyebrow: { color: Colors.muted, fontSize: 11, fontWeight: "700", letterSpacing: 1.5 },
  title: { color: Colors.navy, fontSize: 26, fontWeight: "700" },
  body: { color: Colors.navyMuted, fontSize: 14, lineHeight: 21 },
  label: { color: Colors.navy, fontSize: 14, fontWeight: "600" },
  group: { paddingVertical: 12, gap: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  choices: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  choice: { padding: 12, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, minHeight: 44 },
  input: { padding: 14, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, color: Colors.navy, fontSize: 16 },
  button: { padding: 16, alignItems: "center", backgroundColor: Colors.gold, borderRadius: 16, minHeight: 48 },
  buttonText: { color: Colors.onAccent, fontSize: 16, fontWeight: "700" },
  link: { color: Colors.navy, fontWeight: "600", textDecorationLine: "underline" },
  error: { color: Colors.coral, fontSize: 14, lineHeight: 20 },
});

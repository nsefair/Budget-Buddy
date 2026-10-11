import React, { useCallback, useRef, useState } from "react";
import { ActivityIndicator, Animated, AppState, KeyboardAvoidingView, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleProp, StyleSheet, Switch, Text, TextInput, View, ViewStyle } from "react-native";
import { useFocusEffect, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import Svg, { Circle } from "react-native-svg";
import { LinearGradient } from "expo-linear-gradient";
import { CountUp, useEntranceProgress, useFocusReplay } from "@/animations";
import { Colors } from "@/constants/colors";
import { TAB_BAR_HEIGHT } from "@/constants/tokens";
import { useUser } from "@/hooks/useAuth";
import { moneyService, type MoneySpending, type MoneyToday, type MoneyProfile } from "@/services/moneyService";
import { MoneySetup } from "./MoneySetup";
import { dollarsToCents, money } from "./input";

const RING_RADIUS = 116;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const wholeDollars = (value: number) => `$${Math.round(value).toLocaleString("en-US")}`;
// "2026-11-01" → "Nov 1" (parsed at local noon so the day never shifts).
const shortDate = (isoDay: string) => new Date(`${isoDay}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });

function setupRequired(error: unknown) {
  return isAxiosError(error) && error.response?.data?.error?.code === "money_setup_required";
}
function freshness(data: MoneyToday) {
  if (data.bankState === "manual") return "Based on your plan and logged spending";
  if (data.bankState === "reconnect_required") return "Reconnect your bank · some spending may be missing";
  if (data.bankState === "stale") return "Bank update delayed · some spending may be missing";
  return data.lastSyncAt ? `Bank updated ${new Date(data.lastSyncAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}` : "Waiting for the first bank update";
}

export function BetaToday() {
  const user = useUser();
  const insets = useSafeAreaInsets();
  const client = useQueryClient();
  const queryKey = ["money", user?.id, "today"];
  const query = useQuery({ queryKey, queryFn: moneyService.today, enabled: Boolean(user), retry: (count, error) => !setupRequired(error) && count < 1, staleTime: 15_000 });
  const { refetch } = query;
  const [showMath, setShowMath] = useState(false);
  const [showSpending, setShowSpending] = useState(false);
  const [amount, setAmount] = useState("");
  const [cash, setCash] = useState(false);
  const [saving, setSaving] = useState(false);
  const [spendError, setSpendError] = useState("");
  const pendingSpend = useRef<MoneySpending | null>(null);
  const busy = useRef(false);
  const refreshBusy = useRef(false);
  const [recalculating, setRecalculating] = useState(false);
  const [actionMessage, setActionMessage] = useState("");
  const [editProfile, setEditProfile] = useState<MoneyProfile | null>(null);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const recalculate = async () => {
    if (refreshBusy.current) return;
    refreshBusy.current = true; setRecalculating(true); setActionMessage("");
    try {
      const updated = await moneyService.recalculate(query.data?.bankState !== "manual");
      await client.cancelQueries({ queryKey });
      client.setQueryData(queryKey, updated);
      await client.invalidateQueries({ queryKey: ["budget"] });
      setActionMessage("Recalculated from your latest spending. Your morning allowance stays fixed.");
    } catch (error) { setActionMessage(error instanceof Error ? error.message : "Couldn’t recalculate. Please try again."); }
    finally { refreshBusy.current = false; setRecalculating(false); }
  };
  const editPlan = async () => {
    setLoadingPlan(true); setActionMessage("");
    try { setEditProfile((await moneyService.profile()).profile); }
    catch { setActionMessage("Couldn’t load your plan. Please try again."); }
    finally { setLoadingPlan(false); }
  };

  // Refresh on foreground, tab return, and local midnight while Today is open.
  useFocusEffect(useCallback(() => {
    void refetch();
    const listener = AppState.addEventListener("change", state => { if (state === "active") void refetch(); });
    const timer = setInterval(() => { if (AppState.currentState === "active") void refetch(); }, 60_000);
    return () => { listener.remove(); clearInterval(timer); };
  }, [refetch]));

  const spend = async () => {
    if (busy.current) return;
    const cents = dollarsToCents(amount);
    if (!pendingSpend.current && (cents === null || cents <= 0)) { setSpendError("Enter a positive amount with up to two decimal places."); return; }
    // Keep the exact payload and key after a lost response; retry cannot add it twice.
    pendingSpend.current ??= { clientId: `spend-${Date.now()}-${Math.random().toString(36).slice(2)}`, amountCents: cents!, cash };
    busy.current = true; setSaving(true); setSpendError("");
    try {
      const updated = await moneyService.spend(pendingSpend.current);
      await client.cancelQueries({ queryKey });
      client.setQueryData(queryKey, updated);
      pendingSpend.current = null; setAmount(""); setShowSpending(false);
    } catch { setSpendError("Couldn't confirm this entry. Retry to check and save it once."); }
    finally { busy.current = false; setSaving(false); }
  };

  const data = query.data;
  const result = data?.result;
  const ratio = result && result.morningCents > 0 ? Math.min(1, Math.max(0, result.remainingCents / result.morningCents)) : 0;
  // Ring and number re-enter each time Today regains focus (static under Reduce Motion).
  const replay = useFocusReplay();
  const ring = useEntranceProgress(ratio, { replayKey: replay, duration: 700 });
  const ringOffset = ring.interpolate({ inputRange: [0, 1], outputRange: [RING_LENGTH, 0] });
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  return <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === "ios" ? "padding" : undefined}>
    <LinearGradient pointerEvents="none" colors={[Colors.accentAlpha14, Colors.accentAlpha05, "transparent"]} style={styles.glow} />
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, { paddingTop: insets.top + 20, paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 24 }]} refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => void refetch()} tintColor={Colors.navy} />}>
      <View style={styles.header}><Text style={styles.greeting}>{greeting}, {user?.firstName ?? "there"}.</Text><Pressable accessibilityRole="button" accessibilityLabel="Open profile" hitSlop={6} onPress={() => router.push("/profile")} style={({ pressed }) => [styles.avatar, pressed && { opacity: 0.7 }]}><Text style={styles.avatarText}>{(user?.firstName ?? "?").slice(0, 1).toUpperCase()}</Text></Pressable></View>
      <Text style={styles.subtitle}>{new Date().toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })} · A little clarity for today.</Text>
      {query.isPending && <ActivityIndicator accessibilityLabel="Calculating today's number" color={Colors.navy} />}
      {setupRequired(query.error) && <MoneySetup onSaved={async () => { await refetch(); }} />}
      {!!query.error && !setupRequired(query.error) && <View style={styles.card}><Text accessibilityRole="alert" style={styles.body}>{data ? "This is your last loaded number. Couldn't refresh—new spending may be missing." : "Couldn't load your number. Check your connection and try again."}</Text><Button title="Try again" onPress={() => void refetch()} /></View>}
      {!!actionMessage && <Text accessibilityRole="alert" style={styles.body}>{actionMessage}</Text>}
      {editProfile && <MoneySetup initialProfile={editProfile} onCancel={() => setEditProfile(null)} onSaved={async () => { setEditProfile(null); await refetch(); }} />}
      {data && result && !editProfile && <>
        <Text style={styles.freshness}>{freshness(data)}</Text>
        {data.bankState === "reconnect_required" && <Button title="Reconnect bank" secondary onPress={() => router.push("/(tabs)/budget")} />}
        <Pressable accessibilityRole="button" accessibilityLabel={`${money(result.remainingCents)} remaining today. Show calculation.`} onPress={() => setShowMath(value => !value)} style={styles.hero}>
          <Svg width={260} height={260} viewBox="0 0 260 260" accessible={false}>
            <Circle cx={130} cy={130} r={RING_RADIUS} stroke={Colors.accentAlpha12} strokeWidth={10} fill="none" />
            <AnimatedCircle cx={130} cy={130} r={RING_RADIUS} stroke={Colors.gold} strokeWidth={10} fill="none" strokeDasharray={`${RING_LENGTH}`} strokeDashoffset={ringOffset} strokeLinecap="round" rotation={-90} origin="130,130" />
          </Svg>
          <View pointerEvents="none" style={styles.heroText}><Text style={styles.heroLabel}>SAFE TO SPEND TODAY</Text><CountUp value={result.displayDollars} from={Math.floor(result.displayDollars * 0.85)} replayKey={replay} format={wholeDollars} fit style={styles.amount} /><Text style={styles.label}>left today</Text><Text style={styles.morning} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>of {money(result.morningCents)} this morning</Text></View>
        </Pressable>
        <Text style={styles.cycle}>{result.waitingForIncome ? "Still waiting on your next income." : `${result.daysLeft} ${result.daysLeft === 1 ? "day" : "days"} until your next income · ${shortDate(result.inputs.cycle.end)}`}</Text>
        <Pressable accessibilityRole="button" onPress={() => setShowMath(value => !value)} hitSlop={8} style={({ pressed }) => [styles.whyLink, pressed && { opacity: 0.6 }]}><Text style={styles.whyText}>{showMath ? "Hide calculation" : `Why ${wholeDollars(result.displayDollars)}?`}</Text></Pressable>
        <Button title="I spent" disabled={recalculating || loadingPlan} onPress={() => setShowSpending(true)} />
        <View style={styles.actionsRow}>
          <Button title={recalculating ? "Recalculating…" : "Recalculate"} accessibilityLabel="Recalculate safe to spend" secondary disabled={recalculating} onPress={() => void recalculate()} style={styles.half} />
          <Button title={loadingPlan ? "Loading…" : "Edit plan"} accessibilityLabel="Edit income and plan" secondary disabled={loadingPlan || recalculating} onPress={() => void editPlan()} style={styles.half} />
        </View>
        {showMath && <View style={styles.card}>
          <Text style={styles.cardTitle}>Your plan, in numbers</Text>
          <Text style={styles.body}>Cycle: {result.inputs.cycle.start} to {result.inputs.cycle.end}</Text>
          <Line label="Income for this cycle" cents={result.inputs.cycle.incomeCents} />
          <Line label="Bills set aside" cents={result.inputs.cycle.billsCents} />
          <Line label="Planned goal contribution" cents={result.inputs.cycle.plannedGoalCents} />
          <Line label="10% buffer" cents={result.bufferCents} />
          <Line label="Spending before today" cents={result.inputs.spentBeforeTodayCents} />
          <Line label="Moved to goals this cycle" cents={result.inputs.allocatedGoalCents} />
          <Line label="Today's spending, after paybacks" cents={result.inputs.spentTodayCents} />
          <Line label="Remaining flexible money" cents={Math.max(0, result.flexibleBalanceCents)} />
          <Text style={styles.body}>Your morning starting point stays fixed. New purchases reduce what is left today; refunds and paybacks can restore it. The displayed daily number rounds down to whole dollars.</Text>
        </View>}
        <View style={styles.card}><Text style={styles.cardTitle}>Room for real life</Text><Text style={styles.body}>{result.overCents > 0 ? "Today ran over its starting number. Tomorrow adjusts across the days left in your cycle." : "Your plan keeps bills, your goal contribution, and a 10% buffer aside before calculating today's number."}</Text></View>
      </>}
    </ScrollView>
    <Modal visible={showSpending} animationType="slide" transparent onRequestClose={() => { if (!saving) setShowSpending(false); }}>
      <KeyboardAvoidingView style={styles.scrim} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 24 }]}>
          <Text style={styles.cardTitle}>I spent</Text>
          <Text style={styles.body}>Log a purchase now. Matching bank transactions replace this entry automatically.</Text>
          <TextInput accessibilityLabel="Amount spent in dollars" placeholder="0.00" placeholderTextColor={Colors.muted} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" autoFocus maxLength={12} editable={!saving && !pendingSpend.current} style={styles.input} />
          <View style={styles.row}><Text style={styles.body}>Paid with physical cash</Text><Switch accessibilityLabel="Paid with physical cash" value={cash} onValueChange={setCash} disabled={saving || Boolean(pendingSpend.current)} /></View>
          {!!spendError && <Text accessibilityRole="alert" style={styles.body}>{spendError}</Text>}
          <Button title={saving ? "Saving…" : pendingSpend.current ? "Retry this entry" : "Save spending"} disabled={saving} onPress={() => void spend()} />
          <Button title="Close" secondary disabled={saving} onPress={() => setShowSpending(false)} />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  </KeyboardAvoidingView>;
}

function Line({ label, cents }: { label: string; cents: number }) {
  return <View style={styles.row}><Text style={[styles.body, { flex: 1 }]}>{label}</Text><Text style={styles.label}>{money(cents)}</Text></View>;
}
function Button({ title, onPress, secondary, disabled, accessibilityLabel, style }: { title: string; onPress: () => void; secondary?: boolean; disabled?: boolean; accessibilityLabel?: string; style?: StyleProp<ViewStyle> }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} accessibilityState={{ disabled: Boolean(disabled) }} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.button, secondary && styles.secondary, style, disabled && { opacity: 0.5 }, pressed && !disabled && { opacity: 0.8 }]}><Text style={[styles.buttonText, secondary && styles.secondaryText]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>{title}</Text></Pressable>;
}
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: Colors.surface },
  glow: { position: "absolute", top: 0, left: 0, right: 0, height: 420 },
  content: { paddingHorizontal: 22, gap: 16 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  greeting: { color: Colors.navy, fontSize: 26, lineHeight: 32, fontWeight: "800", letterSpacing: -0.4, flex: 1 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: Colors.card, borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border },
  avatarText: { color: Colors.navy, fontSize: 16, fontWeight: "800" },
  subtitle: { color: Colors.muted, fontSize: 15, marginTop: -8, marginBottom: 6 },
  freshness: { color: Colors.navyMuted, fontSize: 13, textAlign: "center", lineHeight: 20 },
  hero: { alignSelf: "center", alignItems: "center", justifyContent: "center", width: 260, height: 260 },
  heroText: { position: "absolute", width: 196, alignItems: "center", gap: 6 },
  heroLabel: { color: Colors.muted, fontSize: 11, letterSpacing: 1.4, fontWeight: "600" },
  amount: { alignSelf: "stretch", textAlign: "center", color: Colors.navy, fontSize: 64, fontWeight: "700", letterSpacing: -2 },
  label: { color: Colors.navy, fontSize: 15, fontWeight: "600" },
  morning: { color: Colors.muted, fontSize: 12 },
  cycle: { color: Colors.navyMuted, fontSize: 14, textAlign: "center", lineHeight: 20 },
  whyLink: { alignSelf: "center", minHeight: 32, justifyContent: "center", paddingHorizontal: 12, marginTop: -6 },
  whyText: { color: Colors.navy, fontSize: 14, fontWeight: "700", textDecorationLine: "underline" },
  button: { minHeight: 52, paddingHorizontal: 16, justifyContent: "center", borderRadius: 18, alignItems: "center", backgroundColor: Colors.gold },
  secondary: { backgroundColor: Colors.card, borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border },
  buttonText: { color: Colors.onAccent, fontSize: 16, fontWeight: "700" },
  secondaryText: { color: Colors.navy, fontSize: 15 },
  actionsRow: { flexDirection: "row", gap: 10, marginTop: -6 },
  half: { flex: 1 },
  card: { padding: 22, backgroundColor: Colors.card, borderRadius: 22, gap: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border },
  cardTitle: { color: Colors.navy, fontSize: 20, fontWeight: "700" },
  body: { color: Colors.navyMuted, fontSize: 14, lineHeight: 21 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 16 },
  scrim: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.35)" },
  sheet: { padding: 24, backgroundColor: Colors.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, gap: 18 },
  input: { borderWidth: 1, borderColor: Colors.border, borderRadius: 14, padding: 16, color: Colors.navy, fontSize: 30 },
});

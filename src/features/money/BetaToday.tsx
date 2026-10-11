/**
 * Today — the safe-to-spend home and the beta's daily loop (launch guide).
 *
 * The ring and rolling number show what is left today. Below it: yesterday's
 * result with one tap to put an underspend toward a goal, the last seven days,
 * and the goal. A quiet strip shows the next income and the bank's freshness,
 * and "This cycle" shows the math behind the number, using only the money
 * engine's figures. Over days stay calm: no red or amber, ever. "I spent" logs
 * a purchase with the same retry protection as before.
 */

import React, { useCallback, useRef, useState } from "react";
import {
  Alert,
  Animated,
  AppState,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextStyle,
  View,
  ViewStyle,
} from "react-native";
import { useFocusEffect, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import Svg, { Circle } from "react-native-svg";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";

import { CountUp, FadeInUp, Shimmer, useEntranceProgress, useFocusReplay } from "@/animations";
import { Icon, type IconName } from "@/components/Icon";
import { Colors } from "@/constants/colors";
import { TAB_BAR_HEIGHT } from "@/constants/tokens";
import { useUser } from "@/hooks/useAuth";
import type { Goal } from "@/mock/goals";
import { eventsService } from "@/services/eventsService";
import { goalsService } from "@/services/goalsService";
import { moneyService, type MoneySpending, type MoneyToday, type MoneyProfile } from "@/services/moneyService";
import { MoneySetup } from "./MoneySetup";
import { GoalBar, WeekDots, YesterdayCard } from "./TodayLoop";
import { cycleBreakdown, type BreakdownPart } from "./breakdown";
import { dollarsToCents, money } from "./input";

type TodayResult = MoneyToday["result"];

const RING_SIZE = 260;
const RING_RADIUS = 116;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const wholeDollars = (value: number) => `$${Math.round(value).toLocaleString("en-US")}`;
// Whole-dollar amounts (the morning number always is) drop the ".00".
const dollars = (cents: number) => (cents % 100 === 0 ? wholeDollars(cents / 100) : money(cents));
// "2026-11-01" → "Nov 1" (parsed at local noon so the day never shifts).
const shortDate = (isoDay: string) => new Date(`${isoDay}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });

// Static colors only: the bar's size animates, never its colors. The owner
// preferred the warm spending tone in this breakdown; it stays a soft honey
// (not alarm amber), and red never appears on Today.
const PARTS: Record<BreakdownPart["key"], { label: string; color: string }> = {
  bills: { label: "Bills set aside", color: Colors.navy300 },
  goals: { label: "Goals", color: "#00B4A6" },
  buffer: { label: "10% buffer", color: Colors.accentAlpha35 },
  spent: { label: "Spent so far", color: "#F2A93B" },
  left: { label: "Left this cycle", color: Colors.gold },
};

// Oldest first: the goal from onboarding. Goals that auto-track a savings
// account count real transfers, so a virtual move could count twice; they
// never get "Put $X toward".
function loopGoals(goals: Goal[]) {
  const byAge = [...goals].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const moveGoal = byAge.find((goal) => !goal.linkedAccountId);
  return { moveGoal, focusGoal: moveGoal ?? byAge[0] };
}

function setupRequired(error: unknown) {
  return isAxiosError(error) && error.response?.data?.error?.code === "money_setup_required";
}

function bankStatus(data: MoneyToday): { value: string; sub: string } {
  if (data.bankState === "manual") return { value: "Manual", sub: "Plan and logged spending" };
  if (data.bankState === "reconnect_required") return { value: "Reconnect", sub: "Some spending may be missing" };
  if (data.bankState === "stale") return { value: "Delayed", sub: "Some spending may be missing" };
  if (!data.lastSyncAt) return { value: "Waiting", sub: "First bank update pending" };
  const synced = new Date(data.lastSyncAt);
  const sameDay = synced.toDateString() === new Date().toDateString();
  const time = synced.toLocaleString(undefined, sameDay
    ? { hour: "numeric", minute: "2-digit" }
    : { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  return { value: "Up to date", sub: `Updated ${time}` };
}

export function BetaToday() {
  const user = useUser();
  const insets = useSafeAreaInsets();
  const client = useQueryClient();
  const queryKey = ["money", user?.id, "today"];
  const query = useQuery({ queryKey, queryFn: moneyService.today, enabled: Boolean(user), retry: (count, error) => !setupRequired(error) && count < 1, staleTime: 15_000 });
  const { refetch } = query;
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
  const goalsQuery = useQuery({ queryKey: ["goals", user?.id, "today"], queryFn: goalsService.list, enabled: Boolean(user), staleTime: 60_000 });
  const [moving, setMoving] = useState(false);
  const [moveMessage, setMoveMessage] = useState("");
  const [reported, setReported] = useState(false);
  const scroller = useRef<ScrollView>(null);
  const cycleY = useRef(0);

  // "Put $X toward goal": the server moves exactly the amount Today showed, once.
  const moveYesterday = async (goal: Goal, cents: number) => {
    if (moving) return;
    eventsService.log("goal_move_tap", { amountCents: cents });
    setMoving(true); setMoveMessage("");
    try {
      await moneyService.allocateYesterday(goal.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await Promise.all([refetch(), client.invalidateQueries({ queryKey: ["goals"] })]);
    } catch (error) {
      setMoveMessage(isAxiosError(error) && error.response?.status === 409 ? "Nothing left to move from yesterday." : "Couldn't move it. Please try again.");
      void refetch();
    } finally { setMoving(false); }
  };
  // Tapping the number (or "Why $X?") shows the math behind it.
  const showWhy = () => {
    eventsService.log("number_tap");
    Haptics.selectionAsync();
    scroller.current?.scrollTo({ y: Math.max(0, cycleY.current - 12), animated: true });
  };
  const reportNumber = (result: TodayResult) => {
    Alert.alert("Report today's number?", "We'll check the math behind it. Nothing in your plan changes.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Report",
        onPress: () => {
          eventsService.log("number_report", { date: result.inputs.date, displayDollars: result.displayDollars });
          setReported(true);
        },
      },
    ]);
  };

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
  // Ring, number, and bar re-enter each time Today regains focus (static under Reduce Motion).
  const replay = useFocusReplay();
  const ring = useEntranceProgress(ratio, { replayKey: replay, duration: 700 });
  const ringOffset = ring.interpolate({ inputRange: [0, 1], outputRange: [RING_LENGTH, 0] });
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const showContent = Boolean(data && result && !editProfile);
  const goals = goalsQuery.data?.goals ?? [];
  const { moveGoal, focusGoal } = loopGoals(goals);
  const movedGoalName = goals.find((goal) => goal.id === data?.yesterday?.goalId)?.name;

  return (
    <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <LinearGradient pointerEvents="none" colors={[Colors.accentAlpha14, Colors.accentAlpha05, "transparent"]} style={styles.glow} />
      <ScrollView
        ref={scroller}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 20, paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 24 }]}
        refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => void refetch()} tintColor={Colors.navy} />}
      >
        <View style={styles.header}>
          <Text style={styles.greeting} accessibilityRole="header" maxFontSizeMultiplier={1.3}>
            {greeting}, {user?.firstName ?? "there"}.
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open profile"
            hitSlop={6}
            onPress={() => router.push("/profile")}
            style={({ pressed }) => [styles.avatar, pressed && styles.pressed]}
          >
            <Text style={styles.avatarText}>{(user?.firstName ?? "?").slice(0, 1).toUpperCase()}</Text>
          </Pressable>
        </View>
        <Text style={styles.subtitle}>
          {new Date().toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })} · A little clarity for today.
        </Text>

        {query.isPending && <LoadingHero />}
        {setupRequired(query.error) && <MoneySetup onSaved={async () => { await refetch(); }} />}
        {!!query.error && !setupRequired(query.error) && (
          <View style={styles.card}>
            <View style={styles.noticeTop}>
              <View style={styles.noticeTile}>
                <Icon name="alert-circle" size={16} color={Colors.navyMuted} strokeWidth={2.4} />
              </View>
              <Text style={styles.noticeTitle}>{data ? "Showing your last number" : "Couldn't load today"}</Text>
            </View>
            <Text accessibilityRole="alert" style={styles.body}>
              {data ? "Couldn't refresh, so new spending may be missing." : "Check your connection and try again."}
            </Text>
            <Button title="Try again" secondary onPress={() => void refetch()} />
          </View>
        )}
        {!showContent && !!actionMessage && <Text accessibilityRole="alert" style={styles.note}>{actionMessage}</Text>}
        {editProfile && <MoneySetup initialProfile={editProfile} onCancel={() => setEditProfile(null)} onSaved={async () => { setEditProfile(null); await refetch(); }} />}

        {showContent && data && result && (
          <>
            <FadeInUp>
              <Hero result={result} replay={replay} ringOffset={ringOffset} onWhy={showWhy} />
            </FadeInUp>

            {data.yesterday ? (
              <FadeInUp delay={60}>
                <YesterdayCard
                  yesterday={data.yesterday}
                  goal={moveGoal}
                  movedGoalName={movedGoalName}
                  moving={moving}
                  message={moveMessage}
                  onMove={(goal, cents) => void moveYesterday(goal, cents)}
                />
              </FadeInUp>
            ) : null}

            {data.recentDays ? (
              <FadeInUp delay={100}>
                <WeekDots today={result.inputs.date} days={data.recentDays} />
              </FadeInUp>
            ) : null}

            {focusGoal ? (
              <FadeInUp delay={140}>
                <GoalBar goal={focusGoal} replayKey={replay} />
              </FadeInUp>
            ) : null}

            <FadeInUp delay={180}>
              <StatusStrip data={data} result={result} />
            </FadeInUp>

            <FadeInUp delay={220} style={styles.actions}>
              {data.bankState === "reconnect_required" && (
                <Button title="Reconnect bank" secondary onPress={() => router.push("/(tabs)/budget")} />
              )}
              {/* The main input before a bank is linked; afterwards a quiet button for cash. */}
              <Button
                title="I spent"
                secondary={data.bankState !== "manual"}
                disabled={recalculating || loadingPlan}
                onPress={() => {
                  Haptics.selectionAsync();
                  setShowSpending(true);
                }}
              />
              <View style={styles.actionsRow}>
                <Button
                  title={recalculating ? "Recalculating…" : "Recalculate"}
                  accessibilityLabel="Recalculate safe to spend"
                  secondary
                  disabled={recalculating}
                  onPress={() => void recalculate()}
                  style={styles.half}
                />
                <Button
                  title={loadingPlan ? "Loading…" : "Edit plan"}
                  accessibilityLabel="Edit income and plan"
                  secondary
                  disabled={loadingPlan || recalculating}
                  onPress={() => void editPlan()}
                  style={styles.half}
                />
              </View>
              {!!actionMessage && <Text accessibilityRole="alert" style={styles.note}>{actionMessage}</Text>}
            </FadeInUp>

            <View onLayout={(event) => { cycleY.current = event.nativeEvent.layout.y; }}>
              <FadeInUp delay={260}>
                <CycleCard result={result} replay={replay} reported={reported} onReport={() => reportNumber(result)} />
              </FadeInUp>
            </View>
          </>
        )}
      </ScrollView>

      <Modal visible={showSpending} animationType="slide" transparent onRequestClose={() => { if (!saving) setShowSpending(false); }}>
        <KeyboardAvoidingView style={styles.scrim} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 24 }]}>
            <Text style={styles.sheetTitle} accessibilityRole="header">I spent</Text>
            <Text style={styles.body}>
              {cash
                ? "Cash stays logged as you enter it. Bank transactions never replace it."
                : "Log a purchase now. Matching bank transactions replace this entry automatically."}
            </Text>
            <View style={styles.amountRow}>
              <Text style={styles.amountPrefix}>$</Text>
              <TextInput
                accessibilityLabel="Amount spent in dollars"
                placeholder="0.00"
                placeholderTextColor={Colors.muted}
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                autoFocus
                maxLength={12}
                editable={!saving && !pendingSpend.current}
                style={styles.amountInput}
              />
            </View>
            <View style={styles.segment} accessibilityRole="radiogroup">
              <SegmentOption label="Card or bank" selected={!cash} disabled={saving || Boolean(pendingSpend.current)} onPress={() => setCash(false)} />
              <SegmentOption label="Cash" selected={cash} disabled={saving || Boolean(pendingSpend.current)} onPress={() => setCash(true)} />
            </View>
            {!!spendError && <Text accessibilityRole="alert" style={styles.sheetError}>{spendError}</Text>}
            <Button title={saving ? "Saving…" : pendingSpend.current ? "Retry this entry" : "Save spending"} disabled={saving} onPress={() => void spend()} />
            <Button title="Close" secondary disabled={saving} onPress={() => setShowSpending(false)} />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </KeyboardAvoidingView>
  );
}

// ─── Hero ───────────────────────────────────────────────────────────────────

function Hero({ result, replay, ringOffset, onWhy }: { result: TodayResult; replay: number; ringOffset: Animated.AnimatedInterpolation<number>; onWhy: () => void }) {
  const spentToday = result.inputs.spentTodayCents;
  const over = result.overCents;
  // Over days look almost like normal days: neutral ring, "handled" copy.
  const pill: { icon: IconName; text: string } = over > 0
    ? { icon: "activity", text: `${dollars(over)} over. We'll spread it out.` }
    : spentToday > 0
      ? { icon: "receipt", text: `${money(spentToday)} spent today` }
      : spentToday < 0
        ? { icon: "arrow-down-right", text: `${money(-spentToday)} back from refunds today` }
        : { icon: "check-circle", text: "Nothing spent yet today" };

  return (
    <View style={styles.heroWrap}>
      <Pressable
        style={({ pressed }) => [styles.hero, pressed && styles.pressed]}
        onPress={onWhy}
        accessibilityRole="button"
        accessibilityLabel={`${money(result.remainingCents)} safe to spend today, of ${dollars(result.morningCents)} this morning.`}
        accessibilityHint="Shows how today's number is made"
      >
        <Svg width={RING_SIZE} height={RING_SIZE} viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`} accessible={false}>
          <Circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RING_RADIUS} stroke={over > 0 ? Colors.navy100 : Colors.accentAlpha12} strokeWidth={10} fill="none" />
          <AnimatedCircle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_RADIUS}
            stroke={Colors.gold}
            strokeWidth={10}
            fill="none"
            strokeDasharray={`${RING_LENGTH}`}
            strokeDashoffset={ringOffset}
            strokeLinecap="round"
            rotation={-90}
            origin={`${RING_SIZE / 2},${RING_SIZE / 2}`}
          />
        </Svg>
        {/* Text inside the fixed ring grows only so far; VoiceOver reads the full label above. */}
        <View pointerEvents="none" style={styles.heroText}>
          <Text style={styles.heroLabel} numberOfLines={1} adjustsFontSizeToFit maxFontSizeMultiplier={1.2}>
            SAFE TO SPEND TODAY
          </Text>
          <CountUp
            value={result.displayDollars}
            from={Math.floor(result.displayDollars * 0.85)}
            replayKey={replay}
            format={wholeDollars}
            fit
            maxFontSizeMultiplier={1.2}
            style={styles.amount}
          />
          <Text style={styles.heroLeft} maxFontSizeMultiplier={1.2}>left today</Text>
          <Text style={styles.heroMorning} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} maxFontSizeMultiplier={1.2}>
            of {dollars(result.morningCents)} this morning
          </Text>
        </View>
      </Pressable>
      <View style={styles.todayPill}>
        <Icon name={pill.icon} size={13} color={Colors.navyMuted} strokeWidth={2.4} />
        <Text style={styles.todayPillText}>{pill.text}</Text>
      </View>
      <Pressable accessibilityRole="button" hitSlop={8} onPress={onWhy} style={({ pressed }) => [styles.whyLink, pressed && styles.pressed]}>
        <Text style={styles.whyText}>Why {wholeDollars(result.displayDollars)}?</Text>
        <Icon name="chevron-down" size={14} color={Colors.navyMuted} strokeWidth={2.4} />
      </Pressable>
    </View>
  );
}

function LoadingHero() {
  return (
    <View style={styles.heroWrap} accessible accessibilityLabel="Calculating today's number">
      <Shimmer style={styles.ringSkeleton} radius={RING_SIZE / 2} />
      <Shimmer style={styles.pillSkeleton} radius={14} />
    </View>
  );
}

// ─── Next income + bank ─────────────────────────────────────────────────────

function StatusStrip({ data, result }: { data: MoneyToday; result: TodayResult }) {
  const bank = bankStatus(data);
  const reconnect = data.bankState === "reconnect_required";
  const income = result.waitingForIncome
    ? { value: "Due now", sub: "Waiting on your income" }
    : { value: shortDate(result.inputs.cycle.end), sub: `in ${result.daysLeft} ${result.daysLeft === 1 ? "day" : "days"}` };

  return (
    <View style={styles.strip}>
      <View style={styles.stripCell} accessible accessibilityLabel={`Next income ${income.value}, ${income.sub}`}>
        <Text style={styles.stripLabel}>Next income</Text>
        <Text style={styles.stripValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{income.value}</Text>
        <Text style={styles.stripSub}>{income.sub}</Text>
      </View>
      <View style={styles.stripDivider} />
      <Pressable
        disabled={!reconnect}
        accessibilityRole={reconnect ? "button" : undefined}
        accessibilityLabel={`Bank ${bank.value}, ${bank.sub}${reconnect ? ". Opens Budget to reconnect." : ""}`}
        onPress={() => router.push("/(tabs)/budget")}
        style={({ pressed }) => [styles.stripCell, pressed && styles.pressed]}
      >
        <Text style={styles.stripLabel}>Bank</Text>
        <Text style={styles.stripValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
          {bank.value}
        </Text>
        <Text style={styles.stripSub}>{bank.sub}</Text>
      </Pressable>
    </View>
  );
}

// ─── This cycle ─────────────────────────────────────────────────────────────

function CycleCard({ result, replay, reported, onReport }: { result: TodayResult; replay: number; reported: boolean; onReport: () => void }) {
  const breakdown = cycleBreakdown(result);
  const { cycle } = result.inputs;
  // The whole bar grows in from the left; its segments keep exact proportions.
  const grow = useEntranceProgress(1, { replayKey: replay, delay: 150, duration: 800 });
  const width = grow.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] });
  const visible = breakdown.parts.filter((part) => part.cents > 0);
  const spokenParts = breakdown.parts.map((part) => `${PARTS[part.key].label} ${money(part.cents)}`).join(", ");

  // Calm copy for every state: handled, never punished (launch guide).
  const explanation = breakdown.overCents > 0
    ? "$0 until your next income. Your bills are still set aside."
    : result.overCents > 0
      ? `${dollars(result.overCents)} over today. We'll spread it across the days left in your cycle.`
      : `Each morning, what's left is spread over the days until your next income and rounded down to whole dollars. This morning that was ${dollars(result.morningCents)}.`;

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <Text style={styles.cardEyebrow}>THIS CYCLE</Text>
        <Text style={styles.cardMeta}>{shortDate(cycle.start)} – {shortDate(cycle.end)}</Text>
      </View>
      <Text style={styles.cycleIncome}>
        {dollars(cycle.incomeCents)} <Text style={styles.cycleIncomeLabel}>income</Text>
      </Text>

      {breakdown.totalCents > 0 ? (
        <View style={styles.barTrack} accessible accessibilityRole="image" accessibilityLabel={`This cycle: ${spokenParts}.`}>
          <Animated.View style={[styles.barFill, { width }]}>
            {visible.map((part) => (
              <View
                key={part.key}
                style={[styles.barPart, { flex: part.cents / breakdown.totalCents, backgroundColor: PARTS[part.key].color }]}
              />
            ))}
          </Animated.View>
        </View>
      ) : null}

      <View style={styles.legend}>
        {breakdown.parts.map((part) => {
          const strong = part.key === "left";
          return (
            <View key={part.key} style={styles.legendRow}>
              <View style={[styles.legendDot, { backgroundColor: PARTS[part.key].color }]} />
              <Text style={[styles.legendLabel, strong && styles.legendStrong]}>{PARTS[part.key].label}</Text>
              <MutedCents cents={part.cents} style={[styles.legendValue, strong && styles.legendStrong]} />
            </View>
          );
        })}
      </View>

      <Text style={styles.body}>{explanation}</Text>

      {reported ? (
        <Text accessibilityRole="alert" style={styles.reportDone}>Thanks. We'll check the math behind today's number.</Text>
      ) : (
        <Pressable accessibilityRole="button" hitSlop={8} onPress={onReport} style={({ pressed }) => [styles.reportLink, pressed && styles.pressed]}>
          <Icon name="alert-circle" size={13} color={Colors.muted} strokeWidth={2.4} />
          <Text style={styles.reportText}>This number looks wrong</Text>
        </Pressable>
      )}
    </View>
  );
}

// Cents sit quieter than dollars, as in Budget and Transactions.
function MutedCents({ cents, style }: { cents: number; style: StyleProp<TextStyle> }) {
  const text = money(cents);
  const match = /^(.*)(\.\d{2})$/.exec(text);
  return (
    <Text style={style}>
      {match ? match[1] : text}
      {match ? <Text style={styles.cents}>{match[2]}</Text> : null}
    </Text>
  );
}

// ─── Controls ───────────────────────────────────────────────────────────────

function SegmentOption({ label, selected, disabled, onPress }: { label: string; selected: boolean; disabled: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.segmentOption, selected && styles.segmentOptionActive]}
    >
      <Text style={[styles.segmentText, selected && styles.segmentTextActive]}>{label}</Text>
    </Pressable>
  );
}

function Button({ title, onPress, secondary, disabled, accessibilityLabel, style }: { title: string; onPress: () => void; secondary?: boolean; disabled?: boolean; accessibilityLabel?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.button, secondary && styles.secondary, style, disabled && { opacity: 0.5 }, pressed && !disabled && { opacity: 0.8 }]}
    >
      <Text style={[styles.buttonText, secondary && styles.secondaryText]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
        {title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: Colors.surface },
  glow: { position: "absolute", top: 0, left: 0, right: 0, height: 420 },
  content: { paddingHorizontal: 20, gap: 14 },
  pressed: { opacity: 0.7 },

  // Header
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  greeting: { color: Colors.navy, fontSize: 26, lineHeight: 32, fontWeight: "800", letterSpacing: -0.4, flex: 1 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: Colors.card, borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border },
  avatarText: { color: Colors.navy, fontSize: 16, fontWeight: "800" },
  subtitle: { color: Colors.muted, fontSize: 15, marginTop: -6, marginBottom: 4 },

  // Hero
  heroWrap: { alignItems: "center", gap: 12, paddingVertical: 4 },
  hero: { alignItems: "center", justifyContent: "center", width: RING_SIZE, height: RING_SIZE },
  heroText: { position: "absolute", width: 180, alignItems: "center", gap: 4 },
  heroLabel: { color: Colors.muted, fontSize: 10, fontWeight: "800", letterSpacing: 1.6 },
  amount: { alignSelf: "stretch", textAlign: "center", color: Colors.navy, fontSize: 64, fontWeight: "700", letterSpacing: -2 },
  heroLeft: { color: Colors.navy, fontSize: 15, fontWeight: "600" },
  heroMorning: { color: Colors.muted, fontSize: 12, fontWeight: "500" },
  todayPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 32,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: Colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  todayPillText: { fontSize: 13, fontWeight: "700", color: Colors.navy, fontVariant: ["tabular-nums"] },
  whyLink: { flexDirection: "row", alignItems: "center", gap: 4, minHeight: 32, paddingHorizontal: 10, marginTop: -4 },
  whyText: { fontSize: 14, fontWeight: "700", color: Colors.navyMuted },
  ringSkeleton: { width: 220, height: 220, marginVertical: 20 },
  pillSkeleton: { width: 150, height: 28 },

  // Quiet strip (matches Profile and the Goals summary row)
  strip: {
    flexDirection: "row",
    padding: 16,
    borderRadius: 22,
    backgroundColor: Colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  stripCell: { flex: 1, minWidth: 0, paddingHorizontal: 6 },
  stripDivider: { width: StyleSheet.hairlineWidth, marginHorizontal: 8, backgroundColor: Colors.border },
  stripLabel: { marginBottom: 6, fontSize: 10, fontWeight: "700", letterSpacing: 1.1, textTransform: "uppercase", color: Colors.muted },
  stripValue: { fontSize: 20, fontWeight: "800", color: Colors.navy },
  stripSub: { marginTop: 3, fontSize: 12, color: Colors.muted },

  // Actions
  actions: { gap: 10 },
  actionsRow: { flexDirection: "row", gap: 10 },
  half: { flex: 1 },
  note: { color: Colors.navyMuted, fontSize: 13, lineHeight: 19, textAlign: "center" },
  button: { minHeight: 52, paddingHorizontal: 16, justifyContent: "center", borderRadius: 18, alignItems: "center", backgroundColor: Colors.gold },
  secondary: { backgroundColor: Colors.card, borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border },
  buttonText: { color: Colors.onAccent, fontSize: 16, fontWeight: "700" },
  secondaryText: { color: Colors.navy, fontSize: 15 },

  // Cards
  card: { padding: 18, gap: 12, backgroundColor: Colors.card, borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardEyebrow: { fontSize: 10, fontWeight: "800", letterSpacing: 1.6, color: Colors.muted },
  cardMeta: { fontSize: 12, fontWeight: "600", color: Colors.muted },
  body: { color: Colors.navyMuted, fontSize: 14, lineHeight: 21 },
  reportLink: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", minHeight: 32 },
  reportText: { fontSize: 13, fontWeight: "600", color: Colors.muted },
  reportDone: { fontSize: 13, color: Colors.navyMuted },
  noticeTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  noticeTile: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: Colors.navy50 },
  noticeTitle: { flex: 1, fontSize: 16, fontWeight: "800", color: Colors.navy },

  // This cycle
  cycleIncome: { marginTop: -4, fontSize: 24, fontWeight: "800", letterSpacing: -0.5, color: Colors.navy, fontVariant: ["tabular-nums"] },
  cycleIncomeLabel: { fontSize: 14, fontWeight: "600", letterSpacing: 0, color: Colors.muted },
  barTrack: { height: 12, borderRadius: 6, overflow: "hidden", backgroundColor: Colors.navy50 },
  barFill: { height: "100%", flexDirection: "row", gap: 2 },
  barPart: { height: "100%", borderRadius: 3 },
  legend: { gap: 9 },
  legendRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  legendDot: { width: 9, height: 9, borderRadius: 5 },
  legendLabel: { flex: 1, fontSize: 14, fontWeight: "500", color: Colors.navyMuted },
  legendValue: { fontSize: 14, fontWeight: "700", color: Colors.navy, fontVariant: ["tabular-nums"] },
  legendStrong: { color: Colors.navy, fontWeight: "800" },
  cents: { color: Colors.muted, fontWeight: "600" },

  // "I spent" sheet
  scrim: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.35)" },
  sheet: { padding: 24, gap: 16, backgroundColor: Colors.card, borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  sheetTitle: { color: Colors.navy, fontSize: 22, fontWeight: "800", letterSpacing: -0.3 },
  amountRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: Colors.navy50,
  },
  amountPrefix: { fontSize: 34, fontWeight: "700", color: Colors.muted },
  amountInput: { minWidth: 120, paddingVertical: 8, fontSize: 40, fontWeight: "800", color: Colors.navy, fontVariant: ["tabular-nums"] },
  segment: { flexDirection: "row", padding: 3, borderRadius: 999, backgroundColor: Colors.navy50 },
  segmentOption: { flex: 1, minHeight: 40, alignItems: "center", justifyContent: "center", borderRadius: 999 },
  segmentOptionActive: { backgroundColor: Colors.card, borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border },
  segmentText: { fontSize: 14, fontWeight: "600", color: Colors.muted },
  segmentTextActive: { color: Colors.navy, fontWeight: "700" },
  sheetError: { color: Colors.navy, fontSize: 14, fontWeight: "600", lineHeight: 20 },
});

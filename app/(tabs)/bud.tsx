/**
 * Bud — a calm conversation surface.
 *
 * Home: greeting, this week's insight (rule-based from synced spending),
 * conversation starters, and a composer. Starting a conversation cross-fades
 * into the thread. While Bud's AI is still being built, replies come from
 * features/bud/conversation and say where each answer comes from.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";

import { FadeInUp, RevealWords, useFocusReplay, useReducedMotion } from "@/animations";
import { BrandLogo } from "@/components/BrandLogo";
import { Icon, type IconName } from "@/components/Icon";
import { Colors } from "@/constants/colors";
import { Motion, Radius, Shadow, Spacing, TAB_BAR_HEIGHT, Type } from "@/constants/tokens";
import {
  replyTo,
  startersFor,
  type BudReply,
  type Starter,
  type StarterId,
} from "@/features/bud/conversation";
import { BudOrb } from "@/features/onboarding/components/BudOrb";
import { useUser } from "@/hooks/useAuth";
import type { BudInsight } from "@/mock/bud";
import type { Goal } from "@/mock/goals";
import { goalsService } from "@/services/goalsService";
import { todayService } from "@/services/todayService";
import { secureLog } from "@/utils/security";

type Message =
  | { id: string; role: "user"; text: string }
  | { id: string; role: "bud"; reply: BudReply };

const COMING_SOON: { icon: IconName; title: string; body: string }[] = [
  { icon: "layers", title: "Lessons", body: "Short guides like the 50/30/20 rule." },
  { icon: "bar-chart", title: "Weekly review", body: "A Sunday recap of your week." },
  { icon: "line-chart", title: "Scenarios", body: "What-if math for bigger decisions." },
];

export default function BudScreen() {
  const insets = useSafeAreaInsets();
  const user = useUser();
  const reduced = useReducedMotion();
  const replay = useFocusReplay();

  const [mode, setMode] = useState<"home" | "chat">("home");
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [thinking, setThinking] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [insight, setInsight] = useState<BudInsight | null>(null);
  const [goal, setGoal] = useState<Goal | null>(null);

  const progress = useRef(new Animated.Value(0)).current;
  const threadRef = useRef<ScrollView>(null);
  const replyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    todayService
      .getInsight()
      .then(setInsight)
      .catch((error) => secureLog.warn("bud.insight failed", error));
    goalsService
      .list()
      .then(({ goals }) => setGoal(goals[0] ?? null))
      .catch((error) => secureLog.warn("bud.goals failed", error));
  }, []);

  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      () => setKeyboardOpen(true)
    );
    const hide = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => setKeyboardOpen(false)
    );
    return () => {
      show.remove();
      hide.remove();
      if (replyTimer.current) clearTimeout(replyTimer.current);
    };
  }, []);

  const showChat = useCallback(
    (open: boolean) => {
      setMode(open ? "chat" : "home");
      const toValue = open ? 1 : 0;
      if (reduced) {
        progress.setValue(toValue);
        return;
      }
      Animated.timing(progress, {
        toValue,
        duration: Motion.slow + 60,
        easing: Easing.bezier(0.22, 1, 0.36, 1),
        useNativeDriver: true,
      }).start();
    },
    [progress, reduced]
  );

  const send = (text: string, starterId?: StarterId) => {
    const trimmed = text.trim();
    if (!trimmed || thinking) return;
    Haptics.selectionAsync();
    showChat(true);
    setDraft("");
    setMessages((current) => [...current, { id: `u-${Date.now()}`, role: "user", text: trimmed }]);
    setThinking(true);
    replyTimer.current = setTimeout(() => {
      const reply = replyTo(trimmed, goal, starterId);
      setMessages((current) => [...current, { id: `b-${Date.now()}`, role: "bud", reply }]);
      setThinking(false);
      AccessibilityInfo.announceForAccessibility(reply.text);
    }, reduced ? 300 : 900);
  };

  const closeChat = () => {
    Keyboard.dismiss();
    showChat(false);
  };

  const starters = startersFor(goal);
  const onStarter = (starter: Starter) => send(starter.prompt, starter.id);

  const homeStyle = {
    opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
    transform: [
      { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [0, -16] }) },
      { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0.98] }) },
    ],
  };
  const chatStyle = {
    opacity: progress,
    transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
  };

  return (
    <View style={styles.page}>
      <LinearGradient
        pointerEvents="none"
        colors={[Colors.accentAlpha14, Colors.accentAlpha05, "transparent"]}
        style={styles.glow}
      />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.flex}>
          <Animated.View
            pointerEvents={mode === "home" ? "auto" : "none"}
            accessibilityElementsHidden={mode !== "home"}
            importantForAccessibility={mode === "home" ? "auto" : "no-hide-descendants"}
            style={[StyleSheet.absoluteFill, homeStyle]}
          >
            <ScrollView
              contentContainerStyle={[styles.homeContent, { paddingTop: insets.top + 12 }]}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.topBar}>
                <BrandLogo variant="mark" markSize={30} />
                <Text style={styles.topTitle}>Bud</Text>
                <View style={styles.previewChip}>
                  <Text style={styles.previewText}>Preview</Text>
                </View>
              </View>

              <Text style={styles.hello}>Hi {user?.firstName ?? "there"},</Text>
              <RevealWords
                text="What should we look at today?"
                style={styles.headline}
                replayKey={replay}
                delay={120}
                maxFontSizeMultiplier={1.3}
              />
              {user?.why ? (
                <Text style={styles.why} numberOfLines={2}>
                  Your why: “{user.why}”
                </Text>
              ) : null}

              {insight ? (
                <FadeInUp delay={280}>
                  <View style={styles.insight}>
                    <View style={styles.insightTop}>
                      <Icon name="sparkles" size={13} color={Colors.gold} strokeWidth={2.4} />
                      <Text style={styles.eyebrow}>This week</Text>
                    </View>
                    <Text style={styles.insightText}>{insight.message}</Text>
                    <Text style={styles.caption}>From your synced spending</Text>
                  </View>
                </FadeInUp>
              ) : null}

              <Text style={[styles.eyebrow, styles.sectionLabel]}>Start a conversation</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.starterScroller}
                contentContainerStyle={styles.starterRow}
              >
                {starters.map((starter, index) => (
                  <FadeInUp key={starter.id} delay={340 + index * 70}>
                    <StarterCard starter={starter} onPress={() => onStarter(starter)} />
                  </FadeInUp>
                ))}
              </ScrollView>

              <View style={styles.comingSoon}>
                <Text style={styles.eyebrow}>Coming to Bud</Text>
                {COMING_SOON.map((item) => (
                  <View key={item.title} style={styles.soonRow}>
                    <View style={styles.soonIcon}>
                      <Icon name={item.icon} size={15} color={Colors.navyMuted} strokeWidth={2.2} />
                    </View>
                    <View style={styles.flex}>
                      <Text style={styles.soonTitle}>{item.title}</Text>
                      <Text style={styles.caption}>{item.body}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </ScrollView>
          </Animated.View>

          <Animated.View
            pointerEvents={mode === "chat" ? "auto" : "none"}
            accessibilityElementsHidden={mode !== "chat"}
            importantForAccessibility={mode === "chat" ? "auto" : "no-hide-descendants"}
            style={[StyleSheet.absoluteFill, chatStyle]}
          >
            <View style={[styles.threadTop, { paddingTop: insets.top + 8 }]}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close chat"
                hitSlop={8}
                onPress={closeChat}
                style={({ pressed }) => [styles.closePill, pressed && styles.pressed]}
              >
                <Icon name="x" size={14} color={Colors.navyMuted} strokeWidth={2.4} />
                <Text style={styles.closeText}>Close chat</Text>
              </Pressable>
            </View>
            <ScrollView
              ref={threadRef}
              contentContainerStyle={styles.threadContent}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
              onContentSizeChange={() => threadRef.current?.scrollToEnd({ animated: !reduced })}
            >
              <Text style={styles.disclaimer}>
                Bud is in preview. Answers are general guides, not financial advice.
              </Text>
              {messages.length === 0 && !thinking ? (
                <View style={styles.emptyThread}>
                  <BrandLogo variant="mark" markSize={36} />
                  <Text style={styles.emptyTitle}>
                    Ask about your goal, your budget, or a money basic.
                  </Text>
                  <StarterChips starters={starters} onStarter={onStarter} centered />
                </View>
              ) : null}
              {messages.map((message) =>
                message.role === "user" ? (
                  <FadeInUp key={message.id} distance={10} duration={Motion.base}>
                    <View style={styles.userBubble}>
                      <Text style={styles.userText}>{message.text}</Text>
                    </View>
                  </FadeInUp>
                ) : (
                  <FadeInUp key={message.id} distance={10}>
                    <BudReplyView reply={message.reply} starters={starters} onStarter={onStarter} />
                  </FadeInUp>
                )
              )}
              {thinking ? (
                <View style={styles.budRow} accessibilityLabel="Bud is thinking">
                  <BudOrb size={24} glow={false} />
                  <Text style={styles.thinking}>Bud is thinking…</Text>
                </View>
              ) : null}
            </ScrollView>
          </Animated.View>
        </View>

        <View
          style={[
            styles.composerWrap,
            { paddingBottom: keyboardOpen ? Spacing.sm : TAB_BAR_HEIGHT + insets.bottom + 8 },
          ]}
        >
          <View style={styles.composer}>
            <TextInput
              accessibilityLabel="Message Bud"
              placeholder="Ask Bud about your money…"
              placeholderTextColor={Colors.muted}
              value={draft}
              onChangeText={setDraft}
              onFocus={() => showChat(true)}
              onSubmitEditing={() => send(draft)}
              returnKeyType="send"
              submitBehavior="submit"
              maxLength={500}
              style={styles.input}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Send message"
              accessibilityState={{ disabled: !draft.trim() || thinking }}
              disabled={!draft.trim() || thinking}
              onPress={() => send(draft)}
              style={[styles.send, (!draft.trim() || thinking) && styles.sendDisabled]}
            >
              <Icon
                name="arrow-up"
                size={18}
                color={draft.trim() && !thinking ? Colors.onAccent : Colors.muted}
                strokeWidth={2.6}
              />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

function StarterCard({ starter, onPress }: { starter: Starter; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${starter.eyebrow}: ${starter.title}`}
      onPress={onPress}
      style={({ pressed }) => [styles.starter, pressed && styles.pressed]}
    >
      <View style={styles.starterIcon}>
        <Icon name={starter.icon} size={16} color={Colors.gold} strokeWidth={2.3} />
      </View>
      <View style={styles.starterCopy}>
        <Text style={styles.eyebrow}>{starter.eyebrow}</Text>
        <Text style={styles.starterTitle} numberOfLines={2}>
          {starter.title}
        </Text>
      </View>
    </Pressable>
  );
}

function StarterChips({
  starters,
  onStarter,
  centered = false,
}: {
  starters: Starter[];
  onStarter: (starter: Starter) => void;
  centered?: boolean;
}) {
  return (
    <View style={[styles.chips, centered && styles.chipsCentered]}>
      {starters.map((starter) => (
        <Pressable
          key={starter.id}
          accessibilityRole="button"
          onPress={() => onStarter(starter)}
          style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
        >
          <Text style={styles.chipText}>{starter.title}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function BudReplyView({
  reply,
  starters,
  onStarter,
}: {
  reply: BudReply;
  starters: Starter[];
  onStarter: (starter: Starter) => void;
}) {
  const action = reply.action;
  return (
    <View style={styles.budRow}>
      <BrandLogo variant="mark" markSize={24} />
      <View style={styles.budBody}>
        <Text style={styles.budText}>{reply.text}</Text>
        {reply.source ? <Text style={styles.caption}>{reply.source}</Text> : null}
        {action ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.navigate(action.route)}
            style={({ pressed }) => [styles.actionPill, pressed && styles.pressed]}
          >
            <Text style={styles.actionText}>{action.label}</Text>
            <Icon name="chevron-right" size={14} color={Colors.navy} strokeWidth={2.4} />
          </Pressable>
        ) : null}
        {reply.offerStarters ? <StarterChips starters={starters} onStarter={onStarter} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: Colors.surface },
  flex: { flex: 1 },
  glow: { position: "absolute", top: 0, left: 0, right: 0, height: 420 },
  pressed: { opacity: 0.7 },

  // Home
  homeContent: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl },
  topBar: { flexDirection: "row", alignItems: "center", gap: 10 },
  topTitle: { ...Type.h2, color: Colors.navy },
  previewChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
  },
  previewText: { ...Type.micro, color: Colors.muted, letterSpacing: 0.4 },
  hello: { marginTop: 32, fontSize: 17, fontWeight: "600", color: Colors.muted },
  headline: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: "800",
    letterSpacing: -0.8,
    color: Colors.navy,
  },
  why: { ...Type.body, marginTop: 10, color: Colors.navyMuted, fontStyle: "italic" },
  insight: {
    marginTop: Spacing.xl,
    padding: Spacing.md,
    gap: 8,
    borderRadius: Radius.xl,
    backgroundColor: Colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    ...Shadow.sm,
  },
  insightTop: { flexDirection: "row", alignItems: "center", gap: 6 },
  insightText: { fontSize: 15, lineHeight: 22, color: Colors.navy },
  eyebrow: { ...Type.eyebrow, fontSize: 10, color: Colors.muted },
  caption: { ...Type.caption, fontWeight: "500", color: Colors.muted },
  sectionLabel: { marginTop: 28, marginBottom: 12 },
  starterScroller: { marginHorizontal: -Spacing.lg },
  starterRow: { paddingHorizontal: Spacing.lg, gap: 12 },
  starter: {
    width: 168,
    minHeight: 132,
    padding: Spacing.md,
    justifyContent: "space-between",
    borderRadius: Radius.xl,
    backgroundColor: Colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    ...Shadow.sm,
  },
  starterIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.accentAlpha12,
  },
  starterCopy: { gap: 4, marginTop: Spacing.sm },
  starterTitle: { fontSize: 15, lineHeight: 20, fontWeight: "700", color: Colors.navy },
  comingSoon: {
    marginTop: 28,
    padding: Spacing.md,
    gap: Spacing.sm,
    borderRadius: Radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  soonRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  soonIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.navy50,
  },
  soonTitle: { ...Type.bodyStrong, color: Colors.navy },

  // Thread
  threadTop: { alignItems: "center", paddingBottom: Spacing.sm },
  closePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 36,
    paddingHorizontal: 14,
    borderRadius: Radius.pill,
    backgroundColor: Colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    ...Shadow.sm,
  },
  closeText: { ...Type.caption, color: Colors.navy },
  threadContent: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md, gap: 18 },
  disclaimer: { ...Type.caption, fontWeight: "500", color: Colors.muted, textAlign: "center" },
  emptyThread: { alignItems: "center", gap: Spacing.sm, marginTop: Spacing.xl },
  emptyTitle: { ...Type.h3, color: Colors.navy, textAlign: "center", maxWidth: 260 },
  userBubble: {
    alignSelf: "flex-end",
    maxWidth: "82%",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderBottomRightRadius: 6,
    backgroundColor: Colors.greenSurfaceStrong,
  },
  userText: { fontSize: 15, lineHeight: 21, color: Colors.navy },
  budRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  budBody: { flex: 1, gap: 8 },
  budText: { fontSize: 15, lineHeight: 22, color: Colors.navy },
  thinking: { ...Type.body, color: Colors.muted, alignSelf: "center" },
  actionPill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: Radius.pill,
    backgroundColor: Colors.greenSurface,
    borderWidth: 1,
    borderColor: Colors.greenBorder,
  },
  actionText: { ...Type.caption, color: Colors.navy },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chipsCentered: { justifyContent: "center" },
  chip: {
    minHeight: 36,
    justifyContent: "center",
    paddingHorizontal: 12,
    borderRadius: Radius.pill,
    backgroundColor: Colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  chipText: { ...Type.caption, color: Colors.navy },

  // Composer
  composerWrap: { paddingHorizontal: Spacing.md, paddingTop: Spacing.xs },
  composer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 52,
    paddingLeft: 18,
    paddingRight: 6,
    borderRadius: 26,
    backgroundColor: Colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    ...Shadow.md,
  },
  input: { flex: 1, minHeight: 44, fontSize: 16, color: Colors.navy },
  send: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.gold,
  },
  sendDisabled: { backgroundColor: Colors.navy50 },
});

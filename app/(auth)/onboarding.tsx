import React, { useState, useRef } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Dimensions,
  ScrollView,
  TextInput,
  Animated,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "@/constants/colors";
import { useUser, useAuthActions } from "@/hooks/useAuth";
import * as Haptics from "expo-haptics";

const TOTAL_STEPS = 5;

const GOALS = [
  { id: "emergency", emoji: "🛡️", label: "Build an emergency fund", sub: "3–6 months of protection" },
  { id: "debt", emoji: "⚔️", label: "Pay off debt", sub: "Break free from what's holding you back" },
  { id: "overspend", emoji: "🎯", label: "Stop overspending", sub: "Build real awareness of where it goes" },
  { id: "save", emoji: "✈️", label: "Save for something specific", sub: "Travel, car, home, whatever matters" },
  { id: "invest", emoji: "📈", label: "Start investing", sub: "Make your money work for you" },
  { id: "other", emoji: "✍️", label: "Something else", sub: "Tell Bud what you're working toward" },
];

const WHY_OPTIONS = [
  { id: "freedom", emoji: "🔓", label: "Financial freedom", sub: "Stop stressing about money" },
  { id: "family", emoji: "❤️", label: "Retire my parents", sub: "Give back to those who sacrificed" },
  { id: "wealth", emoji: "📈", label: "Build wealth young", sub: "Start now, win later" },
  { id: "debt", emoji: "⚔️", label: "Destroy my debt", sub: "Break free from what holds me back" },
  { id: "dream", emoji: "✈️", label: "Fund my dream life", sub: "Travel, experiences, the life I want" },
  { id: "legacy", emoji: "🏛️", label: "Leave a legacy", sub: "Build something that outlasts me" },
];

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const user = useUser();
  const { setOnboardingComplete, updateUser } = useAuthActions();

  const [step, setStep] = useState(0);
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const [selectedWhy, setSelectedWhy] = useState<string | null>(null);
  const [customWhy, setCustomWhy] = useState("");

  // Progress bar — useNativeDriver: false because we animate width (layout prop)
  const progressAnim = useRef(new Animated.Value(0)).current;

  const goToStep = (next: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.timing(progressAnim, {
      toValue: next / (TOTAL_STEPS - 1),
      duration: 400,
      useNativeDriver: false, // width is a layout property — native driver not supported
    }).start();
    setStep(next);
  };

  const toggleGoal = (id: string) => {
    Haptics.selectionAsync();
    setSelectedGoals((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id].slice(0, 3)
    );
  };

  const handleFinish = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const why =
      selectedWhy === "other"
        ? customWhy
        : WHY_OPTIONS.find((w) => w.id === selectedWhy)?.label ?? "";
    const whyEmoji = WHY_OPTIONS.find((w) => w.id === selectedWhy)?.emoji ?? "✨";
    updateUser({ why, whyEmoji });
    await setOnboardingComplete();
    router.replace("/(tabs)/today");
  };

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  const steps = [
    <StepWelcome key="welcome" name={user?.firstName ?? "there"} onNext={() => goToStep(1)} />,
    <StepGoals key="goals" goals={GOALS} selected={selectedGoals} onToggle={toggleGoal} onNext={() => goToStep(2)} onBack={() => goToStep(0)} />,
    <StepWhy key="why" options={WHY_OPTIONS} selected={selectedWhy} customWhy={customWhy} onSelect={setSelectedWhy} onCustom={setCustomWhy} onNext={() => goToStep(3)} onBack={() => goToStep(1)} />,
    <StepStreak key="streak" onNext={() => goToStep(4)} onBack={() => goToStep(2)} />,
    <StepReady key="ready" name={user?.firstName ?? "there"} onFinish={handleFinish} onBack={() => goToStep(3)} />,
  ];

  return (
    <LinearGradient colors={["#0E1926", "#1B2B4B"]} style={{ flex: 1 }}>
      {/* Progress bar */}
      <View style={[styles.progressContainer, { paddingTop: insets.top + 16 }]}>
        <Text style={styles.stepLabel}>{step + 1} of {TOTAL_STEPS}</Text>
        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
        </View>
      </View>

      <View style={[styles.stepContainer, { paddingBottom: insets.bottom + 24 }]}>
        {steps[step]}
      </View>
    </LinearGradient>
  );
}

// ─── Step Components ──────────────────────────────────────────────────────────

function StepWelcome({ name, onNext }: { name: string; onNext: () => void }) {
  return (
    <ScrollView contentContainerStyle={styles.stepContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.budLabel}>👋 Bud says</Text>
      <Text style={styles.stepTitle}>Hey {name}, let's get you set up.</Text>
      <Text style={styles.stepBody}>
        Bud is your AI financial guide. In the next few minutes, I'll learn what you're working
        toward so I can make this personal from day one.
      </Text>
      <Text style={styles.stepBody}>
        No judgement. Just your situation, your goals, and a plan that actually fits you.
      </Text>
      <NextButton label="Let's go →" onPress={onNext} />
    </ScrollView>
  );
}

function StepGoals({ goals, selected, onToggle, onNext, onBack }: {
  goals: typeof GOALS; selected: string[]; onToggle: (id: string) => void; onNext: () => void; onBack: () => void;
}) {
  return (
    <ScrollView contentContainerStyle={styles.stepContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.stepTitle}>What are you working toward?</Text>
      <Text style={styles.stepSubtitle}>Pick up to 3. This shapes your quests and advice.</Text>
      <View style={styles.optionGrid}>
        {goals.map((g) => {
          const isSel = selected.includes(g.id);
          return (
            <Pressable
              key={g.id}
              style={[styles.optionCard, isSel && styles.optionCardSelected]}
              onPress={() => onToggle(g.id)}
            >
              <Text style={styles.optionEmoji}>{g.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.optionLabel, isSel && styles.optionLabelSelected]}>{g.label}</Text>
                <Text style={styles.optionSub}>{g.sub}</Text>
              </View>
              {isSel && <Text style={styles.checkmark}>✓</Text>}
            </Pressable>
          );
        })}
      </View>
      <View style={styles.navRow}>
        <BackButton onPress={onBack} />
        <NextButton label={`Continue (${selected.length})`} onPress={onNext} disabled={selected.length === 0} />
      </View>
    </ScrollView>
  );
}

function StepWhy({ options, selected, customWhy, onSelect, onCustom, onNext, onBack }: {
  options: typeof WHY_OPTIONS; selected: string | null; customWhy: string;
  onSelect: (id: string) => void; onCustom: (v: string) => void; onNext: () => void; onBack: () => void;
}) {
  return (
    <ScrollView contentContainerStyle={styles.stepContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.stepTitle}>What's your real reason?</Text>
      <Text style={styles.stepSubtitle}>
        Bud will remind you of this every day. Be honest — it's just for you.
      </Text>
      <View style={styles.optionGrid}>
        {options.map((w) => {
          const isSel = selected === w.id;
          return (
            <Pressable
              key={w.id}
              style={[styles.optionCard, isSel && styles.optionCardSelected]}
              onPress={() => onSelect(w.id)}
            >
              <Text style={styles.optionEmoji}>{w.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.optionLabel, isSel && styles.optionLabelSelected]}>{w.label}</Text>
                <Text style={styles.optionSub}>{w.sub}</Text>
              </View>
              {isSel && <Text style={styles.checkmark}>✓</Text>}
            </Pressable>
          );
        })}
      </View>
      {selected === "other" && (
        <TextInput
          style={styles.whyInput}
          value={customWhy}
          onChangeText={onCustom}
          placeholder="Write your real reason..."
          placeholderTextColor={Colors.muted}
          multiline
          numberOfLines={3}
        />
      )}
      <View style={styles.navRow}>
        <BackButton onPress={onBack} />
        <NextButton label="Continue →" onPress={onNext} disabled={!selected} />
      </View>
    </ScrollView>
  );
}

function StepStreak({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  return (
    <ScrollView contentContainerStyle={styles.stepContent} showsVerticalScrollIndicator={false}>
      <View style={styles.streakOrb}>
        <Text style={styles.streakFlame}>🔥</Text>
        <Text style={styles.streakDay}>Day 1</Text>
      </View>
      <Text style={styles.stepTitle}>Your streak starts now.</Text>
      <Text style={styles.stepBody}>
        Open Budget Buddy every day to keep your flame alive. Miss a day and it resets.
        This is how Duolingo built 500 million habits — and it works for money too.
      </Text>
      <Text style={styles.stepBody}>
        Your streak is visible to your Buds. It signals discipline. That's real social currency.
      </Text>
      <View style={styles.navRow}>
        <BackButton onPress={onBack} />
        <NextButton label="I'm ready 🔥" onPress={onNext} />
      </View>
    </ScrollView>
  );
}

function StepReady({ name, onFinish, onBack }: { name: string; onFinish: () => void; onBack: () => void }) {
  return (
    <ScrollView contentContainerStyle={styles.stepContent} showsVerticalScrollIndicator={false}>
      <Text style={{ fontSize: 64, textAlign: "center", marginBottom: 16 }}>⚡</Text>
      <Text style={styles.stepTitle}>{name}, you're set up.</Text>
      <Text style={styles.stepBody}>
        Bud has your goals, your why, and your first quest ready. Your financial life starts
        the moment you walk through that door.
      </Text>
      <Text style={[styles.stepBody, { color: Colors.gold }]}>
        This is the step most people never take.
      </Text>
      <View style={styles.navRow}>
        <BackButton onPress={onBack} />
        <NextButton label="Enter Budget Buddy →" onPress={onFinish} />
      </View>
    </ScrollView>
  );
}

function NextButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.nextBtn,
        disabled && { opacity: 0.4 },
        pressed && { opacity: 0.8 },
      ]}
    >
      <LinearGradient
        colors={[Colors.gold, "#E08A10"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.nextBtnGradient}
      >
        <Text style={styles.nextBtnText}>{label}</Text>
      </LinearGradient>
    </Pressable>
  );
}

function BackButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.backBtn}>
      <Text style={styles.backBtnText}>← Back</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  progressContainer: { paddingHorizontal: 24, paddingBottom: 16 },
  stepLabel: { fontSize: 12, color: Colors.muted, fontWeight: "500", marginBottom: 8, letterSpacing: 0.5 },
  progressTrack: { height: 3, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 2 },
  progressFill: { height: 3, backgroundColor: Colors.gold, borderRadius: 2 },
  stepContainer: { flex: 1, paddingHorizontal: 24 },
  stepContent: { paddingTop: 16, paddingBottom: 32 },
  budLabel: { fontSize: 13, color: Colors.gold, fontWeight: "600", marginBottom: 12, letterSpacing: 0.3 },
  stepTitle: { fontSize: 28, fontWeight: "800", color: "#FFF", letterSpacing: -0.5, lineHeight: 36, marginBottom: 16 },
  stepSubtitle: { fontSize: 15, color: Colors.muted, marginBottom: 24, lineHeight: 22 },
  stepBody: { fontSize: 15, color: Colors.muted, lineHeight: 24, marginBottom: 16 },
  optionGrid: { gap: 10, marginBottom: 24 },
  optionCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  optionCardSelected: { borderColor: Colors.gold, backgroundColor: "rgba(244,168,50,0.1)" },
  optionEmoji: { fontSize: 24 },
  optionLabel: { fontSize: 15, fontWeight: "600", color: "#FFF" },
  optionLabelSelected: { color: Colors.gold },
  optionSub: { fontSize: 12, color: Colors.muted, marginTop: 2 },
  checkmark: { fontSize: 16, color: Colors.gold, fontWeight: "700" },
  navRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 8 },
  nextBtn: {
    flex: 1,
    borderRadius: 14,
    overflow: "hidden",
    shadowColor: Colors.gold,
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  nextBtnGradient: { paddingVertical: 16, alignItems: "center" },
  nextBtnText: { fontSize: 16, fontWeight: "700", color: Colors.navy },
  backBtn: { paddingHorizontal: 16, paddingVertical: 16 },
  backBtnText: { fontSize: 15, color: Colors.muted, fontWeight: "500" },
  whyInput: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: "#FFF",
    marginBottom: 24,
    minHeight: 88,
    textAlignVertical: "top",
  },
  streakOrb: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(244,168,50,0.12)",
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
    borderWidth: 1.5,
    borderColor: "rgba(244,168,50,0.3)",
  },
  streakFlame: { fontSize: 40 },
  streakDay: { fontSize: 16, fontWeight: "700", color: Colors.gold, marginTop: 2 },
});

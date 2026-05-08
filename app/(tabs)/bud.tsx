import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Colors } from "@/constants/colors";
import { useUser } from "@/hooks/useAuth";
import { MOCK_BUD_INSIGHT, MOCK_SESSIONS, MOCK_CHAT_HISTORY, BudMessage } from "@/mock/bud";
import { Icon, type IconName } from "@/components/Icon";

const TAB_BAR_HEIGHT = 80;

type BudView = "home" | "ask" | "sessions";

export default function BudScreen() {
  const insets = useSafeAreaInsets();
  const user = useUser();

  const [view, setView] = useState<BudView>("home");
  const [question, setQuestion] = useState("");
  const [chatHistory, setChatHistory] = useState<BudMessage[]>(MOCK_CHAT_HISTORY);
  const [isTyping, setIsTyping] = useState(false);

  const handleAsk = () => {
    if (!question.trim()) return;
    const userMsg: BudMessage = {
      id: `m_${Date.now()}`,
      role: "user",
      content: question,
      timestamp: new Date().toISOString(),
    };
    setChatHistory((prev) => [...prev, userMsg]);
    setQuestion("");
    setIsTyping(true);

    setTimeout(() => {
      const budResponse: BudMessage = {
        id: `m_${Date.now() + 1}`,
        role: "bud",
        content:
          "One thing worth knowing is that most people find progress happens in small, consistent steps rather than big swings. Based on your current spending patterns, even shifting $30/week makes a measurable difference over 90 days.",
        timestamp: new Date().toISOString(),
      };
      setChatHistory((prev) => [...prev, budResponse]);
      setIsTyping(false);
    }, 1400);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={["#0E1926", "#1B2B4B"]}
        style={[styles.header, { paddingTop: insets.top + 12 }]}
      >
        <Text style={styles.wordmark}>Budget Buddy</Text>
        <View style={styles.headerRow}>
          <View style={styles.budHeaderOrb}>
            <LinearGradient colors={[Colors.gold, "#E08A10"]} style={styles.budOrbGrad}>
              <Text style={styles.budOrbLetter}>B</Text>
            </LinearGradient>
          </View>
          <View>
            <Text style={styles.headerTitle}>Bud</Text>
            <Text style={styles.headerSub}>Your AI financial guide</Text>
          </View>
        </View>

        {/* View switcher */}
        <View style={styles.viewSwitcher}>
          {(["home", "ask", "sessions"] as BudView[]).map((v) => (
            <Pressable
              key={v}
              style={[styles.switchTab, view === v && styles.switchTabActive]}
              onPress={() => setView(v)}
            >
              <Text style={[styles.switchTabText, view === v && styles.switchTabTextActive]}>
                {v === "home" ? "Home" : v === "ask" ? "Ask Bud" : "Sessions"}
              </Text>
            </Pressable>
          ))}
        </View>
      </LinearGradient>

      {/* Content */}
      {view === "home" && (
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 24 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Today's Insight */}
          <View style={styles.insightCard}>
            <View style={styles.insightLabelRow}>
              <Icon name="sparkles" size={13} color={Colors.gold} strokeWidth={2.4} />
              <Text style={styles.insightLabel}>Today's insight</Text>
            </View>
            <Text style={styles.insightText}>{MOCK_BUD_INSIGHT.message}</Text>
            <Text style={styles.insightTime}>Updated this morning</Text>
          </View>

          {/* Action cards */}
          <View style={styles.actionCards}>
            <ActionCard
              icon="layers"
              title="Start a Session"
              sub="3–5 min financial lessons built for your situation"
              onPress={() => setView("sessions")}
            />
            <ActionCard
              icon="message-circle"
              title="Ask Bud"
              sub="Plain-language answers grounded in your real data"
              onPress={() => setView("ask")}
            />
            <ActionCard
              icon="bar-chart"
              title="Review My Week"
              sub="Bud's weekly breakdown — every Sunday"
              onPress={() => {}}
              locked={new Date().getDay() !== 0}
              lockReason="Available on Sundays"
            />
          </View>

          {/* Run Scenario — Time Machine */}
          <View style={styles.scenarioCard}>
            <LinearGradient colors={[Colors.navy, "#0E1926"]} style={styles.scenarioGrad}>
              <View style={styles.scenarioHeader}>
                <View style={styles.scenarioIconBox}>
                  <Icon name="line-chart" size={18} color={Colors.gold} strokeWidth={2.2} />
                </View>
                <View style={styles.eliteBadge}>
                  <Text style={styles.eliteBadgeText}>Elite</Text>
                </View>
              </View>
              <Text style={styles.scenarioTitle}>Run Scenario</Text>
              <Text style={styles.scenarioSub}>
                "What if I saved $200 more per month for 2 years?" Bud runs the math.
              </Text>
              <Pressable style={styles.scenarioCta}>
                <Text style={styles.scenarioCtaText}>Upgrade to Elite →</Text>
              </Pressable>
            </LinearGradient>
          </View>

          {/* Bud Memory snippet */}
          <View style={styles.memoryCard}>
            <View style={styles.memoryTitleRow}>
              <Icon name="info" size={13} color={Colors.gold} strokeWidth={2.4} />
              <Text style={styles.memoryTitle}>What Bud knows about you</Text>
            </View>
            <View style={styles.memoryItem}>
              <View style={styles.memoryBullet} />
              <Text style={styles.memoryText}>Emergency Fund goal at 22% — pace is behind by $40/month</Text>
            </View>
            <View style={styles.memoryItem}>
              <View style={styles.memoryBullet} />
              <Text style={styles.memoryText}>Shopping is your highest overspend category this month</Text>
            </View>
            <View style={styles.memoryItem}>
              <View style={styles.memoryBullet} />
              <Text style={styles.memoryText}>14-day streak — best ever was 21 days</Text>
            </View>
          </View>
        </ScrollView>
      )}

      {view === "ask" && (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={0}
        >
          <ScrollView
            contentContainerStyle={[
              styles.chatContent,
              { paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 80 },
            ]}
            showsVerticalScrollIndicator={false}
          >
            {/* Disclaimer */}
            <View style={styles.disclaimer}>
              <Text style={styles.disclaimerText}>
                Bud is an educational guide, not a licensed financial advisor. All responses are informational.
              </Text>
            </View>

            {/* Suggested questions */}
            <Text style={styles.suggestLabel}>Tap a question to ask:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestions}>
              {[
                "How do I build an emergency fund?",
                "What's the avalanche vs snowball method?",
                "How does compound interest work?",
                "How can I improve my credit score?",
              ].map((q) => (
                <Pressable key={q} style={styles.suggestionChip} onPress={() => setQuestion(q)}>
                  <Text style={styles.suggestionText}>{q}</Text>
                </Pressable>
              ))}
            </ScrollView>

            {/* Chat */}
            <View style={styles.chatMessages}>
              {chatHistory.map((msg) => (
                <View
                  key={msg.id}
                  style={[
                    styles.chatBubble,
                    msg.role === "user" ? styles.chatBubbleUser : styles.chatBubbleBud,
                  ]}
                >
                  {msg.role === "bud" && (
                    <View style={styles.budBubbleAvatar}>
                      <LinearGradient colors={[Colors.gold, "#E08A10"]} style={styles.budMiniOrb}>
                        <Text style={{ fontSize: 10, fontWeight: "800", color: Colors.navy }}>B</Text>
                      </LinearGradient>
                    </View>
                  )}
                  <View style={[styles.bubbleContent, msg.role === "user" && styles.bubbleContentUser]}>
                    <Text style={[styles.bubbleText, msg.role === "user" && styles.bubbleTextUser]}>
                      {msg.content}
                    </Text>
                  </View>
                </View>
              ))}
              {isTyping && (
                <View style={[styles.chatBubble, styles.chatBubbleBud]}>
                  <View style={styles.budBubbleAvatar}>
                    <LinearGradient colors={[Colors.gold, "#E08A10"]} style={styles.budMiniOrb}>
                      <Text style={{ fontSize: 10, fontWeight: "800", color: Colors.navy }}>B</Text>
                    </LinearGradient>
                  </View>
                  <View style={styles.bubbleContent}>
                    <Text style={styles.typingText}>Bud is thinking…</Text>
                  </View>
                </View>
              )}
            </View>
          </ScrollView>

          {/* Input */}
          <View style={[styles.inputBar, { paddingBottom: insets.bottom + TAB_BAR_HEIGHT + 8 }]}>
            <TextInput
              style={styles.chatInput}
              value={question}
              onChangeText={setQuestion}
              placeholder="Ask Bud anything financial..."
              placeholderTextColor={Colors.muted}
              returnKeyType="send"
              onSubmitEditing={handleAsk}
              multiline
            />
            <Pressable style={styles.sendButton} onPress={handleAsk}>
              <LinearGradient colors={[Colors.gold, "#E08A10"]} style={styles.sendGrad}>
                <Text style={styles.sendIcon}>↑</Text>
              </LinearGradient>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      )}

      {view === "sessions" && (
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 24 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.sessionsHeader}>
            {user?.subscriptionTier === "free"
              ? "1 session available this month"
              : user?.subscriptionTier === "premium"
              ? "4 sessions available this month"
              : "Unlimited sessions"}
          </Text>

          {MOCK_SESSIONS.map((session) => (
            <Pressable key={session.id} style={[styles.sessionCard, session.completed && styles.sessionCardDone]}>
              <View style={styles.sessionCardHeader}>
                <View style={styles.sessionCategoryBadge}>
                  <Text style={styles.sessionCategoryText}>{session.category}</Text>
                </View>
                <Text style={styles.sessionXP}>+{session.xpReward} XP</Text>
              </View>
              <Text style={styles.sessionTitle}>{session.title}</Text>
              <Text style={styles.sessionWhy}>{session.whyItMattersNow}</Text>
              <View style={styles.sessionFooter}>
                <View style={styles.sessionDurationRow}>
                  <Icon name="calendar" size={11} color={Colors.muted} strokeWidth={2.2} />
                  <Text style={styles.sessionDuration}>{session.duration}</Text>
                </View>
                {session.completed ? (
                  <View style={styles.sessionDoneBadge}>
                    <Icon name="check" size={11} color={Colors.emerald} strokeWidth={3} />
                    <Text style={styles.sessionDoneText}>Completed</Text>
                  </View>
                ) : (
                  <Text style={styles.sessionStart}>Start →</Text>
                )}
              </View>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function ActionCard({ icon, title, sub, onPress, locked, lockReason }: {
  icon: IconName; title: string; sub: string; onPress: () => void; locked?: boolean; lockReason?: string;
}) {
  return (
    <Pressable
      style={[styles.actionCard, locked && styles.actionCardLocked]}
      onPress={!locked ? onPress : undefined}
      disabled={locked}
    >
      <View style={styles.actionIconBox}>
        <Icon name={icon} size={18} color={Colors.gold} strokeWidth={2.2} />
      </View>
      <View style={styles.actionText}>
        <Text style={styles.actionTitle}>{title}</Text>
        <Text style={styles.actionSub}>{locked ? lockReason ?? sub : sub}</Text>
      </View>
      {locked ? (
        <Icon name="lock" size={14} color={Colors.muted} strokeWidth={2} />
      ) : (
        <Icon name="chevron-right" size={16} color={Colors.muted} strokeWidth={2.2} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  header: { paddingHorizontal: 20, paddingBottom: 0 },
  wordmark: { fontSize: 13, fontWeight: "600", color: "rgba(255,255,255,0.4)", letterSpacing: 2, textTransform: "uppercase", textAlign: "center", marginBottom: 12 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 16 },
  budHeaderOrb: { width: 44, height: 44, borderRadius: 22, overflow: "hidden" },
  budOrbGrad: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  budOrbLetter: { fontSize: 22, fontWeight: "800", color: Colors.navy },
  headerTitle: { fontSize: 24, fontWeight: "800", color: "#FFF", letterSpacing: -0.5 },
  headerSub: { fontSize: 13, color: Colors.muted },
  viewSwitcher: { flexDirection: "row", borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.08)", marginTop: 4 },
  switchTab: { flex: 1, paddingVertical: 12, alignItems: "center" },
  switchTabActive: { borderBottomWidth: 2, borderBottomColor: Colors.gold },
  switchTabText: { fontSize: 13, color: Colors.muted, fontWeight: "500" },
  switchTabTextActive: { color: Colors.gold, fontWeight: "700" },
  scrollContent: { padding: 20, gap: 14 },
  insightCard: { backgroundColor: "rgba(244,168,50,0.08)", borderRadius: 16, padding: 18, borderWidth: 1, borderColor: "rgba(244,168,50,0.2)" },
  insightLabelRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 },
  insightLabel: { fontSize: 12, color: Colors.gold, fontWeight: "800", letterSpacing: 0.6, textTransform: "uppercase" },
  insightText: { fontSize: 15, color: Colors.navyMuted, lineHeight: 22, fontWeight: "400" },
  insightTime: { fontSize: 11, color: Colors.muted, marginTop: 10 },
  actionCards: { gap: 10 },
  actionCard: { flexDirection: "row", alignItems: "center", backgroundColor: Colors.card, borderRadius: 14, padding: 16, gap: 14, shadowColor: Colors.navy, shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  actionCardLocked: { opacity: 0.55 },
  actionIconBox: { width: 36, height: 36, borderRadius: 10, backgroundColor: "rgba(244,168,50,0.12)", borderWidth: 1, borderColor: "rgba(244,168,50,0.3)", alignItems: "center", justifyContent: "center" },
  actionText: { flex: 1 },
  actionTitle: { fontSize: 15, fontWeight: "700", color: Colors.navy, marginBottom: 2 },
  actionSub: { fontSize: 12, color: Colors.muted, lineHeight: 16 },
  scenarioCard: { borderRadius: 16, overflow: "hidden" },
  scenarioGrad: { padding: 20 },
  scenarioHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  scenarioIconBox: { width: 36, height: 36, borderRadius: 10, backgroundColor: "rgba(244,168,50,0.12)", borderWidth: 1, borderColor: "rgba(244,168,50,0.3)", alignItems: "center", justifyContent: "center" },
  eliteBadge: { backgroundColor: Colors.gold, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, alignSelf: "flex-start" },
  eliteBadgeText: { fontSize: 11, fontWeight: "700", color: Colors.navy },
  scenarioTitle: { fontSize: 18, fontWeight: "800", color: "#FFF", marginBottom: 6 },
  scenarioSub: { fontSize: 13, color: Colors.muted, lineHeight: 18, marginBottom: 16 },
  scenarioCta: { alignSelf: "flex-start" },
  scenarioCtaText: { fontSize: 13, color: Colors.gold, fontWeight: "700" },
  memoryCard: { backgroundColor: Colors.card, borderRadius: 16, padding: 16, gap: 10, shadowColor: Colors.navy, shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  memoryTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  memoryTitle: { fontSize: 13, fontWeight: "800", color: Colors.navy, letterSpacing: 0.4, textTransform: "uppercase" },
  memoryItem: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  memoryBullet: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: Colors.gold, marginTop: 7 },
  memoryText: { fontSize: 13, color: Colors.navyMuted, flex: 1, lineHeight: 18 },
  chatContent: { padding: 20 },
  disclaimer: { backgroundColor: "rgba(244,168,50,0.07)", borderRadius: 10, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: "rgba(244,168,50,0.15)" },
  disclaimerText: { fontSize: 12, color: Colors.muted, lineHeight: 17 },
  suggestLabel: { fontSize: 12, color: Colors.muted, fontWeight: "500", marginBottom: 10, letterSpacing: 0.3 },
  suggestions: { gap: 8, paddingBottom: 16 },
  suggestionChip: { backgroundColor: Colors.card, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: Colors.border },
  suggestionText: { fontSize: 13, color: Colors.navyMuted, fontWeight: "500" },
  chatMessages: { gap: 14 },
  chatBubble: { flexDirection: "row", gap: 10, alignItems: "flex-end" },
  chatBubbleUser: { flexDirection: "row-reverse" },
  chatBubbleBud: {},
  budBubbleAvatar: { width: 28, height: 28, borderRadius: 14, overflow: "hidden", flexShrink: 0 },
  budMiniOrb: { width: 28, height: 28, alignItems: "center", justifyContent: "center" },
  bubbleContent: { maxWidth: "78%", backgroundColor: Colors.card, borderRadius: 16, borderBottomLeftRadius: 4, padding: 14, shadowColor: Colors.navy, shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  bubbleContentUser: { backgroundColor: Colors.navy, borderBottomLeftRadius: 16, borderBottomRightRadius: 4 },
  bubbleText: { fontSize: 14, color: Colors.navyMuted, lineHeight: 20 },
  bubbleTextUser: { color: "#FFF" },
  typingText: { fontSize: 13, color: Colors.muted, fontStyle: "italic" },
  inputBar: { position: "absolute", bottom: 0, left: 0, right: 0, flexDirection: "row", alignItems: "flex-end", gap: 10, paddingHorizontal: 20, paddingTop: 12, backgroundColor: Colors.surface, borderTopWidth: 1, borderTopColor: Colors.border },
  chatInput: { flex: 1, backgroundColor: Colors.card, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 12, fontSize: 15, color: Colors.navy, borderWidth: 1, borderColor: Colors.border, maxHeight: 100 },
  sendButton: { width: 44, height: 44, borderRadius: 22, overflow: "hidden" },
  sendGrad: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  sendIcon: { fontSize: 18, fontWeight: "700", color: Colors.navy },
  sessionsHeader: { fontSize: 13, color: Colors.muted, fontWeight: "500", marginBottom: 4 },
  sessionCard: { backgroundColor: Colors.card, borderRadius: 16, padding: 16, gap: 10, shadowColor: Colors.navy, shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  sessionCardDone: { opacity: 0.65 },
  sessionCardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sessionCategoryBadge: { backgroundColor: Colors.navy50, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  sessionCategoryText: { fontSize: 11, color: Colors.navyMuted, fontWeight: "600" },
  sessionXP: { fontSize: 12, color: Colors.gold, fontWeight: "700" },
  sessionTitle: { fontSize: 15, fontWeight: "700", color: Colors.navy, lineHeight: 20 },
  sessionWhy: { fontSize: 12, color: Colors.muted, lineHeight: 17 },
  sessionFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sessionDurationRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  sessionDuration: { fontSize: 12, color: Colors.muted },
  sessionDoneBadge: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(16,185,129,0.12)", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  sessionDoneText: { fontSize: 12, color: Colors.emerald, fontWeight: "600" },
  sessionStart: { fontSize: 13, color: Colors.gold, fontWeight: "700" },
});

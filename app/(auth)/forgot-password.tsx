import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BrandHeader } from "@/components/BrandLogo";
import { Icon } from "@/components/Icon";
import { Colors } from "@/constants/colors";
import { authService } from "@/services/authService";

export default function ForgotPasswordScreen() {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [debugToken, setDebugToken] = useState<string | null>(null);

  const submit = async () => {
    if (!email.trim()) return;
    setLoading(true);
    setMessage(null);
    try {
      const result = await authService.forgotPassword(email.trim().toLowerCase());
      setMessage(result.message);
      setDebugToken(result.debugToken ?? null);
    } catch {
      setMessage("Could not start password recovery. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={[Colors.brandGradientStart, Colors.brandGradientMid]} style={styles.flex}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView
          contentContainerStyle={[styles.container, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}
          keyboardShouldPersistTaps="handled"
        >
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Icon name="arrow-left" size={17} color={Colors.muted} strokeWidth={2.4} />
            <Text style={styles.backText}>Back</Text>
          </Pressable>
          <BrandHeader dark style={styles.brandHeader} />
          <Text style={styles.title}>Reset your password</Text>
          <Text style={styles.subtitle}>Enter the email connected to your Budget Buddy account.</Text>

          <View style={styles.form}>
            {message ? <Text style={styles.message}>{message}</Text> : null}
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              placeholder="your@email.com"
              placeholderTextColor={Colors.muted}
              onSubmitEditing={submit}
            />
          </View>

          <Pressable style={styles.button} onPress={submit} disabled={loading || !email.trim()}>
            {loading ? <ActivityIndicator color={Colors.onAccent} /> : <Text style={styles.buttonText}>Send reset link</Text>}
          </Pressable>

          {debugToken ? (
            <Pressable
              style={styles.devButton}
              onPress={() => router.push({ pathname: "/reset-password", params: { token: debugToken } })}
            >
              <Text style={styles.devButtonText}>Open local reset link</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flexGrow: 1, paddingHorizontal: 24 },
  backButton: { flexDirection: "row", alignItems: "center", gap: 7, alignSelf: "flex-start", marginBottom: 32 },
  backText: { color: Colors.muted, fontSize: 15, fontWeight: "500" },
  brandHeader: { marginBottom: 32 },
  title: { color: Colors.brandOnDark, fontSize: 30, fontWeight: "800", letterSpacing: 0, marginBottom: 10 },
  subtitle: { color: Colors.muted, fontSize: 15, lineHeight: 22, marginBottom: 36 },
  form: { gap: 10, marginBottom: 24 },
  label: { color: Colors.muted, fontSize: 13, fontWeight: "700", textTransform: "uppercase" },
  input: { backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, color: Colors.brandOnDark, fontSize: 16 },
  message: { color: Colors.brandOnDark, lineHeight: 20, marginBottom: 8 },
  button: { minHeight: 54, borderRadius: 12, backgroundColor: Colors.accent, alignItems: "center", justifyContent: "center" },
  buttonText: { color: Colors.onAccent, fontSize: 16, fontWeight: "800" },
  devButton: { minHeight: 48, alignItems: "center", justifyContent: "center", marginTop: 12 },
  devButtonText: { color: Colors.accent, fontSize: 14, fontWeight: "700" },
});

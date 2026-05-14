import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Colors } from "@/constants/colors";
import { BrandHeader } from "@/components/BrandLogo";
import { Icon } from "@/components/Icon";
import { useAuthActions } from "@/hooks/useAuth";
import * as Haptics from "expo-haptics";

export default function RegisterScreen() {
  const insets = useSafeAreaInsets();
  const { register } = useAuthActions();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRegister = async () => {
    if (!firstName || !email || !password) {
      setError("Please fill in all required fields.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setError(null);
    setIsLoading(true);
    try {
      await register({ firstName, lastName, email: email.trim().toLowerCase(), password });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/(auth)/onboarding");
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError("Something went wrong. Try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <LinearGradient colors={["#0E1926", "#1B2B4B"]} style={{ flex: 1 }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={[
            styles.container,
            { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Icon name="arrow-left" size={17} color={Colors.muted} strokeWidth={2.4} />
            <Text style={styles.backText}>Back</Text>
          </Pressable>

          <BrandHeader dark style={styles.brandHeader} />
          <Text style={styles.title}>Create your account</Text>
          <Text style={styles.subtitle}>
            Takes 60 seconds. No credit card needed.
          </Text>

          <View style={styles.form}>
            {error && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.inputLabel}>First Name</Text>
                <TextInput
                  style={styles.input}
                  value={firstName}
                  onChangeText={setFirstName}
                  placeholder="Marcus"
                  placeholderTextColor={Colors.muted}
                  autoCapitalize="words"
                  returnKeyType="next"
                />
              </View>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.inputLabel}>Last Name</Text>
                <TextInput
                  style={styles.input}
                  value={lastName}
                  onChangeText={setLastName}
                  placeholder="Rivera"
                  placeholderTextColor={Colors.muted}
                  autoCapitalize="words"
                  returnKeyType="next"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Email</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="your@email.com"
                placeholderTextColor={Colors.muted}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                returnKeyType="next"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Password</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="At least 8 characters"
                placeholderTextColor={Colors.muted}
                secureTextEntry
                autoComplete="new-password"
                returnKeyType="done"
                onSubmitEditing={handleRegister}
              />
            </View>
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.registerButton,
              pressed && { opacity: 0.85 },
              isLoading && { opacity: 0.7 },
            ]}
            onPress={handleRegister}
            disabled={isLoading}
          >
            <LinearGradient
              colors={[Colors.gold, Colors.gold600]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.registerButtonGradient}
            >
              {isLoading ? (
                <ActivityIndicator color={Colors.navy} />
              ) : (
                <Text style={styles.registerButtonText}>Create Account</Text>
              )}
            </LinearGradient>
          </Pressable>

          <Text style={styles.legalText}>
            By creating an account you agree to our Terms of Service and Privacy
            Policy.
          </Text>

          <Pressable onPress={() => router.push("/(auth)/login")}>
            <Text style={styles.loginLink}>
              Already have an account?{" "}
              <Text style={{ color: Colors.gold, fontWeight: "600" }}>Sign in</Text>
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, paddingHorizontal: 24 },
  backButton: {
    marginBottom: 32,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    alignSelf: "flex-start",
  },
  backText: { color: Colors.muted, fontSize: 15, fontWeight: "500" },
  brandHeader: { marginBottom: 32 },
  title: { fontSize: 32, fontWeight: "800", color: "#FFF", marginBottom: 8, letterSpacing: 0 },
  subtitle: { fontSize: 15, color: Colors.muted, marginBottom: 40 },
  form: { gap: 20, marginBottom: 32 },
  row: { flexDirection: "row", gap: 12 },
  errorBanner: {
    backgroundColor: "rgba(239,68,68,0.12)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.3)",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  errorText: { color: Colors.coral, fontSize: 13, fontWeight: "500" },
  inputGroup: { gap: 8 },
  inputLabel: { fontSize: 13, fontWeight: "600", color: Colors.muted, letterSpacing: 0.5, textTransform: "uppercase" },
  input: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: "#FFF",
  },
  registerButton: { borderRadius: 16, overflow: "hidden", marginBottom: 16, shadowColor: Colors.gold, shadowOpacity: 0.35, shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: 8 },
  registerButtonGradient: { paddingVertical: 18, alignItems: "center" },
  registerButtonText: { fontSize: 17, fontWeight: "700", color: Colors.navy, letterSpacing: 0.3 },
  legalText: { textAlign: "center", fontSize: 12, color: Colors.muted, lineHeight: 18, marginBottom: 16, paddingHorizontal: 16 },
  loginLink: { textAlign: "center", color: Colors.muted, fontSize: 14 },
});

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

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { login } = useAuthActions();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!email || !password) {
      setError("Please fill in all fields.");
      return;
    }
    setError(null);
    setIsLoading(true);
    try {
      await login({ email: email.trim().toLowerCase(), password });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/(tabs)/today");
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError("Incorrect email or password. Try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <LinearGradient
      colors={["#0E1926", "#1B2B4B"]}
      style={{ flex: 1 }}
    >
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
          {/* Back */}
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Icon name="arrow-left" size={17} color={Colors.muted} strokeWidth={2.4} />
            <Text style={styles.backText}>Back</Text>
          </Pressable>

          {/* Header */}
          <BrandHeader dark style={styles.brandHeader} />
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>Sign in to continue your streak.</Text>

          {/* Form */}
          <View style={styles.form}>
            {error && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

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
                placeholder="Your password"
                placeholderTextColor={Colors.muted}
                secureTextEntry
                autoComplete="password"
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />
            </View>

            <Pressable style={styles.forgotPassword}>
              <Text style={styles.forgotText}>Forgot password?</Text>
            </Pressable>
          </View>

          {/* CTA */}
          <Pressable
            style={({ pressed }) => [
              styles.loginButton,
              pressed && { opacity: 0.85 },
              isLoading && { opacity: 0.7 },
            ]}
            onPress={handleLogin}
            disabled={isLoading}
          >
            <LinearGradient
              colors={[Colors.gold, "#E08A10"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.loginButtonGradient}
            >
              {isLoading ? (
                <ActivityIndicator color={Colors.navy} />
              ) : (
                <Text style={styles.loginButtonText}>Sign In</Text>
              )}
            </LinearGradient>
          </Pressable>

          <Pressable onPress={() => router.push("/(auth)/register")}>
            <Text style={styles.signupLink}>
              New here?{" "}
              <Text style={{ color: Colors.gold, fontWeight: "600" }}>
                Create an account
              </Text>
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: 24,
  },
  backButton: {
    marginBottom: 32,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    alignSelf: "flex-start",
  },
  backText: {
    color: Colors.muted,
    fontSize: 15,
    fontWeight: "500",
  },
  brandHeader: { marginBottom: 32 },
  title: {
    fontSize: 32,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 8,
    letterSpacing: 0,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.muted,
    marginBottom: 40,
  },
  form: {
    gap: 20,
    marginBottom: 32,
  },
  errorBanner: {
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  errorText: {
    color: Colors.coral,
    fontSize: 13,
    fontWeight: "500",
  },
  inputGroup: {
    gap: 8,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.muted,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  input: {
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: "#FFFFFF",
    fontWeight: "400",
  },
  forgotPassword: {
    alignSelf: "flex-end",
  },
  forgotText: {
    color: Colors.gold,
    fontSize: 13,
    fontWeight: "500",
  },
  loginButton: {
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 16,
    shadowColor: Colors.gold,
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  loginButtonGradient: {
    paddingVertical: 18,
    alignItems: "center",
  },
  loginButtonText: {
    fontSize: 17,
    fontWeight: "700",
    color: Colors.navy,
    letterSpacing: 0.3,
  },
  signupLink: {
    textAlign: "center",
    color: Colors.muted,
    fontSize: 14,
    marginTop: 8,
  },
});

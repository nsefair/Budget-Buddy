import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BrandHeader } from "@/components/BrandLogo";
import { Colors } from "@/constants/colors";
import { authService } from "@/services/authService";
import { useAuthActions, useIsAuthenticated } from "@/hooks/useAuth";

type Mode = "reset" | "verify" | "confirm-email";

export function TokenActionScreen({ mode }: { mode: Mode }) {
  const insets = useSafeAreaInsets();
  const { token } = useLocalSearchParams<{ token?: string }>();
  const authenticated = useIsAuthenticated();
  const { logout, updateUser } = useAuthActions();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(mode !== "reset");
  const [complete, setComplete] = useState(false);
  const [message, setMessage] = useState(token ? "" : "This link is missing its security token.");
  const attempted = useRef(false);

  useEffect(() => {
    if (!token || mode === "reset" || attempted.current) return;
    attempted.current = true;
    let active = true;
    (async () => {
      try {
        const result =
          mode === "verify"
            ? await authService.verifyEmail(token)
            : await authService.confirmEmailChange(token);
        if (!active) return;
        if (mode === "verify") updateUser({ emailVerified: true });
        if (mode === "confirm-email" && authenticated) await logout();
        setMessage(result.message);
        setComplete(true);
      } catch {
        if (active) setMessage("This link is invalid or has expired.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [authenticated, logout, mode, token, updateUser]);

  const reset = async () => {
    if (!token || password.length < 8 || password !== confirm) {
      setMessage("Use at least 8 characters and make sure both passwords match.");
      return;
    }
    setLoading(true);
    try {
      const result = await authService.resetPassword(token, password);
      setMessage(result.message);
      setComplete(true);
    } catch {
      setMessage("This link is invalid or has expired.");
    } finally {
      setLoading(false);
    }
  };

  const title = mode === "reset" ? "Choose a new password" : mode === "verify" ? "Verify your email" : "Confirm your new email";

  return (
    <LinearGradient colors={[Colors.brandGradientStart, Colors.brandGradientMid]} style={styles.flex}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <View style={[styles.container, { paddingTop: insets.top + 36, paddingBottom: insets.bottom + 24 }]}>
          <BrandHeader dark style={styles.brandHeader} />
          <Text style={styles.title}>{title}</Text>

          {loading ? <ActivityIndicator color={Colors.accent} style={styles.loader} /> : null}

          {mode === "reset" && !complete ? (
            <View style={styles.form}>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete="new-password"
                placeholder="New password"
                placeholderTextColor={Colors.muted}
              />
              <TextInput
                style={styles.input}
                value={confirm}
                onChangeText={setConfirm}
                secureTextEntry
                autoComplete="new-password"
                placeholder="Confirm new password"
                placeholderTextColor={Colors.muted}
                onSubmitEditing={reset}
              />
              <Pressable style={styles.button} onPress={reset} disabled={loading}>
                <Text style={styles.buttonText}>Reset password</Text>
              </Pressable>
            </View>
          ) : null}

          {message ? <Text style={styles.message}>{message}</Text> : null}

          {complete || (!loading && mode !== "reset") ? (
            <Pressable
              style={styles.button}
              onPress={() => router.replace(authenticated && mode === "verify" ? "/profile" : "/(auth)/login")}
            >
              <Text style={styles.buttonText}>{authenticated && mode === "verify" ? "Continue" : "Go to sign in"}</Text>
            </Pressable>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, paddingHorizontal: 24 },
  brandHeader: { marginBottom: 36 },
  title: { color: Colors.brandOnDark, fontSize: 30, fontWeight: "800", letterSpacing: 0, marginBottom: 24 },
  loader: { marginVertical: 28 },
  form: { gap: 14 },
  input: { backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, color: Colors.brandOnDark, fontSize: 16 },
  message: { color: Colors.brandOnDark, fontSize: 15, lineHeight: 22, marginBottom: 24 },
  button: { minHeight: 54, borderRadius: 12, backgroundColor: Colors.accent, alignItems: "center", justifyContent: "center", marginTop: 10 },
  buttonText: { color: Colors.onAccent, fontSize: 16, fontWeight: "800" },
});

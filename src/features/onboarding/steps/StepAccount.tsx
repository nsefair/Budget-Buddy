/**
 * Account step — creates the login credentials for the profile we just built.
 *
 * This keeps sign-up inside onboarding instead of forcing a cold register
 * screen before the user understands what Budget Buddy is doing for them.
 */

import React from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { BudBubble } from "../components/BudBubble";
import { Headline, Subheadline } from "../components/Headline";
import { Icon } from "@/components/Icon";
import { Colors } from "@/constants/colors";

interface Props {
  email: string;
  password: string;
  passwordConfirm: string;
  onChangeEmail: (value: string) => void;
  onChangePassword: (value: string) => void;
  onChangePasswordConfirm: (value: string) => void;
  onLogin: () => void;
}

export function StepAccount({
  email,
  password,
  passwordConfirm,
  onChangeEmail,
  onChangePassword,
  onChangePasswordConfirm,
  onLogin,
}: Props) {
  const passwordStarted = password.length > 0 || passwordConfirm.length > 0;
  const passwordMismatch =
    passwordStarted &&
    password.length >= 8 &&
    passwordConfirm.length > 0 &&
    password !== passwordConfirm;

  return (
    <View style={{ gap: 22 }}>
      <View>
        <BudBubble label="Almost there" />
        <Headline>Save this setup.</Headline>
        <Subheadline>
          Create your login so Bud can keep this profile, your first goal, and
          your streak tied to you.
        </Subheadline>
      </View>

      <View style={styles.card}>
        <View style={styles.lockIcon}>
          <Icon name="lock" size={18} color={Colors.gold} strokeWidth={2.5} />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            value={email}
            onChangeText={onChangeEmail}
            placeholder="you@example.com"
            placeholderTextColor={Colors.muted}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            returnKeyType="next"
            style={styles.input}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Password</Text>
          <TextInput
            value={password}
            onChangeText={onChangePassword}
            placeholder="At least 8 characters"
            placeholderTextColor={Colors.muted}
            secureTextEntry
            autoComplete="new-password"
            returnKeyType="next"
            style={styles.input}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Confirm password</Text>
          <TextInput
            value={passwordConfirm}
            onChangeText={onChangePasswordConfirm}
            placeholder="Repeat password"
            placeholderTextColor={Colors.muted}
            secureTextEntry
            autoComplete="new-password"
            returnKeyType="done"
            style={[
              styles.input,
              passwordMismatch && { borderColor: Colors.coral },
            ]}
          />
          {passwordMismatch && (
            <Text style={styles.errorText}>Passwords need to match.</Text>
          )}
        </View>
      </View>

      <Pressable
        onPress={onLogin}
        style={({ pressed }) => [styles.loginLink, pressed && { opacity: 0.7 }]}
      >
        <Text style={styles.loginText}>
          Already have an account? <Text style={styles.loginAccent}>Sign in</Text>
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: Colors.border,
    padding: 16,
    gap: 16,
  },
  lockIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.accentAlpha12,
    borderWidth: 1,
    borderColor: Colors.accentAlpha30,
  },
  field: { gap: 8 },
  label: {
    fontSize: 12,
    fontWeight: "800",
    color: Colors.navyMuted,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  input: {
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 14,
    paddingHorizontal: 15,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.navy,
    fontWeight: "600",
  },
  errorText: {
    color: Colors.coral,
    fontSize: 12,
    fontWeight: "700",
  },
  loginLink: {
    alignItems: "center",
    paddingVertical: 4,
  },
  loginText: {
    color: Colors.muted,
    fontSize: 14,
    fontWeight: "600",
  },
  loginAccent: {
    color: Colors.gold,
    fontWeight: "800",
  },
});

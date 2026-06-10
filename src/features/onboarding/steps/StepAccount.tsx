/**
 * Account step — creates the login credentials for the profile we are building.
 *
 * This keeps sign-up inside onboarding instead of forcing a cold register
 * screen before the user understands what Budget Buddy is doing for them.
 * It also gives Plaid an authenticated user to attach the bank connection to.
 */

import React from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
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
}

export function StepAccount({
  email,
  password,
  passwordConfirm,
  onChangeEmail,
  onChangePassword,
  onChangePasswordConfirm,
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
        <BudBubble label="Quick save" />
        <Headline>Save this setup.</Headline>
        <Subheadline>
          Create your login so your bank connection, first goal, and streak stay
          tied to you.
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
});

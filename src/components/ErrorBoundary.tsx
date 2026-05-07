/**
 * Error Boundary
 *
 * Catches unhandled React errors and shows a friendly recovery screen
 * instead of a blank app. Wrap your root layout with this.
 *
 * In production, also reports to your error tracker (e.g. Sentry).
 * Add Sentry.captureException(error) inside componentDidCatch when wired up.
 */

import React, { ReactNode } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Colors } from "@/constants/colors";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // TODO: Forward to Sentry / Crashlytics here in production
    if (__DEV__) {
      console.error("ErrorBoundary caught:", error, info.componentStack);
    }
  }

  reset = () => this.setState({ hasError: false, error: null });

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <LinearGradient colors={["#0E1926", "#1B2B4B"]} style={styles.container}>
        <View style={styles.budOrb}>
          <Text style={styles.budOrbText}>B</Text>
        </View>
        <Text style={styles.title}>Something glitched.</Text>
        <Text style={styles.subtitle}>
          Bud's looking into it. Tap below to keep going.
        </Text>
        {__DEV__ && this.state.error && (
          <Text style={styles.errorDetail} numberOfLines={3}>
            {this.state.error.message}
          </Text>
        )}
        <Pressable style={styles.button} onPress={this.reset}>
          <Text style={styles.buttonText}>Try again</Text>
        </Pressable>
      </LinearGradient>
    );
  }
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 12,
  },
  budOrb: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Colors.gold,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  budOrbText: { fontSize: 40, fontWeight: "800", color: Colors.navy },
  title: { fontSize: 24, fontWeight: "800", color: "#FFF", textAlign: "center" },
  subtitle: {
    fontSize: 14,
    color: Colors.muted,
    textAlign: "center",
    marginBottom: 24,
  },
  errorDetail: {
    fontSize: 11,
    color: Colors.coral,
    textAlign: "center",
    fontFamily: "Courier",
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  button: {
    backgroundColor: Colors.gold,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 14,
  },
  buttonText: { fontSize: 15, fontWeight: "700", color: Colors.navy },
});

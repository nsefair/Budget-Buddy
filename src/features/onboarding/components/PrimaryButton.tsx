/**
 * PrimaryButton — calm solid accent pill, pressable feedback, optional spinner.
 *
 * Single CTA per screen. Avoid stacking primaries.
 * When `loading` is true the label is hidden and a small activity indicator shows.
 */

import React, { useRef } from "react";
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import { Colors } from "@/constants/colors";

interface Props {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}

export function PrimaryButton({ label, onPress, disabled, loading, style }: Props) {
  const scale = useRef(new Animated.Value(1)).current;

  const pressIn = () =>
    Animated.spring(scale, {
      toValue: 0.97,
      damping: 14,
      stiffness: 280,
      useNativeDriver: true,
    }).start();

  const pressOut = () =>
    Animated.spring(scale, {
      toValue: 1,
      damping: 14,
      stiffness: 280,
      useNativeDriver: true,
    }).start();

  const isInert = disabled || loading;
  // Disabled state uses an explicit muted surface instead of fading the
  // gradient — faded green with a near-black label disappears in dark mode.
  const showDisabledSurface = disabled && !loading;

  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <Pressable
        onPressIn={pressIn}
        onPressOut={pressOut}
        onPress={onPress}
        disabled={isInert}
        style={[styles.wrapper, isInert && styles.disabled]}
      >
        <View style={[styles.fill, showDisabledSurface && styles.fillDisabled]}>
          {loading ? (
            <ActivityIndicator color={Colors.onGreen} />
          ) : (
            <Text style={[styles.label, showDisabledSurface && styles.labelDisabled]}>
              {label}
            </Text>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}

interface SecondaryProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  style?: ViewStyle;
}

export function SecondaryButton({ label, onPress, disabled, style }: SecondaryProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.secondary,
        disabled && { opacity: 0.4 },
        pressed && { opacity: 0.7 },
        style,
      ]}
    >
      <Text style={styles.secondaryLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: { borderRadius: 18, overflow: "hidden" },
  disabled: {},
  fill: {
    minHeight: 54,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.gold,
  },
  fillDisabled: { backgroundColor: Colors.navy100 },
  label: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.onGreen,
    letterSpacing: 0,
  },
  labelDisabled: { color: Colors.muted },
  secondary: {
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.muted,
    letterSpacing: 0.2,
  },
});

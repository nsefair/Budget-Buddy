/**
 * AppSplash — the launch moment (reference: launch & splash animation).
 *
 * While the app loads it mirrors the native splash exactly — same artwork,
 * size, and background — so the handoff is seamless. Once `ready`, it plays a
 * short exit over the already-rendered app: two rings ripple out from the
 * mark, the mark lifts, and the layer dissolves. About a second, it never
 * blocks touches, and Reduce Motion gets a quick fade instead.
 */

import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet } from "react-native";

import { useReducedMotion } from "@/animations";
import { ACTIVE_BRAND_PALETTE, Colors } from "@/constants/colors";

const SPLASH_IMAGE =
  ACTIVE_BRAND_PALETTE === "orange"
    ? require("../../assets/splash-icon-orange.png")
    : require("../../assets/splash-icon-green.png");
// Matches expo-splash-screen's imageWidth in app.json.
const IMAGE_SIZE = 200;
// The visible tile inside the padded artwork.
const TILE_SIZE = IMAGE_SIZE * 0.55;

interface Props {
  /** When true, play the exit; until then, hold the native splash frame. */
  ready?: boolean;
  onDone?: () => void;
}

export function AppSplash({ ready = false, onDone }: Props) {
  const reduced = useReducedMotion();
  const fade = useRef(new Animated.Value(1)).current;
  const lift = useRef(new Animated.Value(0)).current;
  const innerRing = useRef(new Animated.Value(0)).current;
  const outerRing = useRef(new Animated.Value(0)).current;
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    if (!ready) return;
    const ripple = (value: Animated.Value, delay: number) =>
      Animated.timing(value, {
        toValue: 1,
        delay,
        duration: 900,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      });
    const exit = reduced
      ? Animated.timing(fade, { toValue: 0, duration: 250, useNativeDriver: true })
      : Animated.parallel([
          ripple(innerRing, 0),
          ripple(outerRing, 160),
          Animated.timing(lift, {
            toValue: 1,
            delay: 120,
            duration: 700,
            easing: Easing.bezier(0.22, 1, 0.36, 1),
            useNativeDriver: true,
          }),
          Animated.timing(fade, {
            toValue: 0,
            delay: 420,
            duration: 520,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
        ]);
    exit.start(({ finished }) => {
      if (finished) onDoneRef.current?.();
    });
    return () => exit.stop();
  }, [ready, reduced, fade, lift, innerRing, outerRing]);

  const ringStyle = (value: Animated.Value) => ({
    opacity: value.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.55, 0] }),
    transform: [{ scale: value.interpolate({ inputRange: [0, 1], outputRange: [1, 3.2] }) }],
  });

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, styles.container, { opacity: fade }]}
    >
      <Animated.View style={[styles.ring, ringStyle(innerRing)]} />
      <Animated.View style={[styles.ring, ringStyle(outerRing)]} />
      <Animated.Image
        source={SPLASH_IMAGE}
        style={[
          styles.image,
          { transform: [{ scale: lift.interpolate({ inputRange: [0, 1], outputRange: [1, 1.16] }) }] },
        ]}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.black,
  },
  ring: {
    position: "absolute",
    width: TILE_SIZE,
    height: TILE_SIZE,
    borderRadius: TILE_SIZE * 0.28,
    borderWidth: 1.5,
    borderColor: Colors.gold,
  },
  image: { width: IMAGE_SIZE, height: IMAGE_SIZE },
});

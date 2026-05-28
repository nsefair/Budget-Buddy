/**
 * Motion library — animation primitives shared across the app.
 *
 *   import { FadeInUp, Stagger, PressableScale, CountUp, Shimmer } from "@/animations";
 *
 * All primitives:
 *   • Use the built-in React Native `Animated` API (Expo Go + dev build).
 *   • Respect `AccessibilityInfo.isReduceMotionEnabled()` (see useReducedMotion).
 *   • Read durations from `Motion` in `@/constants/tokens` so timing stays consistent.
 *
 * Upgrade path:
 *   When you go full dev build, switch screens to `moti` (already installed)
 *   for declarative animations. These primitives can stay as the fallback API.
 */

export { FadeInUp } from "@/animations/FadeInUp";
export { Stagger } from "@/animations/Stagger";
export { PressableScale } from "@/animations/PressableScale";
export { CountUp } from "@/animations/CountUp";
export { Shimmer } from "@/animations/Shimmer";
export { useReducedMotion } from "@/animations/useReducedMotion";

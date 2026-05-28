/**
 * Design tokens — the single source of truth for spacing, radii, shadows,
 * type, and motion. Everything visual in the app should pull from here so
 * the rhythm stays consistent and changes are one-edit-wide.
 *
 * Inspired by the Developer Review (§02): clean, modern, premium, friendly.
 * Inspired by ui-ux-pro-max skill: modular type scale (12 14 16 18 24 32 40),
 * 150–300 ms motion, generous spacing on mobile.
 */

import { Platform } from "react-native";
import { Colors } from "@/constants/colors";

// ─── Spacing scale (8 pt grid with 4 pt finesse) ────────────────────────────
export const Spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
  hero: 48,
} as const;

// ─── Radii ──────────────────────────────────────────────────────────────────
export const Radius = {
  xs: 6,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
} as const;

// ─── Elevation / shadow system ──────────────────────────────────────────────
// Soft, navy-tinted shadows feel premium across both palettes.
export const Shadow = {
  none: {
    shadowColor: "transparent",
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  sm: {
    shadowColor: Colors.navy,
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  md: {
    shadowColor: Colors.navy,
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  lg: {
    shadowColor: Colors.navy,
    shadowOpacity: 0.1,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
} as const;

// ─── Typography scale ──────────────────────────────────────────────────────
// Sizes follow the recommended modular scale.
// Use Inter (loaded in _layout.tsx) for everything.
export const Type = {
  eyebrow: {
    fontSize: 11,
    fontWeight: "800" as const,
    letterSpacing: 1.4,
    textTransform: "uppercase" as const,
  },
  display: {
    fontSize: 28,
    fontWeight: "800" as const,
    letterSpacing: -0.4,
  },
  h1: {
    fontSize: 24,
    fontWeight: "800" as const,
    letterSpacing: -0.3,
  },
  h2: {
    fontSize: 18,
    fontWeight: "800" as const,
    letterSpacing: -0.2,
  },
  h3: {
    fontSize: 16,
    fontWeight: "800" as const,
    letterSpacing: -0.1,
  },
  body: {
    fontSize: 14,
    fontWeight: "500" as const,
    lineHeight: 20,
  },
  bodyStrong: {
    fontSize: 14,
    fontWeight: "700" as const,
    lineHeight: 20,
  },
  caption: {
    fontSize: 12,
    fontWeight: "600" as const,
    lineHeight: 16,
  },
  micro: {
    fontSize: 10,
    fontWeight: "700" as const,
    letterSpacing: 0.8,
  },
} as const;

// ─── Motion ─────────────────────────────────────────────────────────────────
// Skill rule: 150–300 ms for UI, no infinite decorative animation.
export const Motion = {
  fast: 150,
  base: 200,
  slow: 300,
  hero: 500,
} as const;

// ─── Hit targets ────────────────────────────────────────────────────────────
// Apple HIG: 44pt. Material: 48dp. Use 44 across the app.
export const HitSlop = { top: 8, right: 8, bottom: 8, left: 8 } as const;
export const MinTouchTarget = Platform.select({ ios: 44, default: 48 }) ?? 44;

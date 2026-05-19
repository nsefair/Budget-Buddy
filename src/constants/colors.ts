import { DynamicColorIOS, Platform } from "react-native";

const systemColor = (light: string, dark: string) =>
  (Platform.OS === "ios"
    ? DynamicColorIOS({ light, dark })
    : light) as unknown as string;

const alpha = (rgb: string, opacity: number) => `rgba(${rgb}, ${opacity})`;

const brandPaletteName =
  process.env.EXPO_PUBLIC_BRAND_PALETTE?.trim().toLowerCase() === "orange"
    ? "orange"
    : "green";

export const ACTIVE_BRAND_PALETTE = brandPaletteName;

const palettes = {
  orange: {
    black: "#070D13",
    accent: "#F4A832",
    accentDark: "#E08A10",
    accentSoft: "#FEF7EC",
    accentBright: "#F7B847",
    accentRgb: "244, 168, 50",
    onAccent: "#140A02",
    accentSurfaceLight: "#FEF7EC",
    accentSurfaceDark: "#2A1A08",
    accentSurfaceStrongLight: "#FDECD0",
    accentSurfaceStrongDark: "#3A240A",
    accentBorderLight: "#F8D395",
    accentBorderDark: "#8B5A12",
    navyLight: "#1B2B4B",
    navyDark: "#FFF7EC",
    surfaceLight: "#F8F9FA",
    surfaceDark: "#070D13",
    cardLight: "#FFFFFF",
    cardDark: "#101823",
    borderLight: "#E8EDF5",
    borderDark: "#25344A",
    mutedLight: "#8B9CB8",
    mutedDark: "#A9B7CD",
    navyMutedLight: "#4A5D7A",
    navyMutedDark: "#D9E2F0",
    navy50Light: "#E8EDF5",
    navy50Dark: "#172235",
    navy100Light: "#C5D0E3",
    navy100Dark: "#1F2D44",
    navy200Light: "#9AAECF",
    navy200Dark: "#34465F",
    navy300Light: "#6F8CBB",
    navy300Dark: "#526783",
    navy600: "#1B2B4B",
    navy700: "#152238",
    navy800: "#0E1926",
    navy900: "#070D13",
    emerald: "#10B981",
    emeraldDark: "#059669",
    emerald50: "#ECFDF5",
    emerald50Dark: "#06251A",
    emerald100: "#D1FAE5",
    emerald100Dark: "#0B3A28",
    teal: "#00B4A6",
    tabBarBackgroundLight: "rgba(27, 43, 75, 0.96)",
    tabBarBackgroundDark: "rgba(7, 13, 19, 0.96)",
    tabBarInactiveLight: "rgba(139, 156, 184, 0.6)",
    tabBarInactiveDark: "rgba(169, 183, 205, 0.66)",
    navyOverlayLight: "rgba(27, 43, 75, 0.85)",
    navyOverlayDark: "rgba(7, 13, 19, 0.86)",
    brandGradientStart: "#0E1926",
    brandGradientMid: "#1B2B4B",
    brandGradientEnd: "#0E2338",
    brandOnDarkMuted: "rgba(255, 255, 255, 0.82)",
  },
  green: {
    black: "#050705",
    accent: "#13D845",
    accentDark: "#08A832",
    accentSoft: "#E9FCEE",
    accentBright: "#2AF15A",
    accentRgb: "19, 216, 69",
    onAccent: "#021006",
    accentSurfaceLight: "#E9FCEE",
    accentSurfaceDark: "#082313",
    accentSurfaceStrongLight: "#CCF7D5",
    accentSurfaceStrongDark: "#0F351D",
    accentBorderLight: "#A7F3B8",
    accentBorderDark: "#145C2B",
    navyLight: "#102015",
    navyDark: "#F3FFF4",
    surfaceLight: "#F7FAF7",
    surfaceDark: "#050705",
    cardLight: "#FFFFFF",
    cardDark: "#0C120D",
    borderLight: "#E3EDE4",
    borderDark: "#1F2D21",
    mutedLight: "#6B7F72",
    mutedDark: "#8DAA93",
    navyMutedLight: "#355141",
    navyMutedDark: "#B8D7BF",
    navy50Light: "#EAF5EC",
    navy50Dark: "#122017",
    navy100Light: "#D5E9D9",
    navy100Dark: "#1A2B1F",
    navy200Light: "#AFC8B6",
    navy200Dark: "#2B4231",
    navy300Light: "#7FA08A",
    navy300Dark: "#45624D",
    navy600: "#0B120D",
    navy700: "#08100A",
    navy800: "#050705",
    navy900: "#020302",
    emerald: "#13D845",
    emeraldDark: "#08A832",
    emerald50: "#E9FCEE",
    emerald50Dark: "#082313",
    emerald100: "#CCF7D5",
    emerald100Dark: "#0F351D",
    teal: "#13D845",
    tabBarBackgroundLight: "rgba(5, 7, 5, 0.96)",
    tabBarBackgroundDark: "rgba(5, 7, 5, 0.96)",
    tabBarInactiveLight: "rgba(141, 170, 147, 0.66)",
    tabBarInactiveDark: "rgba(141, 170, 147, 0.66)",
    navyOverlayLight: "rgba(5, 7, 5, 0.86)",
    navyOverlayDark: "rgba(5, 7, 5, 0.86)",
    brandGradientStart: "#020302",
    brandGradientMid: "#050705",
    brandGradientEnd: "#102015",
    brandOnDarkMuted: "rgba(243, 255, 244, 0.76)",
  },
} as const;

const brand = palettes[ACTIVE_BRAND_PALETTE];

export const Colors = {
  // Core palette
  black: brand.black,
  white: "#FFFFFF",

  // Brand accent. Existing screens still use the green names, so they are
  // treated as compatibility aliases for the active brand palette.
  green: brand.accent,
  greenDark: brand.accentDark,
  greenSoft: brand.accentSoft,
  accent: brand.accent,
  accentDark: brand.accentDark,
  accentSoft: brand.accentSoft,
  onGreen: brand.onAccent,
  onAccent: brand.onAccent,
  greenSurface: systemColor(brand.accentSurfaceLight, brand.accentSurfaceDark),
  greenSurfaceStrong: systemColor(
    brand.accentSurfaceStrongLight,
    brand.accentSurfaceStrongDark,
  ),
  greenBorder: systemColor(brand.accentBorderLight, brand.accentBorderDark),

  // Semantic colors. On iOS these follow the user's light/dark setting.
  navy: systemColor(brand.navyLight, brand.navyDark),
  gold: brand.accent,
  emerald: brand.emerald,
  coral: "#EF4444",
  teal: brand.teal,
  surface: systemColor(brand.surfaceLight, brand.surfaceDark),
  card: systemColor(brand.cardLight, brand.cardDark),
  border: systemColor(brand.borderLight, brand.borderDark),
  muted: systemColor(brand.mutedLight, brand.mutedDark),
  navyMuted: systemColor(brand.navyMutedLight, brand.navyMutedDark),

  // Navy scale
  navy50: systemColor(brand.navy50Light, brand.navy50Dark),
  navy100: systemColor(brand.navy100Light, brand.navy100Dark),
  navy200: systemColor(brand.navy200Light, brand.navy200Dark),
  navy300: systemColor(brand.navy300Light, brand.navy300Dark),
  navy600: brand.navy600,
  navy700: brand.navy700,
  navy800: brand.navy800,
  navy900: brand.navy900,

  // Gold/action scale
  gold50: systemColor(brand.accentSurfaceLight, brand.accentSurfaceDark),
  gold100: systemColor(
    brand.accentSurfaceStrongLight,
    brand.accentSurfaceStrongDark,
  ),
  gold400: brand.accentBright,
  gold500: brand.accent,
  gold600: brand.accentDark,

  // Green/success scale
  emerald50: systemColor(brand.emerald50, brand.emerald50Dark),
  emerald100: systemColor(brand.emerald100, brand.emerald100Dark),
  emerald500: brand.emerald,
  emerald600: brand.emeraldDark,

  // Coral scale
  coral50: "#FEF2F2",
  coral100: "#FEE2E2",
  coral500: "#EF4444",
  coral600: "#DC2626",

  // Amber (warning)
  amber: "#F59E0B",
  amber500: "#F59E0B",

  // Tab bar
  tabBarBackground: systemColor(
    brand.tabBarBackgroundLight,
    brand.tabBarBackgroundDark,
  ),
  tabBarActive: brand.accent,
  tabBarInactive: systemColor(
    brand.tabBarInactiveLight,
    brand.tabBarInactiveDark,
  ),

  // Transparent overlays
  navyOverlay: systemColor(brand.navyOverlayLight, brand.navyOverlayDark),
  goldOverlay: alpha(brand.accentRgb, 0.12),
  blackOverlay: "rgba(0, 0, 0, 0.4)",

  // Brand dark surfaces used by auth/splash/header moments.
  brandGradientStart: brand.brandGradientStart,
  brandGradientMid: brand.brandGradientMid,
  brandGradientEnd: brand.brandGradientEnd,
  brandOnDark: "#FFFFFF",
  brandOnDarkMuted: brand.brandOnDarkMuted,

  // Accent opacity helpers for places that need translucent brand color.
  accentAlpha03: alpha(brand.accentRgb, 0.03),
  accentAlpha05: alpha(brand.accentRgb, 0.05),
  accentAlpha06: alpha(brand.accentRgb, 0.06),
  accentAlpha07: alpha(brand.accentRgb, 0.07),
  accentAlpha08: alpha(brand.accentRgb, 0.08),
  accentAlpha10: alpha(brand.accentRgb, 0.1),
  accentAlpha12: alpha(brand.accentRgb, 0.12),
  accentAlpha14: alpha(brand.accentRgb, 0.14),
  accentAlpha15: alpha(brand.accentRgb, 0.15),
  accentAlpha18: alpha(brand.accentRgb, 0.18),
  accentAlpha20: alpha(brand.accentRgb, 0.2),
  accentAlpha22: alpha(brand.accentRgb, 0.22),
  accentAlpha25: alpha(brand.accentRgb, 0.25),
  accentAlpha30: alpha(brand.accentRgb, 0.3),
  accentAlpha35: alpha(brand.accentRgb, 0.35),
  accentAlpha40: alpha(brand.accentRgb, 0.4),
  accentAlpha45: alpha(brand.accentRgb, 0.45),
} as const;

export type ColorKey = keyof typeof Colors;

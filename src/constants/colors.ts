export const Colors = {
  // Core palette
  navy: "#1B2B4B",
  gold: "#F4A832",
  emerald: "#10B981",
  coral: "#EF4444",
  teal: "#00B4A6",
  surface: "#F8F9FA",
  card: "#FFFFFF",
  border: "#E8EDF5",
  muted: "#8B9CB8",
  navyMuted: "#4A5D7A",

  // Navy scale
  navy50: "#E8EDF5",
  navy100: "#C5D0E3",
  navy200: "#9AAECF",
  navy300: "#6F8CBB",
  navy600: "#1B2B4B",
  navy700: "#152238",
  navy800: "#0E1926",
  navy900: "#070D13",

  // Gold scale
  gold50: "#FEF7EC",
  gold100: "#FDECD0",
  gold400: "#F7B847",
  gold500: "#F4A832",
  gold600: "#E08A10",

  // Emerald scale
  emerald50: "#ECFDF5",
  emerald100: "#D1FAE5",
  emerald500: "#10B981",
  emerald600: "#059669",

  // Coral scale
  coral50: "#FEF2F2",
  coral100: "#FEE2E2",
  coral500: "#EF4444",
  coral600: "#DC2626",

  // Amber (warning)
  amber: "#F59E0B",
  amber500: "#F59E0B",

  // Tab bar
  tabBarBackground: "rgba(27, 43, 75, 0.96)",
  tabBarActive: "#F4A832",
  tabBarInactive: "rgba(139, 156, 184, 0.6)",

  // Transparent overlays
  navyOverlay: "rgba(27, 43, 75, 0.85)",
  goldOverlay: "rgba(244, 168, 50, 0.12)",
  blackOverlay: "rgba(0, 0, 0, 0.4)",
} as const;

export type ColorKey = keyof typeof Colors;

import { DynamicColorIOS, Platform } from "react-native";

const systemColor = (light: string, dark: string) =>
  (Platform.OS === "ios"
    ? DynamicColorIOS({ light, dark })
    : light) as unknown as string;

export const Colors = {
  // Core brand palette: black / white / Budget Buddy green
  black: "#050705",
  white: "#FFFFFF",
  green: "#13D845",
  greenDark: "#08A832",
  greenSoft: "#E9FCEE",
  onGreen: "#021006",
  greenSurface: systemColor("#E9FCEE", "#082313"),
  greenSurfaceStrong: systemColor("#CCF7D5", "#0F351D"),
  greenBorder: systemColor("#A7F3B8", "#145C2B"),

  // Semantic colors. On iOS these follow the user's light/dark setting.
  navy: systemColor("#102015", "#F3FFF4"),
  gold: "#13D845",
  emerald: "#13D845",
  coral: "#EF4444",
  teal: "#13D845",
  surface: systemColor("#F7FAF7", "#050705"),
  card: systemColor("#FFFFFF", "#0C120D"),
  border: systemColor("#E3EDE4", "#1F2D21"),
  muted: systemColor("#6B7F72", "#8DAA93"),
  navyMuted: systemColor("#355141", "#B8D7BF"),

  // Neutral scale
  navy50: systemColor("#EAF5EC", "#122017"),
  navy100: systemColor("#D5E9D9", "#1A2B1F"),
  navy200: systemColor("#AFC8B6", "#2B4231"),
  navy300: systemColor("#7FA08A", "#45624D"),
  navy600: "#0B120D",
  navy700: "#08100A",
  navy800: "#050705",
  navy900: "#020302",

  // Green action scale. Kept under the existing names so screens stay stable.
  gold50: systemColor("#E9FCEE", "#082313"),
  gold100: systemColor("#CCF7D5", "#0F351D"),
  gold400: "#2AF15A",
  gold500: "#13D845",
  gold600: "#08A832",

  // Green scale
  emerald50: systemColor("#E9FCEE", "#082313"),
  emerald100: systemColor("#CCF7D5", "#0F351D"),
  emerald500: "#13D845",
  emerald600: "#08A832",

  // Coral scale
  coral50: "#FEF2F2",
  coral100: "#FEE2E2",
  coral500: "#EF4444",
  coral600: "#DC2626",

  // Amber (warning)
  amber: "#F59E0B",
  amber500: "#F59E0B",

  // Tab bar
  tabBarBackground: "rgba(5, 7, 5, 0.96)",
  tabBarActive: "#13D845",
  tabBarInactive: "rgba(141, 170, 147, 0.66)",

  // Transparent overlays
  navyOverlay: "rgba(5, 7, 5, 0.86)",
  goldOverlay: "rgba(19, 216, 69, 0.12)",
  blackOverlay: "rgba(0, 0, 0, 0.4)",
} as const;

export type ColorKey = keyof typeof Colors;

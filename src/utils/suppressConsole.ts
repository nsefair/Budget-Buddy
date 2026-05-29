/**
 * Console noise filter — imported FIRST in index.ts, before expo-router.
 *
 * A few warnings come from dependencies we don't control and have no user
 * impact. The most stubborn one is expo-router itself, which renders the
 * deprecated React Native `SafeAreaView` in its built-in dev views (Toast,
 * Navigator, ErrorBoundary…). That warning fires while those modules load —
 * earlier than any app screen — so it must be silenced here at the entry
 * point, before expo-router is required. LogBox alone can't do this because
 * it only hides the in-app overlay, not the Metro terminal output.
 *
 * Only these exact messages are dropped; every other log passes through.
 */

import { LogBox } from "react-native";

export const IGNORED_WARNINGS = [
  "SafeAreaView has been deprecated",
  "Cannot record touch move without a touch start",
  "Sending `onAnimatedValueUpdate` with no listeners registered",
];

LogBox.ignoreLogs(IGNORED_WARNINGS);

const isIgnored = (arg: unknown) =>
  typeof arg === "string" && IGNORED_WARNINGS.some((p) => arg.includes(p));

const originalWarn = console.warn.bind(console);
console.warn = (...args: unknown[]) => {
  if (isIgnored(args[0])) return;
  originalWarn(...args);
};

const originalError = console.error.bind(console);
console.error = (...args: unknown[]) => {
  if (isIgnored(args[0])) return;
  originalError(...args);
};

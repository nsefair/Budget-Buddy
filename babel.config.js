/**
 * Babel config — Expo SDK 54 + NativeWind v4.
 *
 * Note: react-native-reanimated's plugin is intentionally NOT included.
 * The app uses React Native's built-in `Animated` API (works in Expo Go).
 * If/when we move to a dev build and adopt reanimated, also install
 * `react-native-worklets` and add `"react-native-worklets/plugin"` last.
 */
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      // NativeWind v4: jsxImportSource handles the CSS interop — no separate plugin
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
    ],
    plugins: [],
  };
};

/**
 * Babel config — Expo SDK 54 + NativeWind v4 + Reanimated 4 (Moti).
 *
 * Plugin order matters:
 *   1. babel-preset-expo (presets array)
 *   2. ...any other plugins
 *   3. react-native-worklets/plugin → MUST be last
 *
 * The worklets plugin powers both `react-native-reanimated` and `moti`.
 * It works in Expo Go (SDK 54 bundles the runtime) and in dev/release builds.
 *
 * After editing this file: stop Metro and start with `--clear` so the new
 * transforms are picked up.
 */
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      // NativeWind v4: jsxImportSource handles the CSS interop — no separate plugin
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
    ],
    plugins: ["react-native-worklets/plugin"],
  };
};

/**
 * Babel config — Expo + Reanimated 4 (Moti).
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
    // No NativeWind JSX interop: the app styles with StyleSheet only, and the
    // interop silently dropped Pressable style callbacks ({ pressed }) => [...].
    presets: ["babel-preset-expo"],
    plugins: ["react-native-worklets/plugin"],
  };
};

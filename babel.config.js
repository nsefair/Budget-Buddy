module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      // NativeWind v4: jsxImportSource handles the CSS interop — no separate plugin needed
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
    ],
    plugins: [
      // Reanimated must always be last
      "react-native-reanimated/plugin",
    ],
  };
};

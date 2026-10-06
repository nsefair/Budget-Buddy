const activePalette =
  process.env.EXPO_PUBLIC_BRAND_PALETTE?.trim().toLowerCase() === "orange"
    ? "orange"
    : "green";

const brandAssets = {
  orange: {
    icon: "./assets/icon-orange.png",
    adaptiveIcon: "./assets/adaptive-icon-orange.png",
    favicon: "./assets/favicon-orange.png",
    splashIcon: "./assets/splash-icon-orange.png",
    adaptiveBackground: "#F4A832",
    splashBackground: "#070D13",
  },
  green: {
    icon: "./assets/icon-green.png",
    adaptiveIcon: "./assets/adaptive-icon-green.png",
    favicon: "./assets/favicon-green.png",
    splashIcon: "./assets/splash-icon-green.png",
    adaptiveBackground: "#0A0A0A",
    splashBackground: "#050705",
  },
};

module.exports = ({ config }) => {
  const assets = brandAssets[activePalette];
  const base = config;

  return {
    ...base,
    ios: {
      ...base.ios,
      // A Personal Team needs its own identifier; production keeps app.json's ID.
      bundleIdentifier: process.env.BUDGET_BUDDY_IOS_BUNDLE_ID || base.ios.bundleIdentifier,
      appleTeamId: process.env.BUDGET_BUDDY_IOS_TEAM || base.ios.appleTeamId,
    },
    icon: assets.icon,
    plugins: base.plugins.map((plugin) =>
      Array.isArray(plugin) && plugin[0] === "expo-splash-screen"
        ? [plugin[0], { ...plugin[1], image: assets.splashIcon, backgroundColor: assets.splashBackground }]
        : plugin,
    ),
    android: {
      ...base.android,
      adaptiveIcon: {
        ...base.android.adaptiveIcon,
        foregroundImage: assets.adaptiveIcon,
        backgroundColor: assets.adaptiveBackground,
      },
    },
    web: {
      ...base.web,
      favicon: assets.favicon,
    },
    extra: {
      ...base.extra,
      eas: {
        ...base.extra?.eas,
        projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID || base.extra?.eas?.projectId,
      },
    },
  };
};

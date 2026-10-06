const { withEntitlementsPlist } = require("expo/config-plugins");

// Opt in only on Macs using a free Personal Team. Paid beta builds retain APNs.
// Register before expo-notifications: Expo evaluates these mods in reverse order.
module.exports = function withPersonalTeamIos(config) {
  if (process.env.BUDGET_BUDDY_PERSONAL_TEAM !== "1") return config;
  return withEntitlementsPlist(config, (config) => {
    delete config.modResults["aps-environment"];
    return config;
  });
};

const { withPodfile } = require("expo/config-plugins");

// React Native raises library targets, but leaves some resource bundles behind.
// Xcode 27 rejects those old targets even though the app already requires 15.1.
module.exports = function withMinimumIosPodTarget(config) {
  return withPodfile(config, (config) => {
    const marker = "# Budget Buddy: align pod resource bundles with the app minimum";
    if (config.modResults.contents.includes(marker)) return config;

    const anchor = "post_install do |installer|";
    if (!config.modResults.contents.includes(anchor)) {
      throw new Error("Cannot configure iOS pod targets: post_install hook not found.");
    }
    config.modResults.contents = config.modResults.contents.replace(
      anchor,
      `${anchor}
    ${marker}
    minimum_ios = Gem::Version.new(podfile_properties['ios.deploymentTarget'] || '15.1')
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |build_config|
        current_ios = build_config.build_settings['IPHONEOS_DEPLOYMENT_TARGET']
        if current_ios && Gem::Version.new(current_ios) < minimum_ios
          build_config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = minimum_ios.to_s
        end
      end
    end
`
    );
    return config;
  });
};

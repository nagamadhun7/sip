const { withAndroidManifest } = require("expo/config-plugins");
// Play purchase verification may leave the Activity; singleTop preserves the result.
module.exports = function withPurchaseLaunchMode(config) {
  return withAndroidManifest(config, (result) => {
    const app = result.modResults.manifest.application?.[0];
    const main = app?.activity?.find(
      (a) => a.$["android:name"] === ".MainActivity",
    );
    if (main) main.$["android:launchMode"] = "singleTop";
    return result;
  });
};

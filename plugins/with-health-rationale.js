const { withMainActivity } = require("expo/config-plugins");

function routeRationale(source) {
  if (source.includes("private fun sipHealthRationale")) return source;
  const create = /override fun onCreate\(savedInstanceState: Bundle\?\)\s*\{/;
  if (!create.test(source))
    throw Error("Cannot install Health privacy routing: onCreate not found.");
  source = source.replace(create, "$&\n    sipHealthRationale(intent)");
  const incoming =
    /override fun onNewIntent\(intent: (?:android\.content\.)?Intent\)\s*\{/;
  if (incoming.test(source)) {
    source = source.replace(incoming, "$&\n    sipHealthRationale(intent)");
  } else {
    const end = source.lastIndexOf("}");
    source =
      source.slice(0, end) +
      `
  override fun onNewIntent(intent: android.content.Intent) {
    sipHealthRationale(intent)
    super.onNewIntent(intent)
    setIntent(intent)
  }
` +
      source.slice(end);
  }
  const end = source.lastIndexOf("}");
  return (
    source.slice(0, end) +
    `
  private fun sipHealthRationale(incoming: android.content.Intent?) {
    if (incoming?.action == "androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE" ||
        incoming?.action == "android.intent.action.VIEW_PERMISSION_USAGE") {
      incoming.action = android.content.Intent.ACTION_VIEW
      incoming.data = android.net.Uri.parse("sip://privacy")
    }
  }
` +
    source.slice(end)
  );
}

module.exports = function withHealthRationale(config) {
  return withMainActivity(config, (result) => {
    if (result.modResults.language !== "kt")
      throw Error("Health privacy routing requires Kotlin MainActivity.");
    result.modResults.contents = routeRationale(result.modResults.contents);
    return result;
  });
};
module.exports.routeRationale = routeRationale;

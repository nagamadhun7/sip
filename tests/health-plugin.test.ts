import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const { routeRationale } = createRequire(import.meta.url)(
  "../plugins/with-health-rationale.js",
);

test("Health permission privacy opens the existing privacy route on cold and warm launch", () => {
  const source =
    "class MainActivity { override fun onCreate(savedInstanceState: Bundle?) { super.onCreate(null) } }";
  const result = routeRationale(source);
  assert.match(result, /onCreate[^]*sipHealthRationale\(intent\)/);
  assert.match(result, /onNewIntent[^]*sipHealthRationale\(intent\)/);
  assert.match(result, /sip:\/\/privacy/);
  assert.equal(routeRationale(result), result);
});

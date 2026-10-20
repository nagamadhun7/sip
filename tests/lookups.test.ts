import { test } from "node:test";
import assert from "node:assert/strict";
import { parseUSDA } from "../src/lib/usda.ts";
import { lookupBarcode, parseProduct } from "../src/lib/barcode.ts";
const food = {
  gtinUpc: "0123456789012",
  description: "Juice",
  servingSize: 250,
  servingSizeUnit: "ml",
  labelNutrients: {
    sugars: { value: 20 },
    calories: { value: 100 },
    sodium: { value: 10 },
  },
};
test("USDA uses exact barcode and measured ml label serving; absent nutrients stay not listed", () => {
  const d = parseUSDA("0123456789012", food)!;
  assert.equal(d.nutrition.sugar, 8);
  assert.equal(d.nutrition.sodium, 4);
  assert.equal(d.nutrition.caffeine, null);
  assert.equal(d.serving, 250);
  assert.equal(parseUSDA("9999999999999", food), null);
  assert.equal(
    parseUSDA("0123456789012", { ...food, servingSizeUnit: "g" }),
    null,
  );
});
test("a missing OFF serving is not replaced with a fabricated portion", () => {
  assert.equal(
    parseProduct("12345678", {
      categories_tags: ["en:beverages"],
      nutriments: {},
    }).serving,
    0,
  );
});
test("OFF is first, then exact configured fallback, and successful OFF avoids fallback", async (t) => {
  let calls = 0;
  const fallback = async () => {
    calls++;
    return parseUSDA("0123456789012", food);
  };
  t.mock.method(globalThis, "fetch", async () => Response.json({ status: 0 }));
  const d = await lookupBarcode("0123456789012", undefined, fallback);
  assert.equal(d?.name, "Juice");
  assert.equal(calls, 1);
});
test("fallback failure is not retried silently", async (t) => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => Response.json({ status: 0 }));
  await assert.rejects(
    lookupBarcode("0123456789012", undefined, async () => {
      calls++;
      throw Error("not configured");
    }),
  );
  assert.equal(calls, 1);
});

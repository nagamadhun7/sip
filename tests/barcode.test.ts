import { test } from "node:test";
import assert from "node:assert/strict";
import { parseProduct } from "../src/lib/barcode.ts";
test("barcode product normalizes grams to milligrams and leaves absent fields unknown", () => {
  const d = parseProduct("12345678", {
    product_name: "Coffee drink",
    categories_tags: ["en:beverages"],
    serving_size: "330 ml",
    nutriments: { sugars_100g: 5, caffeine_100g: 0.03, sodium_100g: 0.02 },
  });
  assert.equal(d.serving, 330);
  assert.equal(d.nutrition.caffeine, 30);
  assert.equal(d.nutrition.sodium, 20);
  assert.equal(d.nutrition.potassium, null);
  assert.equal(d.nutrition.calories, null);
});
test("non-drinks do not silently become volume-based drinks", () => {
  assert.throws(() =>
    parseProduct("12345678", {
      product_name: "Bread",
      categories_tags: ["en:breads"],
      nutriments: {},
    }),
  );
});
test("serving volume units are normalized", () => {
  assert.equal(
    parseProduct("12345678", {
      product_quantity_unit: "l",
      serving_size: "0.5 l",
      nutriments: {},
    }).serving,
    500,
  );
});

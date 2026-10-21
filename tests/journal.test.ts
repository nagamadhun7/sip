import test from "node:test";
import assert from "node:assert/strict";
import { parseLocal } from "../src/logging/parse.ts";
import {
  reviewRows,
  reviewEntries,
  nutrientBreakdown,
} from "../src/logging/review.ts";
import { totals } from "../src/lib/model.ts";
import type { Drink } from "../src/lib/model.ts";
const coffee: Drink = {
  id: "coffee",
  name: "Coffee",
  color: "#aaa",
  serving: 240,
  source: "Test label",
  nutrition: {
    sugar: 2,
    caffeine: 40,
    calories: 9,
    sodium: null,
    potassium: null,
  },
};
const now = new Date();
test("notes-style multiline input keeps separate portions of the same drink", () => {
  const parsed = parseLocal("100 ml coffee\n250 ml coffee", [coffee], [], now)!;
  assert.deepEqual(
    parsed.map((p) => p.amount_ml),
    [100, 250],
  );
  const rows = reviewRows(parsed, "ml");
  rows[1].portion = "300";
  let id = 0;
  const entries = reviewEntries(rows, [coffee], "ml", () => String(++id));
  assert.deepEqual(
    entries.map((e) => e.ml),
    [100, 300],
  );
  assert.equal(totals(entries).caffeine, 160);
  entries[1].drink.nutrition.caffeine = 9;
  assert.equal(entries[0].drink.nutrition.caffeine, 40);
  assert.equal(coffee.nutrition.caffeine, 40);
});
test("removing a match excludes it and ounce edits use the real volume conversion", () => {
  const rows = reviewRows(
    [{ drink_id: "coffee", amount_ml: 100, at: now.toISOString() }],
    "oz",
  );
  assert.equal(reviewEntries(rows, [coffee], "oz", () => "unchanged")[0].ml, 100);
  rows[0].portion = "8";
  const entry = reviewEntries(rows, [coffee], "oz", () => "a")[0];
  assert.equal(entry.ml, 8 * 29.5735295625);
  assert.throws(() => reviewEntries([], [coffee], "ml", () => "a"));
});
test("review rejects invalid portions and preserves unknown nutrients", () => {
  const row = reviewRows(
    [{ drink_id: "coffee", amount_ml: 100, at: now.toISOString() }],
    "ml",
  )[0];
  for (const portion of ["", "NaN", "-5", "0", "10001"]) {
    assert.throws(() =>
      reviewEntries([{ ...row, portion }], [coffee], "ml", () => "a"),
    );
  }
  assert.equal(nutrientBreakdown(coffee, 250, "caffeine")?.amount, 100);
  assert.equal(nutrientBreakdown(coffee, 250, "sodium"), null);
  assert.equal(
    nutrientBreakdown(
      { ...coffee, missingNutrition: ["caffeine"] },
      250,
      "caffeine",
    ),
    null,
  );
});

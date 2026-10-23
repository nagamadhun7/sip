import { test } from "node:test";
import assert from "node:assert/strict";
import {
  totals,
  validateEntry,
  caffeineNow,
  onDay,
  localDay,
  lastDays,
  exportCsv,
} from "../src/lib/model.ts";
import type { Entry } from "../src/lib/model.ts";
const entry: Entry = {
  id: "a",
  ml: 250,
  at: "2026-10-19T12:00:00.000Z",
  drink: {
    id: "coffee",
    name: "Coffee",
    color: "#aaa",
    serving: 250,
    source: "Test",
    nutrition: {
      sugar: 2,
      caffeine: 40,
      calories: 10,
      sodium: null,
      potassium: 20,
    },
  },
};
test("nutrition scales to amount and unknown nutrients stay incomplete", () => {
  const sum = totals([entry]);
  assert.equal(sum.water, 250);
  assert.equal(sum.caffeine, 100);
  assert.equal(sum.sugar, 5);
  assert.equal(sum.missing.sodium, 1);
  assert.equal(sum.missing.sugar, 0);
});
test("edit replaces an amount and delete removes its contribution", () => {
  assert.equal(totals([{ ...entry, ml: 100 }]).caffeine, 40);
  assert.equal(totals([]).water, 0);
});
test("validation rejects impossible records and unknown is allowed", () => {
  assert.doesNotThrow(() => validateEntry(entry));
  for (const ml of [0, -1, NaN, 10001])
    assert.throws(() => validateEntry({ ...entry, ml }));
  assert.throws(() => validateEntry({ ...entry, at: "invalid" }));
  assert.throws(() =>
    validateEntry({
      ...entry,
      at: new Date(Date.now() + 3600000).toISOString(),
    }),
  );
  assert.throws(() =>
    validateEntry({
      ...entry,
      drink: {
        ...entry.drink,
        nutrition: { ...entry.drink.nutrition, sugar: -1 },
      },
    }),
  );
});
test("caffeine halves after five hours and ignores future records", () => {
  assert.equal(caffeineNow([entry], Date.parse(entry.at) + 5 * 3600000), 50);
  assert.equal(caffeineNow([entry], Date.parse(entry.at) - 1), 0);
});
test("daily grouping uses device local calendar dates", () => {
  const date = new Date(2026, 9, 19, 23, 59);
  assert.equal(localDay(date), "2026-10-19");
  assert.equal(
    onDay([{ ...entry, at: date.toISOString() }], "2026-10-19").length,
    1,
  );
  assert.equal(lastDays(7, new Date(2026, 9, 19)).at(-1), "2026-10-19");
  assert.equal(lastDays(7, new Date(2026, 9, 19))[0], "2026-10-13");
});
test("CSV escapes quoted names and preserves missing values", () => {
  const csv = exportCsv([
    { ...entry, drink: { ...entry.drink, name: 'Coffee, "iced"' } },
  ]);
  assert.match(csv, /"Coffee, ""iced"""/);
  assert.match(csv, /"100"/);
  assert.match(csv, /"",/);
});
test("CSV neutralizes spreadsheet formulas in drink names", () => {
  assert.match(
    exportCsv([{ ...entry, drink: { ...entry.drink, name: "=1+1" } }]),
    /"'=1\+1"/,
  );
});

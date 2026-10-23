import { test } from "node:test";
import assert from "node:assert/strict";
import {
  monthDays,
  findHistory,
  periodTrend,
  pinnedDrinks,
} from "../src/features/history.ts";
import type { Entry } from "../src/lib/model.ts";
const entry: Entry = {
  id: "one",
  at: new Date(2026, 9, 23, 10).toISOString(),
  ml: 250,
  drink: {
    id: "water",
    name: "Water",
    source: "Label",
    color: "#6FAEE8",
    serving: 250,
    nutrition: {
      sugar: 0,
      caffeine: null,
      calories: 0,
      sodium: null,
      potassium: null,
    },
  },
};
test("calendar handles leap years and invalid months", () => {
  assert.equal(monthDays("2024-02").length, 29);
  assert.equal(monthDays("2026-02").length, 28);
  assert.throws(() => monthDays("2026-13"));
});
test("history searches names and local dates without changing records", () => {
  assert.deepEqual(findHistory([entry], "WATER"), [entry]);
  assert.equal(findHistory([entry], "2026-10-23").length, 1);
  assert.equal(findHistory([entry], "coffee").length, 0);
  assert.equal(entry.ml, 250);
});
test("trends count calendar days, preserve missing nutrients, exclude future and old logs", () => {
  const old = {
    ...entry,
    id: "old",
    at: new Date(2026, 8, 1, 10).toISOString(),
  };
  const future = {
    ...entry,
    id: "future",
    at: new Date(2026, 9, 24, 10).toISOString(),
  };
  const t = periodTrend([entry, old, future], 7, new Date(2026, 9, 23, 12));
  assert.equal(t.volume, 250);
  assert.equal(t.dailyAverage, 250 / 7);
  assert.equal(t.recordedDays, 1);
  assert.equal(t.missing.caffeine, 1);
  assert.equal(t.entries, 1);
});
test("favorites preserve pin order, deduplicate and omit deleted or invalid portions", () => {
  assert.deepEqual(pinnedDrinks(["gone", "water", "water"], [entry.drink]), [
    entry.drink,
  ]);
  assert.equal(
    pinnedDrinks(["water"], [{ ...entry.drink, serving: 0 }]).length,
    0,
  );
});

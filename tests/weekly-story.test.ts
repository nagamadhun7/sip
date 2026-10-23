import { test } from "node:test";
import assert from "node:assert/strict";
import { weeklyStory } from "../src/features/weekly-story.ts";
import { defaults } from "../src/lib/model.ts";
import type { Entry } from "../src/lib/model.ts";
const e = (
  day: number,
  id: string,
  ml: number,
  caffeine: number | null = 0,
  sugar: number | null = 0,
  added: number | null = 0,
): Entry => ({
  id: `${day}-${id}-${ml}`,
  at: new Date(2026, 9, day, 10).toISOString(),
  ml,
  drink: {
    id,
    name: id,
    serving: ml,
    color: "#6FAEE8",
    source: "Test label",
    nutrition: { sugar, caffeine, calories: 0, sodium: 0, potassium: 0 },
    extraNutrition: { added_sugar: added },
  },
});
const end = new Date(2026, 9, 23, 18);
test("story ranks real log counts and compares adjacent seven-day windows", () => {
  const story = weeklyStory(
    [
      e(23, "water", 500),
      e(22, "water", 500),
      e(21, "coffee", 100, 100, 5, 3),
      e(16, "coffee", 100, 50, 10, 8),
    ],
    { ...defaults, water: 1000 },
    end,
  );
  assert.deepEqual(story.days, [
    "2026-10-17",
    "2026-10-18",
    "2026-10-19",
    "2026-10-20",
    "2026-10-21",
    "2026-10-22",
    "2026-10-23",
  ]);
  assert.equal(story.topDrinks[0].id, "water");
  assert.equal(story.topDrinks[0].count, 2);
  assert.equal(story.changes.caffeine.delta, 50);
  assert.equal(story.changes.sugar.delta, -5);
  assert.equal(story.changes.added_sugar.delta, -5);
  assert.equal(story.recordedDays, 3);
  assert.equal(story.previousRecordedDays, 1);
});
test("closest hydration day matches the goal instead of rewarding the most fluid", () => {
  const story = weeklyStory(
    [e(20, "water", 1000), e(21, "water", 3000)],
    { ...defaults, water: 1000 },
    end,
  );
  assert.equal(story.closestDay?.day, "2026-10-20");
  assert.equal(story.closestDay?.fluid, 1000);
});
test("missing values and absent weeks never become invented improvements", () => {
  const missing = weeklyStory(
    [e(23, "coffee", 100, null, null, null), e(16, "coffee", 100, 100, 10, 5)],
    defaults,
    end,
  );
  assert.equal(missing.changes.caffeine.delta, null);
  assert.equal(missing.changes.sugar.reason, "missing-nutrients");
  assert.equal(missing.changes.added_sugar.delta, null);
  const noPast = weeklyStory([e(23, "water", 100)], defaults, end);
  assert.equal(noPast.changes.caffeine.reason, "no-previous-data");
  assert.equal(noPast.changes.caffeine.delta, null);
  const empty = weeklyStory([], defaults, end);
  assert.equal(empty.entries, 0);
  assert.equal(empty.closestDay, null);
  assert.deepEqual(empty.topDrinks, []);
});
test("zero baseline uses an absolute change and future logs are excluded", () => {
  const future = e(24, "coffee", 100, 200);
  const story = weeklyStory(
    [e(16, "water", 100), e(23, "coffee", 100, 100), future],
    defaults,
    end,
  );
  assert.equal(story.changes.caffeine.previous, 0);
  assert.equal(story.changes.caffeine.delta, 100);
  assert.equal(story.entries, 1);
});

test("completed historical weeks include evening logs on their final day", () => {
  const late = e(16, "coffee", 100, 50);
  late.at = new Date(2026, 9, 16, 23).toISOString();
  const historical = weeklyStory(
    [late],
    defaults,
    new Date(2026, 9, 16, 12),
    true,
  );
  assert.equal(historical.entries, 1);
  assert.equal(historical.changes.caffeine.current, 50);
});

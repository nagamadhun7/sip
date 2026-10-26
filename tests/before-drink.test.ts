import test from "node:test";
import assert from "node:assert/strict";
import { beforeDrink } from "../src/features/before-drink.ts";
import { defaults, type Drink, type Entry } from "../src/lib/model.ts";
import { initialGoals } from "../src/features/drink-goals.ts";
const now = new Date(2026, 9, 26, 17),
  settings = { ...defaults, bedtime: "22:00", sugar: 25, caffeine: 200 };
const drink = (
  caffeine: number | null = 100,
  sugar: number | null = 0,
): Drink => ({
  id: "test",
  name: "Test",
  serving: 100,
  color: "#000",
  source: "Test fixture",
  nutrition: { caffeine, sugar, calories: 20, sodium: 10, potassium: null },
});
const entry = (at: Date, d = drink(), ml = 100): Entry => ({
  id: at.toISOString(),
  at: at.toISOString(),
  drink: d,
  ml,
});
const earlier = entry(new Date(2026, 9, 26, 12));
test("bedtime projection combines actual previous doses and the selected portion with five-hour decay", () => {
  const c = beforeDrink(drink(), 100, [earlier], settings, now);
  assert.equal(c.baseline, 25);
  assert.equal(c.drinkAtBedtime, 50);
  assert.equal(c.atBedtime, 75);
  assert.equal(c.dose, 100);
  assert.equal(
    beforeDrink(drink(), 50, [earlier], settings, now).atBedtime,
    50,
  );
});
test("sugar percentage uses actual logs and selected volume", () => {
  const c = beforeDrink(
    drink(0, 6.25),
    200,
    [entry(new Date(2026, 9, 26, 12), drink(0, 10))],
    settings,
    now,
  );
  const sugar = c.limits.find((p) => p.key === "total_sugar")!;
  assert.equal(sugar.after, 22.5);
  assert.equal(sugar.percent, 90);
  assert.equal(sugar.left, 2.5);
});
test("added sugar ceiling takes priority over the separate total-sugar reference", () => {
  const s = {
    ...settings,
    drinkGoals: initialGoals(settings).map((g) =>
      g.key === "added_sugar" ? { ...g, amount: 10 } : g,
    ),
  };
  const c = beforeDrink(
    { ...drink(0, 12), extraNutrition: { added_sugar: 4 } },
    200,
    [],
    s,
    now,
  );
  assert.equal(c.limits.find((p) => p.key === "added_sugar")?.percent, 80);
  assert.equal(
    c.limits.some((p) => p.key === "total_sugar"),
    false,
  );
});
test("missing label values and incomplete history never claim an exact percentage or remaining allowance", () => {
  const c = beforeDrink(
    drink(null, null),
    100,
    [{ ...earlier, drink: drink(null, null) }],
    settings,
    now,
  );
  assert.equal(c.atBedtime, null);
  assert.equal(c.drinkAtBedtime, null);
  assert.equal(c.missing, 1);
  const s = c.limits.find((p) => p.key === "total_sugar")!;
  assert.equal(s.after, null);
  assert.equal(s.left, null);
  const incomplete = beforeDrink(
    drink(0, 10),
    100,
    [{ ...earlier, drink: drink(0, null) }],
    settings,
    now,
  ).limits.find((p) => p.key === "total_sugar")!;
  assert.equal(incomplete.incomplete, true);
  assert.equal(incomplete.left, null);
});
test("zero limits do not divide by zero and over-limit values stay visible", () => {
  const c = beforeDrink(
    drink(100, 10),
    100,
    [],
    { ...settings, caffeine: 0, sugar: 0 },
    now,
  );
  assert.equal(c.limits.find((p) => p.key === "caffeine")?.percent, null);
  assert.equal(c.limits.find((p) => p.key === "caffeine")?.left, -100);
});
test("after bedtime uses the next bedtime, includes old carryover, and excludes future logs", () => {
  const late = new Date(2026, 9, 26, 23),
    old = entry(new Date(2026, 9, 25, 22), drink(200));
  const c = beforeDrink(
    drink(),
    100,
    [old, entry(new Date(2026, 9, 27, 2))],
    settings,
    late,
  );
  assert.equal(new Date(c.bedtime).getDate(), 27);
  assert.ok(c.baseline > 0 && c.baseline < 1);
  assert.equal(c.missing, 0);
  assert.ok(c.drinkAtBedtime! > 0 && c.drinkAtBedtime! < 10);
});
test("cut-back and user-entered medical limits are used without inventing new thresholds", () => {
  const s = {
    ...settings,
    cutback: {
      started: "2026-10-20",
      baseline: 150,
      goal: 50,
      steps: 1,
      completed: [],
    },
    profile: {
      age: 30,
      weight_kg: 65,
      sex: "female" as const,
      status: "medical" as const,
    },
  };
  assert.equal(
    beforeDrink(drink(), 100, [], s, now).limits.find(
      (p) => p.key === "caffeine",
    )?.limit,
    125,
  );
});
test("invalid portions and edited invalid nutrient inputs are rejected without NaN previews", () => {
  assert.throws(() => beforeDrink(drink(), NaN, [], settings, now));
  assert.throws(() => beforeDrink(drink(), 0, [], settings, now));
  assert.throws(() => beforeDrink(drink(NaN), 100, [], settings, now));
  assert.throws(() =>
    beforeDrink(
      { ...drink(), extraNutrition: { added_sugar: -1 } },
      100,
      [],
      settings,
      now,
    ),
  );
});

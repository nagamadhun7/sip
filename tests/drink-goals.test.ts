import { test } from "node:test";
import assert from "node:assert/strict";
import {
  initialGoals,
  goalsForSettings,
  validateGoals,
  drinkDayTotals,
  goalStatus,
  caffeineTiming,
} from "../src/features/drink-goals.ts";
import { defaults, validateEntry } from "../src/lib/model.ts";
import type { Entry } from "../src/lib/model.ts";
const entry = (
  id: string,
  ml: number,
  nutrition: Partial<Entry["drink"]["nutrition"]> = {},
  extra: Entry["drink"]["extraNutrition"] = {},
): Entry => ({
  id,
  ml,
  at: new Date(2026, 9, 23, 18).toISOString(),
  drink: {
    id,
    name: id,
    color: "#6FAEE8",
    source: "Test label",
    serving: 250,
    nutrition: {
      sugar: 0,
      caffeine: 0,
      calories: 0,
      sodium: 0,
      potassium: 0,
      ...nutrition,
    },
    extraNutrition: extra,
  },
});
test("migration preserves existing fluid/total-sugar settings without relabelling them as plain water or added sugar", () => {
  const goals = initialGoals(defaults);
  validateGoals(goals);
  assert.equal(goals.find((g) => g.key === "plain_water")!.amount, null);
  assert.equal(goals.find((g) => g.key === "added_sugar")!.amount, null);
  assert.equal(
    goals.find((g) => g.key === "caffeine")!.amount,
    defaults.caffeine,
  );
  assert.equal(goals.find((g) => g.key === "potassium")!.kind, "target");
  assert.throws(() =>
    validateGoals(
      goals.map((g) => (g.key === "plain_water" ? { ...g, amount: 0 } : g)),
    ),
  );
});
test("plain water and total fluid are distinct; nutrients scale per 100ml and natural sugar is separate", () => {
  const data = drinkDayTotals(
    [
      entry("water", 250),
      entry(
        "milk",
        200,
        { sugar: 5 },
        { added_sugar: 0, calcium: 120, vitamin_d: 1 },
      ),
      entry("coffee", 100, { caffeine: 40 }, { added_sugar: 0 }),
    ],
    defaults,
  );
  assert.equal(data.plainWater, 250);
  assert.equal(data.totalFluid, 550);
  assert.equal(data.values.added_sugar.amount, 0);
  assert.equal(data.values.calcium.amount, 240);
  assert.equal(data.values.calcium.missing, 2);
  assert.equal(data.naturalSugar.amount, 10);
  assert.equal(data.values.caffeine.amount, 40);
});
test("old entries keep unknown added sugar unknown and goal labels do not promise remaining allowance", () => {
  const t = drinkDayTotals([entry("juice", 300, { sugar: 9 })], defaults);
  assert.equal(t.values.added_sugar.amount, null);
  assert.equal(t.naturalSugar.amount, null);
  const g = {
    ...initialGoals(defaults).find((g) => g.key === "added_sugar")!,
    amount: 10,
  };
  assert.equal(goalStatus(g, t.values.added_sugar), "Not listed");
  assert.match(
    goalStatus(g, { amount: 12, missing: 1 }),
    /At least 2 g over limit/,
  );
  assert.match(goalStatus(g, { amount: 5, missing: 0 }), /5 g left/);
});
test("custom drinks reject added sugar above total sugar and sweetened plain-water classification", () => {
  assert.throws(() =>
    validateEntry(entry("custom", 250, { sugar: 3 }, { added_sugar: 4 })),
  );
  assert.throws(() =>
    validateEntry({
      ...entry("custom", 250, { sugar: 3 }),
      drink: {
        ...entry("custom", 250, { sugar: 3 }).drink,
        fluidType: "plain-water",
      },
    }),
  );
});
test("alcohol uses recorded ABV and the user's standard drink definition", () => {
  const e = entry("beer", 330);
  e.drink.alcohol_abv = 5;
  const t = drinkDayTotals([e], defaults);
  assert.ok(
    Math.abs(t.values.alcohol.amount! - (330 * 0.05 * 0.789) / 14) < 1e-8,
  );
  e.drink.alcohol_abv = undefined;
  assert.equal(drinkDayTotals([e], defaults).values.alcohol.amount, null);
});
test("caffeine hint uses real latest time, bedtime cutoff, and still warns after bedtime", () => {
  const e = entry("coffee", 200, { caffeine: 50 });
  const settings = { ...defaults, bedtime: "22:00" };
  const timing = caffeineTiming([e], settings, new Date(2026, 9, 23, 23))!;
  assert.equal(timing.at, e.at);
  assert.equal(timing.lateMg, 100);
  assert.equal(new Date(timing.cutoff).getHours(), 16);
  assert.equal(caffeineTiming([], settings), null);
});
test("legacy caffeine changes remain synchronized without erasing new goals", () => {
  const goals = initialGoals(defaults).map((g) =>
    g.key === "added_sugar" ? { ...g, amount: 15 } : g,
  );
  const merged = goalsForSettings({
    ...defaults,
    caffeine: 180,
    drinkGoals: goals,
  });
  assert.equal(merged.find((g) => g.key === "caffeine")!.amount, 180);
  assert.equal(merged.find((g) => g.key === "added_sugar")!.amount, 15);
});

import { usdaCatalog } from "../src/data/usda-catalog.ts";
test("bundled USDA catalog uses real IDs, measured ml servings and preserves printed added sugar", () => {
  assert.ok(usdaCatalog.length >= 5);
  assert.ok(
    usdaCatalog.every(
      (d) => d.source.includes("USDA FoodData Central #") && d.serving > 0,
    ),
  );
  const milk = usdaCatalog.find((d) => d.source.includes("#2485416"))!;
  assert.equal(milk.serving, 240);
  assert.ok(
    Math.abs(milk.extraNutrition!.added_sugar! - (11 * 100) / 240) < 1e-8,
  );
  assert.equal(milk.extraNutrition?.calcium, 125);
  assert.equal(milk.extraNutrition?.vitamin_d, null);
});

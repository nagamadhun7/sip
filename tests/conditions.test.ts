import test from "node:test";
import assert from "node:assert/strict";
import { applyHelper, goalFluid } from "../src/features/conditions.ts";
import { defaults, localDay, type Entry } from "../src/lib/model.ts";
import {
  goalsForSettings,
  drinkDayTotals,
  validateGoals,
} from "../src/features/drink-goals.ts";
const row = (calories: number | null, ml = 100): Entry => ({
  id: String(calories),
  at: new Date().toISOString(),
  ml,
  drink: {
    id: "test",
    name: "Test",
    color: "#000",
    serving: 100,
    source: "test",
    nutrition: {
      calories,
      sugar: 0,
      caffeine: 0,
      potassium: null,
      sodium: null,
    },
    extraNutrition: { carbs: 12 },
  },
});
test("helpers lower pregnancy caffeine without raising an existing lower limit", () => {
  assert.equal(applyHelper(defaults, "pregnancy").caffeine, 200);
  assert.equal(
    applyHelper({ ...defaults, caffeine: 80 }, "pregnancy").caffeine,
    80,
  );
  assert.equal(applyHelper(defaults, "diabetes").water, defaults.water);
});
test("kidney uses a blank editable potassium ceiling; no invented allowance", () => {
  const s = applyHelper(defaults, "kidney");
  const goals = goalsForSettings(s);
  validateGoals(goals);
  assert.equal(goals.find((g) => g.key === "potassium")?.kind, "limit");
  assert.equal(goals.find((g) => g.key === "potassium")?.amount, null);
  const edited = {
    ...s,
    drinkGoals: goals.map((g) =>
      g.key === "potassium" ? { ...g, amount: 1000 } : g,
    ),
  };
  assert.equal(
    goalsForSettings(edited).find((g) => g.key === "potassium")?.amount,
    1000,
  );
});
test("fasting counts only known zero-calorie fluid but keeps all nutrients", () => {
  const entries = [row(0), row(1), row(null)];
  const s = applyHelper(defaults, "fasting");
  assert.equal(goalFluid(entries, s), 100);
  assert.equal(goalFluid(entries, defaults), 300);
  assert.equal(drinkDayTotals(entries, s).values.carbs.amount, 36);
  assert.equal(drinkDayTotals([row(null)], s).values.calories.amount, null);
});
test("older goals gain carbohydrate support without losing saved limits", () => {
  const old = goalsForSettings(defaults).filter((g) => g.key !== "carbs");
  const goals = goalsForSettings({ ...defaults, drinkGoals: old });
  validateGoals(goals);
  assert.equal(goals.find((g) => g.key === "carbs")?.amount, null);
  assert.equal(drinkDayTotals([row(0, 250)], defaults).values.carbs.amount, 30);
});

test("fasting progress and reminders use qualifying fluid while all entries remain recorded", async () => {
  const { progress } = await import("../src/lib/tracking.ts");
  const { planReminders, defaultReminderPreferences } =
    await import("../src/lib/reminder-plan.ts");
  const now = new Date(2026, 9, 23, 12);
  const drink = row(50, 2000);
  drink.at = now.toISOString();
  const s = {
    ...applyHelper({ ...defaults, water: 500 }, "fasting"),
    reminders: true,
    reminderPreferences: {
      ...defaultReminderPreferences,
      per_drink: false,
      caffeine_cutoff: false,
      quiet_start: "22:00",
      quiet_end: "08:00",
    },
  };
  assert.equal(progress([drink], s, localDay(now)).taken, 0);
  assert.equal(progress([drink], s, localDay(now)).onTarget, false);
  assert.ok(planReminders(s, [drink], now).length > 0);
  const water = {
    ...drink,
    drink: {
      ...drink.drink,
      nutrition: { ...drink.drink.nutrition, calories: 0 },
    },
  };
  assert.equal(
    planReminders(s, [water], now).filter(
      (r) => localDay(new Date(r.at)) === localDay(now),
    ).length,
    0,
  );
});

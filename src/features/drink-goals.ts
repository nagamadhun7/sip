import type { Drink, Entry, Settings } from "../lib/model.ts";
import { localDay } from "../lib/model.ts";
import { isAlcohol, standardDrinks } from "./alcohol.ts";
export const extraNutrients = ["added_sugar", "calcium", "vitamin_d"] as const;
export type ExtraNutrient = (typeof extraNutrients)[number];
export type GoalKey =
  | "plain_water"
  | "caffeine"
  | "added_sugar"
  | "calcium"
  | "vitamin_d"
  | "potassium"
  | "sodium"
  | "calories"
  | "alcohol";
export type DrinkGoal = {
  key: GoalKey;
  kind: "target" | "limit";
  amount: number | null;
  unit: "ml" | "g" | "mg" | "µg" | "kcal" | "standard drinks";
  visible: boolean;
};
export const goalLabels: Record<GoalKey, string> = {
  plain_water: "Plain water",
  caffeine: "Caffeine",
  added_sugar: "Added sugar",
  calcium: "Calcium",
  vitamin_d: "Vitamin D",
  potassium: "Potassium",
  sodium: "Sodium",
  calories: "Drink calories",
  alcohol: "Alcohol",
};
export function initialGoals(s: Settings): DrinkGoal[] {
  return [
    {
      key: "plain_water",
      kind: "target",
      amount: null,
      unit: "ml",
      visible: true,
    },
    {
      key: "caffeine",
      kind: "limit",
      amount: s.caffeine,
      unit: "mg",
      visible: true,
    },
    {
      key: "added_sugar",
      kind: "limit",
      amount: null,
      unit: "g",
      visible: true,
    },
    {
      key: "calcium",
      kind: "target",
      amount: null,
      unit: "mg",
      visible: false,
    },
    {
      key: "vitamin_d",
      kind: "target",
      amount: null,
      unit: "µg",
      visible: false,
    },
    {
      key: "potassium",
      kind: "target",
      amount: s.potassium,
      unit: "mg",
      visible: false,
    },
    {
      key: "sodium",
      kind: "limit",
      amount: s.sodium,
      unit: "mg",
      visible: false,
    },
    {
      key: "calories",
      kind: "limit",
      amount: null,
      unit: "kcal",
      visible: false,
    },
    {
      key: "alcohol",
      kind: "limit",
      amount: s.alcohol?.limit ?? null,
      unit: "standard drinks",
      visible: false,
    },
  ];
}
export function validateGoals(goals: DrinkGoal[]) {
  const expected = initialGoals({
    caffeine: 0,
    sodium: 0,
    potassium: 0,
  } as Settings);
  if (
    goals.length !== expected.length ||
    new Set(goals.map((g) => g.key)).size !== expected.length
  )
    throw Error("Check the drink goals.");
  for (const g of goals) {
    const template = expected.find((x) => x.key === g.key);
    if (
      !template ||
      g.kind !== template.kind ||
      g.unit !== template.unit ||
      typeof g.visible !== "boolean" ||
      (g.amount !== null &&
        (!Number.isFinite(g.amount) ||
          g.amount < 0 ||
          g.amount > 100000 ||
          (g.key === "plain_water" && g.amount === 0)))
    )
      throw Error(
        "Enter valid goals; leave an optional goal blank if not set.",
      );
  }
}
export function goalsForSettings(s: Settings): DrinkGoal[] {
  const saved = s.drinkGoals ?? initialGoals(s);
  return saved.map((g) => ({
    ...g,
    amount:
      g.key === "caffeine"
        ? s.caffeine
        : g.key === "sodium"
          ? s.sodium
          : g.key === "potassium"
            ? s.potassium
            : g.key === "alcohol"
              ? (s.alcohol?.limit ?? g.amount)
              : g.amount,
  }));
}
export function isPlainWater(d: Drink) {
  return (
    d.fluidType === "plain-water" ||
    (d.fluidType === undefined && ["water", "sparkling-water"].includes(d.id))
  );
}
export type NutrientTotal = { amount: number | null; missing: number };
export function drinkDayTotals(entries: Entry[], s: Settings) {
  const result = Object.fromEntries(
    initialGoals(s).map((g) => [g.key, { amount: 0, missing: 0, known: 0 }]),
  ) as Record<
    GoalKey,
    { amount: number | null; missing: number; known: number }
  >;
  let totalFluid = 0;
  const naturalSugar = { amount: 0 as number | null, missing: 0 },
    totalSugar = { amount: 0 as number | null, missing: 0 };
  let naturalKnown = 0,
    totalKnown = 0;
  for (const e of entries) {
    totalFluid += e.ml;
    const sugar = e.drink.nutrition.sugar,
      added =
        e.drink.extraNutrition?.added_sugar ??
        (isPlainWater(e.drink) ? 0 : null);
    if (sugar === null || e.drink.missingNutrition?.includes("sugar"))
      totalSugar.missing++;
    else {
      totalSugar.amount! += (sugar * e.ml) / 100;
      totalKnown++;
    }
    if (
      sugar == null ||
      added == null ||
      e.drink.missingNutrition?.includes("sugar")
    )
      naturalSugar.missing++;
    else {
      naturalSugar.amount! += (Math.max(0, sugar - added) * e.ml) / 100;
      naturalKnown++;
    }

    if (isPlainWater(e.drink)) result.plain_water.amount! += e.ml;
    for (const key of Object.keys(result) as GoalKey[]) {
      if (key === "plain_water") continue;
      let value: number | null | undefined;
      if (key === "alcohol")
        value = isAlcohol(e.drink)
          ? e.drink.alcohol_abv == null
            ? null
            : standardDrinks(e.ml, e.drink.alcohol_abv, s.alcohol?.grams ?? 14)
          : 0;
      else
        value = extraNutrients.includes(key as ExtraNutrient)
          ? (e.drink.extraNutrition?.[key as ExtraNutrient] ??
            (key === "added_sugar" && isPlainWater(e.drink) ? 0 : null))
          : e.drink.nutrition[
              key as "caffeine" | "potassium" | "sodium" | "calories"
            ];
      if (
        key !== "alcohol" &&
        e.drink.missingNutrition?.includes(key as "caffeine")
      )
        result[key].missing++;
      else if (value == null) {
        result[key].missing++;
        continue;
      }
      if (value == null) continue;
      result[key].amount! += key === "alcohol" ? value : (value * e.ml) / 100;
      result[key].known++;
    }
  }
  for (const [key, total] of Object.entries(result)) {
    if (key !== "plain_water" && entries.length && total.known === 0)
      total.amount = null;
  }
  if (entries.length && !naturalKnown) naturalSugar.amount = null;
  if (entries.length && !totalKnown) totalSugar.amount = null;
  return {
    naturalSugar,
    totalSugar,
    values: result,
    totalFluid,
    plainWater: result.plain_water.amount ?? 0,
  };
}
export function goalStatus(goal: DrinkGoal, total: NutrientTotal) {
  if (total.amount === null) return "Not listed";
  const value = (n: number) => String(+n.toFixed(2));
  if (goal.amount === null) return "Set a goal";
  if (total.missing)
    return goal.kind === "limit" && total.amount > goal.amount
      ? `At least ${value(total.amount - goal.amount)} ${goal.unit} over limit · incomplete`
      : `${value(total.amount)} ${goal.unit} recorded · incomplete`;
  if (goal.kind === "target")
    return total.amount >= goal.amount
      ? "Target reached"
      : `${value(goal.amount - total.amount)} ${goal.unit} to go`;
  return total.amount > goal.amount
    ? `${value(total.amount - goal.amount)} ${goal.unit} over limit`
    : `${value(goal.amount - total.amount)} ${goal.unit} left`;
}
export function caffeineTiming(
  entries: Entry[],
  s: Settings,
  now = new Date(),
) {
  const rows = entries
    .filter(
      (e) =>
        localDay(e.at) === localDay(now) &&
        e.at <= now.toISOString() &&
        (e.drink.nutrition.caffeine ?? 0) > 0,
    )
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  const last = rows[0];
  if (!last) return null;
  const bedtime = new Date(now);
  const [h, m] = s.bedtime.split(":").map(Number);
  bedtime.setHours(h, m, 0, 0);

  const cutoff = new Date(
    bedtime.getTime() - (s.reminderPreferences?.cutoff_hours ?? 6) * 3600000,
  );
  const lateMg = rows
    .filter((e) => Date.parse(e.at) >= cutoff.getTime())
    .reduce((n, e) => n + ((e.drink.nutrition.caffeine ?? 0) * e.ml) / 100, 0);
  return {
    at: last.at,
    lateMg,
    cutoff: cutoff.toISOString(),
    incomplete: entries.some(
      (e) =>
        e.drink.nutrition.caffeine === null ||
        e.drink.missingNutrition?.includes("caffeine"),
    ),
  };
}

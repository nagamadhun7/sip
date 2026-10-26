import type { Drink, Entry, Settings } from "../lib/model.ts";
import { caffeineNow, localDay, onDay, totals } from "../lib/model.ts";
import {
  drinkDayTotals,
  goalsForSettings,
  goalLabels,
  type GoalKey,
} from "./drink-goals.ts";
import { caffeineLimit } from "./cutback.ts";
import { CAFFEINE_HALF_LIFE_HOURS } from "./caffeine-curve.ts";
export type LimitPreview = {
  key: GoalKey | "total_sugar";
  label: string;
  unit: string;
  limit: number;
  used: number | null;
  drink: number | null;
  after: number | null;
  percent: number | null;
  left: number | null;
  incomplete: boolean;
};
export function beforeDrink(
  drink: Drink,
  ml: number,
  entries: Entry[],
  settings: Settings,
  now = new Date(),
) {
  if (!Number.isFinite(ml) || ml < 1 || ml > 10000)
    throw Error("Choose an amount from 1 to 10,000 ml to check this drink.");
  for (const value of [
    ...Object.values(drink.nutrition),
    ...Object.values(drink.extraNutrition ?? {}),
  ])
    if (value != null && (!Number.isFinite(value) || value < 0))
      throw Error(
        "Enter nonnegative nutrition values, or leave unknown values blank.",
      );
  const recorded = entries.filter(
    (e) =>
      Number.isFinite(Date.parse(e.at)) && Date.parse(e.at) <= now.getTime(),
  );
  const today = onDay(recorded, localDay(now)),
    used = drinkDayTotals(today, settings),
    portion = drinkDayTotals(
      [{ id: "preview", drink, ml, at: now.toISOString() }],
      settings,
    );
  const goals = goalsForSettings(settings)
    .filter((g) => g.kind === "limit" && g.amount !== null)
    .map((g) =>
      g.key === "caffeine"
        ? { ...g, amount: caffeineLimit(settings, recorded, localDay(now)) }
        : g,
    );
  const limits: LimitPreview[] = goals.map((g) => {
    const u = used.values[g.key],
      d = portion.values[g.key],
      incomplete = !!(u.missing || d.missing),
      after =
        u.amount !== null && d.amount !== null ? u.amount + d.amount : null;
    return {
      key: g.key,
      label: goalLabels[g.key],
      unit: g.unit,
      limit: g.amount!,
      used: u.amount,
      drink: d.amount,
      after,
      percent:
        after !== null && !incomplete && g.amount! > 0
          ? (after / g.amount!) * 100
          : null,
      left: after !== null && !incomplete ? g.amount! - after : null,
      incomplete,
    };
  });
  // Preserve the user's existing total-sugar reference when no added-sugar ceiling is set.
  if (!goals.some((g) => g.key === "added_sugar")) {
    const u = totals(today),
      known =
        typeof drink.nutrition.sugar === "number" &&
        Number.isFinite(drink.nutrition.sugar) &&
        drink.nutrition.sugar >= 0 &&
        !drink.missingNutrition?.includes("sugar"),
      dose = known ? (drink.nutrition.sugar! * ml) / 100 : null,
      after = dose === null ? null : u.sugar + dose,
      incomplete = !!u.missing.sugar || !known;
    limits.unshift({
      key: "total_sugar",
      label: "Total sugar reference",
      unit: "g",
      limit: settings.sugar,
      used: u.sugar,
      drink: dose,
      after,
      percent:
        after !== null && !incomplete && settings.sugar > 0
          ? (after / settings.sugar) * 100
          : null,
      left: after !== null && !incomplete ? settings.sugar - after : null,
      incomplete,
    });
  }
  const bed = new Date(now),
    [h, m] = settings.bedtime.split(":").map(Number);
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(settings.bedtime))
    throw Error("Set a valid bedtime in Settings to estimate caffeine.");
  bed.setHours(h, m, 0, 0);
  if (bed <= now) bed.setDate(bed.getDate() + 1);
  const value = drink.nutrition.caffeine,
    known =
      typeof value === "number" &&
      Number.isFinite(value) &&
      value >= 0 &&
      !drink.missingNutrition?.includes("caffeine"),
    dose = known ? (value * ml) / 100 : null;
  const validRecorded = recorded.map((e) => ({
    ...e,
    drink: {
      ...e.drink,
      nutrition: {
        ...e.drink.nutrition,
        caffeine:
          typeof e.drink.nutrition.caffeine === "number" &&
          Number.isFinite(e.drink.nutrition.caffeine) &&
          e.drink.nutrition.caffeine >= 0
            ? e.drink.nutrition.caffeine
            : null,
      },
    },
  }));
  const baseline = caffeineNow(validRecorded, bed.getTime()),
    drinkAtBedtime =
      dose === null
        ? null
        : dose *
          Math.pow(
            0.5,
            (bed.getTime() - now.getTime()) /
              3600000 /
              CAFFEINE_HALF_LIFE_HOURS,
          );
  const missing = recorded.filter(
    (e) =>
      Date.parse(e.at) >= now.getTime() - 48 * 3600000 &&
      (typeof e.drink.nutrition.caffeine !== "number" ||
        !Number.isFinite(e.drink.nutrition.caffeine) ||
        e.drink.missingNutrition?.includes("caffeine")),
  ).length;
  return {
    limits,
    bedtime: bed.toISOString(),
    dose,
    baseline,
    drinkAtBedtime,
    atBedtime: drinkAtBedtime === null ? null : baseline + drinkAtBedtime,
    missing,
    halfLife: CAFFEINE_HALF_LIFE_HOURS,
  };
}

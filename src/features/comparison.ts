import { caffeineLimit } from "./cutback.ts";
import { totals, onDay, localDay } from "../lib/model.ts";
import type { Drink, Entry, Settings } from "../lib/model.ts";
export const compareKeys = ["sugar", "caffeine", "calories", "sodium"] as const;
export function compareDrink(
  drink: Drink,
  ml: number,
  entries: Entry[],
  settings: Settings,
) {
  if (!Number.isFinite(ml) || ml <= 0 || ml > 10000)
    throw Error("Enter a portion from 1 to 10,000 ml.");
  settings = { ...settings, caffeine: caffeineLimit(settings, entries) };
  const used = totals(onDay(entries, localDay()));
  const values = Object.fromEntries(
    compareKeys.map((k) => [
      k,
      drink.nutrition[k] === null || drink.missingNutrition?.includes(k)
        ? null
        : (drink.nutrition[k]! * ml) / 100,
    ]),
  ) as Record<(typeof compareKeys)[number], number | null>;
  const sentence = (["sugar", "caffeine", "sodium"] as const)
    .map((k) => {
      const unit = k === "sugar" ? "g" : "mg",
        v = values[k];
      if (v === null) return `${k} is not listed`;
      if (used.missing[k])
        return `${k} remaining is uncertain because earlier entries are incomplete`;
      const left = settings[k] - used[k] - v;
      return `${+Math.abs(left).toFixed(1)} ${unit} ${k} ${left < 0 ? "over your limit" : "left"}`;
    })
    .join(", ");
  return {
    values,
    sentence: `With ${drink.name}: ${sentence}. Calories are shown for this portion; no calorie limit is set.`,
  };
}

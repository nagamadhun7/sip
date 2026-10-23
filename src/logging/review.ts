import { getLocale, regionalOunce } from "../features/locale.ts";
import type { Drink, Nutrient } from "../lib/model.ts";
import { validateEntry } from "../lib/model.ts";
import { entriesFromParsed } from "./parse.ts";
import type { ParsedLog } from "./parse.ts";

export type ReviewRow = ParsedLog & { portion: string };
export const reviewRows = (
  rows: ParsedLog[],
  units: "ml" | "oz",
): ReviewRow[] =>
  rows.map((row) => ({
    ...row,
    portion: String(
      +(
        row.amount_ml / (units === "oz" ? regionalOunce(getLocale()) : 1)
      ).toFixed(3),
    ),
  }));

export function reviewEntries(
  rows: ReviewRow[],
  catalog: Drink[],
  units: "ml" | "oz",
  newId: () => string,
) {
  if (!rows.length) throw Error("Keep at least one drink to log.");
  const entries = entriesFromParsed(
    rows.map((row) => ({
      ...row,
      amount_ml:
        Number(row.portion) === Number(reviewRows([row], units)[0].portion)
          ? row.amount_ml
          : Number(row.portion) *
            (units === "oz" ? regionalOunce(getLocale()) : 1),
    })),
    catalog,
    newId,
  );
  entries.forEach(validateEntry);
  return entries;
}

export function nutrientBreakdown(drink: Drink, ml: number, key: Nutrient) {
  const per100 = drink.nutrition[key];
  if (per100 === null || drink.missingNutrition?.includes(key)) return null;
  return { per100, amount: (per100 * ml) / 100, source: drink.source };
}

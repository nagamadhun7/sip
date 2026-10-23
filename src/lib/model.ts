import { getLocale, regionalOunce } from "../features/locale.ts";
import type { Recipe, Profile } from "../drink-maker/core";
export const nutrients = [
  "sugar",
  "caffeine",
  "calories",
  "sodium",
  "potassium",
] as const;
export type Nutrient = (typeof nutrients)[number];
export type Nutrition = Record<Nutrient, number | null>;
export type Drink = {
  id: string;
  name: string;
  color: string;
  serving: number;
  nutrition: Nutrition;
  extraNutrition?: Partial<
    Record<import("../features/drink-goals").ExtraNutrient, number | null>
  >;
  fluidType?: "plain-water" | "other";
  source: string;
  alcohol_abv?: number | null;
  barcode?: string;
  label_photo?: string;
  missingNutrition?: Nutrient[];
  shape?: import("./drink-icons").IconShape;
  iconType?: string;
  recipe?: Recipe & { catalog_version: number };
};
export type Entry = {
  id: string;
  drink: Drink;
  ml: number;
  at: string;
  health?: { platform: "ios" | "android"; id: string };
};
export type Settings = {
  cravingNudges?: import("../features/craving-patterns").CravingNudges;
  hydrationAdjustments?: import("../features/hydration-adjustments").HydrationAdjustments;
  trackingHelper?: import("../features/conditions").TrackingHelper;
  drinkGoals?: import("../features/drink-goals").DrinkGoal[];
  favoriteDrinkIds?: string[];
  dailyNotes?: Record<string, string>;
  locale?: import("../features/locale").AppLocale;
  alcohol?: { limit: number; grams: number; freeDays: string[] };
  cutback?: import("../features/cutback").Cutback;
  situation?: import("../features/situations").Situation;
  comparison?: [string, string];
  reminderPreferences?: import("./reminder-plan").ReminderPreferences;
  aiAccess?: {
    pro: boolean;
    daily_used: number;
    daily_limit: number;
    monthly_used: number;
    monthly_limit: number | null;
    fetched_at: string;
  };
  healthSync?: boolean;
  reminderLastError?: string;
  healthLastSync?: string;
  healthLastError?: string;
  profile?: import("./tracking").UserProfile;
  onboarded: boolean;
  makerProfile?: Profile;
  focus: "water" | "sugar" | "caffeine";
  water: number;
  sugar: number;
  caffeine: number;
  sodium: number;
  potassium: number;
  bedtime: string;
  units: "ml" | "oz";
  reminders: boolean;
  reminderHours: number[];
};
export const defaults: Settings = {
  onboarded: false,
  focus: "water",
  water: 2200,
  sugar: 25,
  caffeine: 400,
  sodium: 2300,
  potassium: 2600,
  bedtime: "22:30",
  units: "ml",
  reminders: false,
  reminderHours: [10, 13, 16, 19],
};
export const id = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
export function localDay(value: Date | string = new Date()) {
  const d = typeof value === "string" ? new Date(value) : value;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export const onDay = (entries: Entry[], day: string) =>
  entries.filter((e) => localDay(e.at) === day);
export function totals(entries: Entry[]) {
  const result = {
    water: 0,
    sugar: 0,
    caffeine: 0,
    calories: 0,
    sodium: 0,
    potassium: 0,
    missing: { sugar: 0, caffeine: 0, calories: 0, sodium: 0, potassium: 0 },
  };
  for (const e of entries) {
    result.water += e.ml;
    for (const k of nutrients) {
      const n = e.drink.nutrition[k];
      if (n === null || e.drink.missingNutrition?.includes(k))
        result.missing[k]++;
      if (n !== null) result[k] += (n * e.ml) / 100;
    }
  }
  return result;
}
export function validateEntry(e: Entry) {
  if (
    e.drink.fluidType === "plain-water" &&
    ((e.drink.nutrition.sugar ?? 0) > 0 ||
      (e.drink.nutrition.caffeine ?? 0) > 0 ||
      (e.drink.alcohol_abv ?? 0) > 0)
  )
    throw Error(
      "Plain water cannot contain sugar, caffeine or alcohol. Turn off plain water for this drink.",
    );
  for (const value of Object.values(e.drink.extraNutrition ?? {}))
    if (
      value !== null &&
      value !== undefined &&
      (!Number.isFinite(value) || value < 0 || value > 100000)
    )
      throw Error("Extra nutrients must be nonnegative or left blank.");
  const added = e.drink.extraNutrition?.added_sugar;
  if (
    added != null &&
    e.drink.nutrition.sugar != null &&
    added > e.drink.nutrition.sugar
  )
    throw Error("Added sugar cannot exceed total sugar.");
  if (!e.drink.name.trim()) throw Error("Enter a drink name.");
  if (!Number.isFinite(e.ml) || e.ml <= 0 || e.ml > 10000)
    throw Error("Enter an amount between 1 and 10,000 ml.");
  if (
    !Number.isFinite(Date.parse(e.at)) ||
    Date.parse(e.at) > Date.now() + 60000
  )
    throw Error("Choose a valid time that is not in the future.");
  for (const k of nutrients) {
    const n = e.drink.nutrition[k];
    if (n !== null && (!Number.isFinite(n) || n < 0 || n > 100000))
      throw Error("Nutrition values must be positive numbers or left blank.");
  }
}
export function caffeineNow(entries: Entry[], now = Date.now()) {
  return entries.reduce((sum, e) => {
    const elapsed = (now - Date.parse(e.at)) / 3600000;
    return elapsed < 0
      ? sum
      : sum +
          (((e.drink.nutrition.caffeine ?? 0) * e.ml) / 100) *
            Math.pow(0.5, elapsed / 5);
  }, 0);
}
export function lastDays(count = 7, until = new Date()) {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(until);
    d.setDate(d.getDate() - count + 1 + i);
    return localDay(d);
  });
}
export function formatVolume(ml: number, units: "ml" | "oz" = "ml") {
  return units === "oz"
    ? `${+(ml / regionalOunce(getLocale())).toFixed(1)} fl oz`
    : ml >= 1000
      ? `${+(ml / 1000).toFixed(2)} L`
      : `${Math.round(ml)} ml`;
}
const escape = (s: unknown) => {
  let text = String(s ?? "");
  if (typeof s === "string" && /^[=+@\-\t\r\n]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
};
export function exportCsv(entries: Entry[]) {
  return (
    "\uFEFF" +
    [
      [
        "Date",
        "Drink",
        "Amount (ml)",
        "Sugar (g)",
        "Caffeine (mg)",
        "Calories (kcal)",
        "Sodium (mg)",
        "Potassium (mg)",
        "Source",
      ],
      ...entries.map((e) => [
        e.at,
        e.drink.name,
        e.ml,
        ...nutrients.map((k) =>
          e.drink.nutrition[k] === null
            ? ""
            : +((e.drink.nutrition[k]! * e.ml) / 100).toFixed(2),
        ),
        e.drink.source,
      ]),
    ]
      .map((r) => r.map(escape).join(","))
      .join("\r\n")
  );
}

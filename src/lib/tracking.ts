import type { Entry, Settings, Drink } from "./model.ts";
import { totals, onDay, localDay, caffeineNow } from "./model.ts";
export type UserProfile = {
  age: number;
  weight_kg: number;
  sex: "female" | "male" | "unspecified";
  status: "standard" | "pregnant" | "nursing" | "medical";
};
export type Container = {
  id: string;
  name: string;
  drink_id: string;
  ml: number;
};
export function validateProfile(p: UserProfile) {
  if (
    !Number.isInteger(p.age) ||
    p.age < 1 ||
    p.age > 120 ||
    !Number.isFinite(p.weight_kg) ||
    p.weight_kg < 5 ||
    p.weight_kg > 500
  )
    throw Error("Enter your age (1–120) and weight in kg (5–500).");
}
// EFSA water adequate intakes include food. The drink target uses an explicit
// 80% beverage allocation; it is an editable tracking estimate, not a prescription.
// https://efsa.onlinelibrary.wiley.com/doi/10.2903/j.efsa.2010.1459
// https://www.efsa.europa.eu/en/topics/topic/caffeine
export function calculateTargets(
  p: UserProfile,
  previous?: Pick<
    Settings,
    "water" | "sugar" | "caffeine" | "sodium" | "potassium"
  >,
) {
  validateProfile(p);
  if (p.status === "medical") {
    if (!previous) throw Error("Enter the targets from your own medical plan.");
    return { ...previous };
  }
  const total =
    p.age < 4
      ? 1300
      : p.age < 9
        ? 1600
        : p.age < 14
          ? p.sex === "male"
            ? 2100
            : 1900
          : p.sex === "male"
            ? 2500
            : 2000;
  return {
    water: Math.round(
      (total +
        (p.status === "pregnant" ? 300 : p.status === "nursing" ? 700 : 0)) *
        0.8,
    ),
    sugar: previous?.sugar ?? 25,
    caffeine:
      p.age < 18
        ? 0
        : Math.floor(
            Math.min(
              p.status === "pregnant" || p.status === "nursing" ? 200 : 400,
              p.weight_kg * 5.7,
            ),
          ),
    sodium: previous?.sodium ?? 2300,
    potassium: previous?.potassium ?? (p.sex === "male" ? 3400 : 2600),
  };
}
export function profileFlags(p: UserProfile, settings: Settings) {
  return {
    ...settings.makerProfile,
    age_band:
      p.age < 18
        ? ("under18" as const)
        : p.age >= 65
          ? ("65plus" as const)
          : ("18-64" as const),
    pregnant: p.status === "pregnant",
    nursing: p.status === "nursing",
    medical_plan: p.status === "medical",
    alcohol_tracking: settings.makerProfile?.alcohol_tracking ?? false,
  };
}
export function quickHistory(entries: Entry[], limit = 2) {
  const seen = new Set<string>();
  return [...entries]
    .sort((a, b) => b.at.localeCompare(a.at))
    .filter((e) => {
      const key = e.drink.id + ":" + e.ml;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
}
export function repeatDay(
  entries: Entry[],
  from: string,
  now = new Date(),
): Entry[] {
  return onDay(entries, from).map((e) => ({
    ...structuredClone(e),
    health: undefined,
    at: now.toISOString(),
  }));
}
export function progress(
  entries: Entry[],
  settings: Settings,
  day = localDay(),
) {
  const rows = onDay(entries, day),
    sum = totals(rows),
    key = settings.focus;
  return {
    sum,
    taken: sum[key],
    target: settings[key],
    fraction:
      settings[key] > 0 ? sum[key] / settings[key] : sum[key] > 0 ? 1 : 0,
    left: Math.max(0, settings[key] - sum[key]),
    onTarget:
      rows.length > 0 &&
      (key === "water"
        ? sum.water >= settings.water
        : sum.missing[key] === 0 && sum[key] <= settings[key]),
  };
}
export function caffeineClearBy(
  entries: Entry[],
  now = Date.now(),
  threshold = 25,
) {
  const active = caffeineNow(entries, now);
  return new Date(
    now +
      (active > threshold ? 5 * Math.log2(active / threshold) * 3600000 : 0),
  );
}
export function makeEntry(
  drink: Drink,
  ml = drink.serving,
  now = new Date(),
): Omit<Entry, "id"> {
  return { drink: structuredClone(drink), ml, at: now.toISOString() };
}

export function catalogDrinks(library: Drink[], catalog: Drink[]) {
  const seen = new Set<string>();
  return [...library, ...catalog].filter((d) => {
    if (seen.has(d.id)) return false;
    seen.add(d.id);
    return true;
  });
}

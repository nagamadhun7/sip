import type { Drink, Entry, Settings } from "../lib/model.ts";
import { localDay, lastDays } from "../lib/model.ts";
import { isPlainWater } from "./drink-goals.ts";
import { isAlcohol } from "./alcohol.ts";
import { fastingEnabled } from "./conditions.ts";
export type CravingKind = "soda" | "third-coffee";
export type CravingNudges = {
  enabled: boolean;
  soda: boolean;
  thirdCoffee: boolean;
  lead_minutes: number;
  snoozed_until?: number;
  snoozed_kind?: CravingKind;
};
export const cravingDefaults: CravingNudges = {
  enabled: false,
  soda: true,
  thirdCoffee: true,
  lead_minutes: 10,
};
export type DrinkPattern = {
  kind: CravingKind;
  days: number;
  eligibleDays: number;
  startHour: number;
  minute: number;
  ml: number;
  metric: "sugar" | "caffeine";
  amount: number | null;
  incomplete: boolean;
};
export function drinkFamily(d: Drink): "soda" | "coffee" | null {
  // A custom shape is not evidence of what's inside it. Match explicit type/name only.
  if (isPlainWater(d) || isAlcohol(d) || /\b(liqueur|liquor)\b/i.test(d.name))
    return null;
  const text = `${d.id} ${d.name}`
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
  if (/\b(soda water|club soda)\b/.test(text)) return null;
  if (
    ["cola", "soda-bottle"].includes(d.iconType ?? "") ||
    /\b(cola|soda|pepsi|sprite|fanta|soft drink|refresco|gaseosa)\b/.test(text)
  )
    return "soda";
  if (
    ["coffee", "espresso", "iced-coffee", "latte"].includes(d.iconType ?? "") ||
    /\b(coffee|espresso|latte|cappuccino|americano|cafe|caffe|kaffee|mocha)\b/.test(
      text,
    )
  )
    return "coffee";
  return null;
}
const median = (values: number[]) => {
  const a = [...values].sort((a, b) => a - b);
  return a.length % 2
    ? a[(a.length - 1) / 2]
    : (a[a.length / 2 - 1] + a[a.length / 2]) / 2;
};
export function cravingPatterns(entries: Entry[], now = new Date()) {
  const end = new Date(now);
  end.setDate(end.getDate() - 1);
  const days = lastDays(28, end),
    seen = new Set<string>();
  const rows = entries
    .filter((e) => {
      if (
        seen.has(e.id) ||
        !Number.isFinite(Date.parse(e.at)) ||
        !days.includes(localDay(e.at)) ||
        Date.parse(e.at) > now.getTime() ||
        !Number.isFinite(e.ml) ||
        e.ml <= 0
      )
        return false;
      seen.add(e.id);
      return true;
    })
    .sort(
      (a, b) => Date.parse(a.at) - Date.parse(b.at) || a.id.localeCompare(b.id),
    );
  const coffeeCounts = new Map<string, number>();
  const soda: Entry[] = [],
    third: Entry[] = [];
  for (const e of rows) {
    const family = drinkFamily(e.drink),
      day = localDay(e.at);
    if (family === "soda") soda.push(e);
    if (family === "coffee") {
      const count = (coffeeCounts.get(day) ?? 0) + 1;
      coffeeCounts.set(day, count);
      if (count === 3) third.push(e);
    }
  }
  const patterns: DrinkPattern[] = [];
  for (const [kind, events] of [
    ["soda", soda],
    ["third-coffee", third],
  ] as const) {
    const eligibleDays = new Set(events.map((e) => localDay(e.at))).size;
    if (eligibleDays < 3) continue;
    let best:
      | { start: number; events: Entry[]; days: number; spread: number }
      | undefined;
    for (let start = 0; start < 24; start++) {
      const matching = events.filter((e) => {
        const at = new Date(e.at);
        return (at.getHours() - start + 24) % 24 < 2;
      });
      // One vote per day stops repeated logs on a single day dominating a pattern.
      const onePerDay = [
        ...new Map(matching.map((e) => [localDay(e.at), e])).values(),
      ];
      const minutes = onePerDay.map((e) => {
        const at = new Date(e.at);
        return ((at.getHours() - start + 24) % 24) * 60 + at.getMinutes();
      });
      const spread = minutes.length
        ? Math.max(...minutes) - Math.min(...minutes)
        : Infinity;
      if (
        !best ||
        onePerDay.length > best.days ||
        (onePerDay.length === best.days && spread < best.spread)
      )
        best = { start, events: onePerDay, days: onePerDay.length, spread };
    }
    if (!best || best.days < 3 || best.days / eligibleDays < 0.6) continue;
    const metric = kind === "soda" ? "sugar" : "caffeine";
    const numbers = best.events.map((e) => {
      const value = e.drink.nutrition[metric];
      return e.drink.missingNutrition?.includes(metric) ||
        typeof value !== "number" ||
        !Number.isFinite(value) ||
        value < 0
        ? null
        : (value * e.ml) / 100;
    });
    const incomplete = numbers.some((n) => n === null);
    const minutes = best.events.map((e) => {
      const at = new Date(e.at);
      return ((at.getHours() - best!.start + 24) % 24) * 60 + at.getMinutes();
    });
    patterns.push({
      kind,
      days: best.days,
      eligibleDays,
      startHour: best.start,
      minute: Math.round(best.start * 60 + median(minutes)) % 1440,
      ml: median(best.events.map((e) => e.ml)),
      metric,
      amount: incomplete ? null : median(numbers as number[]),
      incomplete,
    });
  }
  return {
    patterns,
    loggedDays: new Set(rows.map((e) => localDay(e.at))).size,
    from: days[0],
    to: days[27],
  };
}
export function patternAlternative(
  pattern: DrinkPattern,
  drinks: Drink[],
  s: Settings,
) {
  // Keep suggestions simple: water or a labelled decaf coffee, never alcohol or supplements.
  const choices = drinks.filter(
    (d) =>
      isPlainWater(d) ||
      (/\b(decaf|decaffeinated)\b/i.test(d.name) &&
        drinkFamily(d) === "coffee"),
  );
  return (
    choices
      .filter((d) => {
        const n = d.nutrition[pattern.metric];
        return (
          typeof n === "number" &&
          Number.isFinite(n) &&
          n >= 0 &&
          !d.missingNutrition?.includes(pattern.metric) &&
          pattern.amount !== null &&
          (n * pattern.ml) / 100 < pattern.amount &&
          (!fastingEnabled(s) ||
            (d.nutrition.calories === 0 &&
              !d.missingNutrition?.includes("calories"))) &&
          !isAlcohol(d) &&
          !/\b(liqueur|liquor|supplement|extract|powder)\b/i.test(d.name)
        );
      })
      .sort(
        (a, b) =>
          Number(isPlainWater(b)) - Number(isPlainWater(a)) ||
          a.name.localeCompare(b.name),
      )[0] ?? null
  );
}
export function patternNudge(pattern: DrinkPattern) {
  return pattern.kind === "soda"
    ? "You’ve often logged soda around this time. Pause and choose what fits today; review a lower-sugar option if you want."
    : "You’ve often logged a third coffee around this time. Pause and check today’s caffeine, or review a lower-caffeine option.";
}

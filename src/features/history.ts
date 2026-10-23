import { localDay, totals } from "../lib/model.ts";
import type { Entry, Drink } from "../lib/model.ts";
export function monthDays(month: string) {
  if (!/^\d{4}-\d{2}$/.test(month)) throw Error("Invalid month");
  const [year, m] = month.split("-").map(Number);
  if (m < 1 || m > 12) throw Error("Invalid month");
  return Array.from(
    { length: new Date(year, m, 0).getDate() },
    (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`,
  );
}
export function findHistory(entries: Entry[], query: string) {
  const q = query.trim().toLocaleLowerCase();
  return entries
    .filter(
      (e) =>
        !q ||
        `${e.drink.name} ${e.drink.source} ${localDay(e.at)}`
          .toLocaleLowerCase()
          .includes(q),
    )
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}
export function periodTrend(entries: Entry[], days: number, end: Date) {
  const keys = Array.from({ length: days }, (_, i) => {
    const d = new Date(end);
    d.setDate(d.getDate() - i);
    return localDay(d);
  });
  const records = entries.filter(
    (e) => keys.includes(localDay(e.at)) && Date.parse(e.at) <= end.getTime(),
  );
  const recordedDays = new Set(records.map((e) => localDay(e.at))).size;
  const sum = totals(records);
  return {
    days,
    recordedDays,
    entries: records.length,
    volume: sum.water,
    dailyAverage: sum.water / days,
    caffeine: sum.caffeine,
    sugar: sum.sugar,
    missing: sum.missing,
  };
}
export function pinnedDrinks(ids: string[], drinks: Drink[]) {
  return [...new Set(ids)]
    .map((id) => drinks.find((d) => d.id === id))
    .filter((d): d is Drink => !!d && d.serving > 0);
}

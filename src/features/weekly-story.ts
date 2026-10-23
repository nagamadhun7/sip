import type { Entry, Settings } from "../lib/model.ts";
import { lastDays, localDay, onDay, totals } from "../lib/model.ts";
import { situationTarget } from "./situations.ts";
import { drinkDayTotals } from "./drink-goals.ts";
export function weeklyStory(
  entries: Entry[],
  settings: Settings,
  end: Date,
  completeLastDay = false,
) {
  const days = lastDays(7, end),
    previousEnd = new Date(end);
  previousEnd.setDate(previousEnd.getDate() - 7);
  const previousDays = lastDays(7, previousEnd);
  const cutoff = new Date(end);
  if (completeLastDay) cutoff.setHours(23, 59, 59, 999);
  const eligible = entries.filter((e) => Date.parse(e.at) <= cutoff.getTime());
  const current = eligible.filter((e) => days.includes(localDay(e.at))),
    previous = eligible.filter((e) => previousDays.includes(localDay(e.at)));
  const currentTotals = totals(current),
    previousTotals = totals(previous),
    currentExtras = drinkDayTotals(current, settings),
    previousExtras = drinkDayTotals(previous, settings);
  const grouped = new Map<
    string,
    { id: string; name: string; count: number; ml: number; latest: string }
  >();
  for (const e of current) {
    const old = grouped.get(e.drink.id);
    grouped.set(e.drink.id, {
      id: e.drink.id,
      name: !old || e.at >= old.latest ? e.drink.name : old.name,
      count: (old?.count ?? 0) + 1,
      ml: (old?.ml ?? 0) + e.ml,
      latest: old && old.latest > e.at ? old.latest : e.at,
    });
  }
  const topDrinks = [...grouped.values()]
    .sort(
      (a, b) =>
        b.count - a.count || b.ml - a.ml || a.name.localeCompare(b.name),
    )
    .slice(0, 3);
  const closestDay =
    days
      .map((day) => {
        const rows = onDay(current, day),
          fluid = totals(rows).water,
          target = situationTarget(settings, day);
        return {
          day,
          fluid,
          target,
          count: rows.length,
          distance: target > 0 ? Math.abs(fluid - target) / target : Infinity,
        };
      })
      .filter((d) => d.count && Number.isFinite(d.distance))
      .sort(
        (a, b) => a.distance - b.distance || a.day.localeCompare(b.day),
      )[0] ?? null;
  const compare = (key: "caffeine" | "sugar" | "added_sugar") => {
    const before =
        key === "added_sugar"
          ? previousExtras.values.added_sugar.amount
          : previousTotals[key],
      after =
        key === "added_sugar"
          ? currentExtras.values.added_sugar.amount
          : currentTotals[key];
    const missing =
      key === "added_sugar"
        ? currentExtras.values.added_sugar.missing +
          previousExtras.values.added_sugar.missing
        : currentTotals.missing[key] + previousTotals.missing[key];
    return {
      current: after,
      previous: before,
      delta:
        current.length &&
        previous.length &&
        !missing &&
        after !== null &&
        before !== null
          ? after - before
          : null,
      reason: !current.length
        ? "no-current-data"
        : !previous.length
          ? "no-previous-data"
          : missing || after === null || before === null
            ? "missing-nutrients"
            : null,
    };
  };
  return {
    days,
    previousDays,
    entries: current.length,
    previousEntries: previous.length,
    recordedDays: new Set(current.map((e) => localDay(e.at))).size,
    previousRecordedDays: new Set(previous.map((e) => localDay(e.at))).size,
    topDrinks,
    closestDay,
    changes: {
      caffeine: compare("caffeine"),
      sugar: compare("sugar"),
      added_sugar: compare("added_sugar"),
    },
  };
}

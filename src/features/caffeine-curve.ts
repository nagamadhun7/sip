import type { Entry } from "../lib/model.ts";
import { caffeineNow } from "../lib/model.ts";
export const CAFFEINE_HALF_LIFE_HOURS = 5;
export const MOSTLY_GONE_REFERENCE_MG = 25;
export function caffeineCurve(
  entries: Entry[],
  now: number,
  bedtimeText: string,
) {
  if (!Number.isFinite(now) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(bedtimeText))
    throw Error("Choose a valid bedtime.");
  const recorded = entries.filter((e) => Date.parse(e.at) <= now);
  const startDate = new Date(now);
  startDate.setHours(0, 0, 0, 0);
  const start = startDate.getTime();
  const bedtime = new Date(now),
    [hour, minute] = bedtimeText.split(":").map(Number);
  bedtime.setHours(hour, minute, 0, 0);
  if (bedtime.getTime() <= now) bedtime.setDate(bedtime.getDate() + 1);
  const dayEnd = new Date(startDate);
  dayEnd.setDate(dayEnd.getDate() + 1);
  const end = Math.max(dayEnd.getTime(), bedtime.getTime() + 30 * 60000);
  const times = new Set<number>([start, end, now, bedtime.getTime()]);
  for (let at = start; at < end; at += 15 * 60000) times.add(at);
  const doses = recorded
    .filter(
      (e) => Date.parse(e.at) >= start && (e.drink.nutrition.caffeine ?? 0) > 0,
    )
    .map((e) => ({
      at: Date.parse(e.at),
      mg: ((e.drink.nutrition.caffeine ?? 0) * e.ml) / 100,
      id: e.id,
    }));
  for (const d of doses) {
    times.add(d.at);
    if (d.at > start) times.add(d.at - 1);
  }
  const points = [...times]
    .sort((a, b) => a - b)
    .map((at) => ({ at, mg: caffeineNow(recorded, at) }));
  const active = caffeineNow(recorded, now),
    atBedtime = caffeineNow(recorded, bedtime.getTime());
  const missing = recorded.filter(
    (e) =>
      Date.parse(e.at) >= start - 24 * 3600000 &&
      (e.drink.nutrition.caffeine == null ||
        e.drink.missingNutrition?.includes("caffeine")),
  ).length;
  return {
    start,
    end,
    bedtime: bedtime.getTime(),
    points,
    doses,
    active,
    atBedtime,
    missing,
    reference: MOSTLY_GONE_REFERENCE_MG,
    mostlyGone: atBedtime <= MOSTLY_GONE_REFERENCE_MG,
    clearAt:
      now +
      (active > MOSTLY_GONE_REFERENCE_MG
        ? CAFFEINE_HALF_LIFE_HOURS *
          Math.log2(active / MOSTLY_GONE_REFERENCE_MG) *
          3600000
        : 0),
    max: Math.max(MOSTLY_GONE_REFERENCE_MG, ...points.map((p) => p.mg)),
  };
}

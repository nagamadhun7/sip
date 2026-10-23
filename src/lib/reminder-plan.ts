import {
  cravingPatterns,
  cravingDefaults,
  patternNudge,
  drinkFamily,
  type DrinkPattern,
} from "../features/craving-patterns.ts";
import { goalFluid } from "../features/conditions.ts";
import {
  activeSituation,
  situationTarget,
  inEatingWindow,
  clockMinutes,
} from "../features/situations.ts";
import type { Entry, Settings } from "./model.ts";
import { localDay, onDay } from "./model.ts";
export type ReminderPreferences = {
  only_behind: boolean;
  per_drink: boolean;
  interval_minutes: number;
  caffeine_cutoff: boolean;
  cutoff_hours: number;
  quiet_start: string;
  quiet_end: string;
  daily_cap: number;
  snooze_minutes: number;
  snoozed_until?: number;
};
export const defaultReminderPreferences: ReminderPreferences = {
  only_behind: true,
  per_drink: true,
  interval_minutes: 120,
  caffeine_cutoff: true,
  cutoff_hours: 6,
  quiet_start: "22:00",
  quiet_end: "08:00",
  daily_cap: 4,
  snooze_minutes: 15,
};
export type Reminder = {
  id: string;
  at: number;
  kind: "hydration" | "per-drink" | "caffeine" | "craving";
  body: string;
  pattern?: DrinkPattern["kind"];
  drink_id?: string;
  ml?: number;
};
const minute = (text: string) => {
  const [h, m] = text.split(":").map(Number);
  return h * 60 + m;
};
export function inQuietHours(at: Date, p: ReminderPreferences) {
  const n = at.getHours() * 60 + at.getMinutes(),
    start = minute(p.quiet_start),
    end = minute(p.quiet_end);
  return start === end
    ? false
    : start < end
      ? n >= start && n < end
      : n >= start || n < end;
}
export function planReminders(
  settings: Settings,
  entries: Entry[],
  now: Date,
  pastCounts: Record<string, number> = {},
): Reminder[] {
  const cravings = { ...cravingDefaults, ...settings.cravingNudges };
  if (!settings.reminders && !cravings.enabled) return [];
  const p = { ...defaultReminderPreferences, ...settings.reminderPreferences };
  const candidates: Reminder[] = [];
  const water = entries.find((e) => e.drink.id === "water");
  const add = (at: Date, kind: Reminder["kind"], pattern?: DrinkPattern) => {
    if (
      at.getTime() <= now.getTime() + 1000 ||
      at.getTime() < (p.snoozed_until ?? 0) ||
      inQuietHours(at, p)
    )
      return;
    const mode = activeSituation(settings, localDay(at));
    if (mode?.mode === "fasting" && !inEatingWindow(at, mode)) return;
    const date = localDay(at),
      taken = goalFluid(onDay(entries, date), settings);
    const wake =
        mode?.mode === "fasting"
          ? clockMinutes(mode.start)
          : minute(p.quiet_end),
      sleep =
        mode?.mode === "fasting"
          ? clockMinutes(mode.end)
          : minute(p.quiet_start);
    const span = (sleep - wake + 1440) % 1440 || 1440;
    const elapsed = (at.getHours() * 60 + at.getMinutes() - wake + 1440) % 1440;
    const expected =
      situationTarget(settings, date) * Math.min(1, elapsed / span);
    if (
      kind !== "caffeine" &&
      kind !== "craving" &&
      p.only_behind &&
      taken >= expected
    )
      return;
    const identifier = `sip:${date}:${kind}${pattern ? ":" + pattern.kind : ""}:${at.getHours()}:${at.getMinutes()}`;
    if (candidates.some((r) => r.id === identifier)) return;
    candidates.push({
      id: identifier,
      at: at.getTime(),
      kind,
      ...(pattern ? { pattern: pattern.kind } : {}),
      body: pattern
        ? patternNudge(pattern)
        : kind === "caffeine"
          ? "Your saved caffeine cutoff is approaching. Review today’s caffeine before your next drink."
          : "Check your logged intake and add a drink if you need one.",
      ...(kind !== "caffeine" && kind !== "craving" && water
        ? { drink_id: water.drink.id, ml: water.ml }
        : {}),
    });
  };
  for (let day = 0; day < 7; day++) {
    const date = new Date(now);
    date.setDate(date.getDate() + day);
    const mode = activeSituation(settings, localDay(date));
    if (settings.reminders && mode) {
      for (let minute = 0; minute < 1440; minute += mode.interval_minutes) {
        const at = new Date(date);
        at.setHours(0, minute, 0, 0);
        add(at, "hydration");
      }
    }
    for (const hour of mode || !settings.reminders
      ? []
      : settings.reminderHours) {
      const at = new Date(date);
      at.setHours(hour, 0, 0, 0);
      add(at, "hydration");
    }
    if (
      settings.reminders &&
      p.caffeine_cutoff &&
      entries.some(
        (e) =>
          localDay(e.at) === localDay(date) &&
          (e.drink.nutrition.caffeine ?? 0) > 0,
      )
    ) {
      const cutoff = new Date(date),
        [h, m] = settings.bedtime.split(":").map(Number);
      cutoff.setHours(h, m, 0, 0);
      cutoff.setTime(cutoff.getTime() - p.cutoff_hours * 3600000);
      add(cutoff, "caffeine");
    }
  }
  if (settings.reminders && p.per_drink && entries.length) {
    const last = entries.reduce((a, b) => (a.at > b.at ? a : b));
    const at = new Date(
      Date.parse(last.at) +
        (activeSituation(settings)?.interval_minutes ?? p.interval_minutes) *
          60000,
    );
    add(at, "per-drink");
  }
  if (
    settings.reminders &&
    !(cravings.enabled && (cravings.snoozed_until ?? 0) > now.getTime()) &&
    p.snoozed_until &&
    p.snoozed_until > now.getTime()
  )
    add(new Date(p.snoozed_until), "hydration");
  if (cravings.enabled) {
    const patterns = cravingPatterns(entries, now).patterns.filter((p) =>
      p.kind === "soda" ? cravings.soda : cravings.thirdCoffee,
    );
    const lead = Math.max(
      0,
      Math.min(
        60,
        Number.isFinite(cravings.lead_minutes) ? cravings.lead_minutes : 10,
      ),
    );
    const thirdAlreadyLogged = (date: string) =>
      onDay(entries, date).filter(
        (e) =>
          Date.parse(e.at) <= now.getTime() &&
          drinkFamily(e.drink) === "coffee",
      ).length >= 3;
    const snoozed = patterns.find(
      (p) =>
        p.kind === cravings.snoozed_kind &&
        !(
          p.kind === "third-coffee" &&
          thirdAlreadyLogged(localDay(new Date(cravings.snoozed_until ?? 0)))
        ),
    );
    if (snoozed && (cravings.snoozed_until ?? 0) > now.getTime())
      add(new Date(cravings.snoozed_until!), "craving", snoozed);
    for (let day = 0; day < 7; day++)
      for (const pattern of patterns) {
        const at = new Date(now);
        at.setDate(at.getDate() + day);
        const patternDay = localDay(at);
        at.setHours(0, pattern.minute - lead, 0, 0);
        // If today's third coffee has already been logged, don't nudge after the fact.
        if (
          pattern.kind === "third-coffee" &&
          patternDay === localDay(now) &&
          thirdAlreadyLogged(localDay(now))
        )
          continue;
        add(at, "craving", pattern);
      }
  }
  const counts = { ...pastCounts };
  return candidates
    .sort((a, b) => a.at - b.at)
    .filter((r) => {
      const day = localDay(new Date(r.at));
      if ((counts[day] ?? 0) >= p.daily_cap) return false;
      counts[day] = (counts[day] ?? 0) + 1;
      return true;
    });
}

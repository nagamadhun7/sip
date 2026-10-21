import { activeSituation, situationTarget, inEatingWindow, clockMinutes } from "../features/situations.ts";
import type { Entry, Settings } from "./model.ts";
import { localDay, onDay, totals } from "./model.ts";
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
  kind: "hydration" | "per-drink" | "caffeine";
  body: string;
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
  if (!settings.reminders) return [];
  const p = { ...defaultReminderPreferences, ...settings.reminderPreferences };
  const candidates: Reminder[] = [];
  const water = entries.find((e) => e.drink.id === "water");
  const add = (at: Date, kind: Reminder["kind"]) => {
    if (
      at.getTime() <= now.getTime() + 1000 ||
      at.getTime() < (p.snoozed_until ?? 0) ||
      inQuietHours(at, p)
    )
      return;
    const mode=activeSituation(settings,localDay(at));
    if(mode?.mode==='fasting'&&!inEatingWindow(at,mode))return;
    const date = localDay(at),
      sum = totals(onDay(entries, date));
    const wake = mode?.mode==='fasting'?clockMinutes(mode.start):minute(p.quiet_end),
      sleep = mode?.mode==='fasting'?clockMinutes(mode.end):minute(p.quiet_start);
    const span = (sleep - wake + 1440) % 1440 || 1440;
    const elapsed = (at.getHours() * 60 + at.getMinutes() - wake + 1440) % 1440;
    const expected = situationTarget(settings,date) * Math.min(1, elapsed / span);
    if (kind !== "caffeine" && p.only_behind && sum.water >= expected) return;
    const identifier = `sip:${date}:${kind}:${at.getHours()}:${at.getMinutes()}`;
    if (candidates.some((r) => r.id === identifier)) return;
    candidates.push({
      id: identifier,
      at: at.getTime(),
      kind,
      body:
        kind === "caffeine"
          ? "Your saved caffeine cutoff is approaching. Review today’s caffeine before your next drink."
          : "Check your logged intake and add a drink if you need one.",
      ...(kind !== "caffeine" && water
        ? { drink_id: water.drink.id, ml: water.ml }
        : {}),
    });
  };
  for (let day = 0; day < 7; day++) {
    const date = new Date(now);
    date.setDate(date.getDate() + day);
    const mode=activeSituation(settings,localDay(date));
    if(mode){ for(let minute=0;minute<1440;minute+=mode.interval_minutes){const at=new Date(date);at.setHours(0,minute,0,0);add(at,"hydration");}}
    for (const hour of mode?[]:settings.reminderHours) {
      const at = new Date(date);
      at.setHours(hour, 0, 0, 0);
      add(at, "hydration");
    }
    if (
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
  if (p.per_drink && entries.length) {
    const last = entries.reduce((a, b) => (a.at > b.at ? a : b));
    const at = new Date(Date.parse(last.at) + (activeSituation(settings)?.interval_minutes??p.interval_minutes) * 60000);
    add(at, "per-drink");
  }
  if (p.snoozed_until && p.snoozed_until > now.getTime())
    add(new Date(p.snoozed_until), "hydration");
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

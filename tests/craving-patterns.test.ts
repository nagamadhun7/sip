import test from "node:test";
import assert from "node:assert/strict";
import {
  cravingPatterns,
  drinkFamily,
  patternAlternative,
  cravingDefaults,
} from "../src/features/craving-patterns.ts";
import {
  defaults,
  localDay,
  type Entry,
  type Drink,
} from "../src/lib/model.ts";
import {
  planReminders,
  defaultReminderPreferences,
} from "../src/lib/reminder-plan.ts";
const now = new Date(2026, 9, 23, 12);
const drink = (
  id: string,
  sugar: number | null = 10,
  caffeine: number | null = 30,
): Drink => ({
  id,
  name: id,
  serving: 200,
  color: "#000000",
  nutrition: { sugar, caffeine, calories: 40, sodium: null, potassium: null },
  source: "Test fixture",
});
const row = (
  day: number,
  hour: number,
  minute = 0,
  d = drink("cola"),
  key = "",
): Entry => ({
  id: `${day}-${hour}-${minute}-${d.id}-${key}`,
  at: new Date(2026, 9, day, hour, minute).toISOString(),
  drink: d,
  ml: 200,
});
const sodas = [row(18, 15, 5), row(19, 15, 15), row(20, 15, 10), row(21, 20)];
const coffees = [18, 19, 20].flatMap((day) => [
  row(day, 8, 0, drink("coffee")),
  row(day, 10, 0, drink("coffee")),
  row(day, 15, 0, drink("coffee")),
  row(day, 17, 0, drink("coffee")),
]);
test("soda pattern uses distinct days, actual time and logged nutrients", () => {
  const p = cravingPatterns(
    [...sodas, ...Array.from({ length: 10 }, (_, i) => row(21, 20, i))],
    now,
  ).patterns.find((p) => p.kind === "soda")!;
  assert.equal(p.days, 3);
  assert.equal(p.eligibleDays, 4);
  assert.equal(p.minute, 15 * 60 + 10);
  assert.equal(p.amount, 20);
  assert.equal(p.ml, 200);
});
test("third coffee means third chronological entry per local day, not fourth or input order", () => {
  const p = cravingPatterns([...coffees].reverse(), now).patterns[0];
  assert.equal(p.kind, "third-coffee");
  assert.equal(p.minute, 15 * 60);
  assert.equal(p.days, 3);
  assert.equal(
    cravingPatterns([...coffees, ...coffees], now).patterns[0].minute,
    15 * 60,
  );
});
test("insufficient, scattered, future, current-day and older logs do not create patterns", () => {
  assert.equal(cravingPatterns(sodas.slice(0, 2), now).patterns.length, 0);
  assert.equal(
    cravingPatterns([row(18, 8), row(19, 12), row(20, 16), row(21, 20)], now)
      .patterns.length,
    0,
  );
  assert.equal(
    cravingPatterns(
      [
        row(23, 15),
        row(24, 15),
        row(25, 15),
        row(1, 15),
        { ...row(1, 15), at: new Date(2026, 8, 1, 15).toISOString() },
      ],
      now,
    ).patterns.length,
    0,
  );
});
test("midnight windows work and soda water or a mug shape are not soda or coffee", () => {
  const p = cravingPatterns(
    [row(18, 23, 55), row(19, 0, 5), row(20, 0, 10)],
    now,
  ).patterns[0];
  assert.ok(p.minute < 20 || p.minute > 23 * 60);
  assert.equal(
    drinkFamily({ ...drink("custom"), name: "Lemon water", shape: "mug" }),
    null,
  );
  assert.equal(drinkFamily(drink("soda water")), null);
  assert.equal(drinkFamily(drink("club soda")), null);
});
test("unknown nutrition stays unknown and alternatives require a real lower value", () => {
  const p = cravingPatterns(
    [18, 19, 20].map((d) => row(d, 15, 0, drink("cola", null))),
    now,
  ).patterns[0];
  assert.equal(p.amount, null);
  assert.equal(p.incomplete, true);
  const water = {
    ...drink("water", 0, 0),
    nutrition: {
      ...drink("water").nutrition,
      sugar: 0,
      caffeine: 0,
      calories: 0,
    },
  };
  assert.equal(patternAlternative(p, [water], defaults), null);
  const known = cravingPatterns(sodas, now).patterns[0];
  assert.equal(patternAlternative(known, [water], defaults)?.id, "water");
  assert.equal(patternAlternative(known, [drink("juice")], defaults), null);
});
const settings = {
  ...defaults,
  reminders: false,
  cravingNudges: { ...cravingDefaults, enabled: true },
  reminderPreferences: {
    ...defaultReminderPreferences,
    quiet_start: "22:00",
    quiet_end: "08:00",
    daily_cap: 2,
  },
};
test("opt-in schedules real pattern times independently of hydration with cap and quiet hours", () => {
  const plan = planReminders(settings, [...sodas, ...coffees], now);
  assert.ok(plan.length);
  assert.ok(plan.every((p) => p.kind === "craving"));
  assert.ok(
    plan.some(
      (p) =>
        new Date(p.at).getHours() === 14 && new Date(p.at).getMinutes() === 50,
    ),
  );
  assert.ok(plan.every((p) => !p.drink_id && !p.ml));
  assert.equal(
    planReminders(
      {
        ...settings,
        cravingNudges: { ...settings.cravingNudges, enabled: false },
      },
      sodas,
      now,
    ).length,
    0,
  );
  assert.equal(
    planReminders(
      {
        ...settings,
        reminderPreferences: {
          ...settings.reminderPreferences,
          quiet_start: "14:00",
          quiet_end: "16:00",
        },
      },
      sodas,
      now,
    ).length,
    0,
  );
  assert.equal(
    plan.filter((r) => localDay(new Date(r.at)) === localDay(now)).length,
    2,
  );
  assert.equal(
    planReminders(settings, sodas, now, { [localDay(now)]: 2 }).filter(
      (r) => localDay(new Date(r.at)) === localDay(now),
    ).length,
    0,
  );
});
test("missing patterns, disabled kinds, fasting windows and already logged third coffee suppress nudges", () => {
  assert.equal(planReminders(settings, [], now).length, 0);
  assert.equal(
    planReminders(
      {
        ...settings,
        cravingNudges: { ...settings.cravingNudges, soda: false },
      },
      sodas,
      now,
    ).length,
    0,
  );
  const fasting = {
    ...settings,
    situation: {
      mode: "fasting" as const,
      day: localDay(now),
      extra_ml: 0,
      interval_minutes: 120,
      start: "16:00",
      end: "20:00",
    },
  };
  assert.equal(planReminders(fasting, sodas, now).length, 0);
  const today = [
    row(23, 8, 0, drink("coffee")),
    row(23, 9, 0, drink("coffee")),
    row(23, 10, 0, drink("coffee")),
  ];
  assert.equal(
    planReminders(settings, [...coffees, ...today], now).filter(
      (r) => localDay(new Date(r.at)) === localDay(now),
    ).length,
    0,
  );
});
test("snoozed pattern returns at saved time and respects quiet hours", () => {
  const until = now.getTime() + 15 * 60000;
  const plan = planReminders(
    {
      ...settings,
      cravingNudges: {
        ...settings.cravingNudges,
        snoozed_until: until,
        snoozed_kind: "soda",
      },
      reminderPreferences: {
        ...settings.reminderPreferences,
        snoozed_until: until,
      },
    },
    sodas,
    now,
  );
  assert.ok(plan.some((p) => p.kind === "craving" && p.at === until));
});

test("known-zero soda does not invent a lower-sugar alternative", () => {
  const p = cravingPatterns(
    [18, 19, 20].map((d) => row(d, 15, 0, drink("diet cola", 0, 0))),
    now,
  ).patterns[0];
  assert.equal(p.amount, 0);
  assert.equal(patternAlternative(p, [drink("water", 0, 0)], defaults), null);
});

test("logging the third coffee cancels a pending coffee snooze", () => {
  const today = [8, 9, 10].map((h) => row(23, h, 0, drink("coffee")));
  const until = now.getTime() + 15 * 60000;
  const plan = planReminders(
    {
      ...settings,
      cravingNudges: {
        ...settings.cravingNudges,
        snoozed_until: until,
        snoozed_kind: "third-coffee",
      },
    },
    [...coffees, ...today],
    now,
  );
  assert.equal(
    plan.some((p) => p.at === until),
    false,
  );
});

test("alcoholic coffee is excluded and never offered as an alternative", () => {
  const d = { ...drink("Decaf coffee liqueur", 0, 0), alcohol_abv: null };
  assert.equal(drinkFamily(d), null);
  const p = cravingPatterns(coffees, now).patterns[0];
  assert.equal(patternAlternative(p, [d], defaults), null);
});

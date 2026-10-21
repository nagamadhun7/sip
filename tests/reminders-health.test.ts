import { test } from "node:test";
import assert from "node:assert/strict";
import {
  planReminders,
  defaultReminderPreferences,
  inQuietHours,
} from "../src/lib/reminder-plan.ts";
import { reconcileHealth, healthSignature } from "../src/health/sync.ts";
import type { HealthAdapter, Link } from "../src/health/sync.ts";
import { defaults, localDay } from "../src/lib/model.ts";
import type { Entry } from "../src/lib/model.ts";
const now = new Date(2026, 9, 20, 9),
  settings = {
    ...defaults,
    water: 2000,
    reminders: true,
    reminderPreferences: {
      ...defaultReminderPreferences,
      per_drink: false,
      caffeine_cutoff: false,
    },
  };
const e: Entry = {
  id: "local",
  at: now.toISOString(),
  ml: 250,
  drink: {
    id: "water",
    name: "Water",
    source: "Label",
    serving: 250,
    color: "#abc",
    nutrition: {
      sugar: 0,
      caffeine: 0,
      calories: 0,
      sodium: 0,
      potassium: null,
    },
  },
};
test("only-behind reminders stop when actual intake meets the target and obey quiet hours", () => {
  const plan = planReminders(settings, [], now);
  assert.ok(plan.some((r) => localDay(new Date(r.at)) === localDay(now)));
  const full = planReminders(settings, [{ ...e, ml: 2000 }], now);
  assert.equal(
    full.filter((r) => localDay(new Date(r.at)) === localDay(now)).length,
    0,
  );
  assert.ok(
    plan.every(
      (r) => !inQuietHours(new Date(r.at), settings.reminderPreferences),
    ),
  );
  assert.equal(
    planReminders({ ...settings, reminders: false }, [], now).length,
    0,
  );
});
test("daily cap includes past reservations and snooze suppresses earlier notifications", () => {
  const p = {
    ...settings,
    reminderPreferences: {
      ...settings.reminderPreferences,
      daily_cap: 2,
      snoozed_until: new Date(2026, 9, 20, 14).getTime(),
    },
  };
  const plan = planReminders(p, [], now, { [localDay(now)]: 1 });
  assert.equal(
    plan.filter((r) => localDay(new Date(r.at)) === localDay(now)).length,
    1,
  );
  assert.ok(plan.every((r) => r.at >= p.reminderPreferences.snoozed_until));
});
test("after-drink and caffeine cutoff use recorded times and the saved bedtime", () => {
  const recent = {
    ...e,
    ml: 100,
    at: new Date(now.getTime() - 30 * 60000).toISOString(),
  };
  const plan = planReminders(
    {
      ...settings,
      reminderHours: [],
      reminderPreferences: {
        ...settings.reminderPreferences,
        per_drink: true,
        interval_minutes: 60,
      },
    },
    [recent],
    now,
  );
  assert.equal(plan[0].at, now.getTime() + 30 * 60000);
  const c = {
    ...e,
    drink: { ...e.drink, nutrition: { ...e.drink.nutrition, caffeine: 40 } },
  };
  const cutoff = planReminders(
    {
      ...settings,
      reminderHours: [],
      bedtime: "22:00",
      reminderPreferences: {
        ...settings.reminderPreferences,
        caffeine_cutoff: true,
        cutoff_hours: 6,
      },
    },
    [c],
    now,
  );
  assert.equal(new Date(cutoff[0].at).getHours(), 16);
  assert.equal(cutoff[0].kind, "caffeine");
});
function harness() {
  const links = new Map<string, Link>(),
    imported: Entry[] = [],
    remote = new Map<string, Entry>();
  let writes = 0;
  const adapter: HealthAdapter = {
    platform: "ios",
    remove: async (key) => {
      remote.delete(key);
    },
    write: async (entry) => {
      writes++;
      remote.set(entry.id, structuredClone(entry));
      return [entry.id];
    },
    read: async () => [],
  };
  return {
    links,
    imported,
    remote,
    adapter,
    writes: () => writes,
    save: async (key: string, value: Link) => {
      links.set(key, structuredClone(value));
    },
    remove: async (key: string) => {
      links.delete(key);
    },
    importEntry: async (entry: Entry) => {
      imported.push(entry);
    },
  };
}
test("Health updates and deletes own records, deduplicates repeats, and never exports imported records", async () => {
  const h = harness();
  await reconcileHealth(
    [e],
    h.links,
    h.adapter,
    h.save,
    h.remove,
    h.importEntry,
  );
  assert.equal(h.writes(), 1);
  await reconcileHealth(
    [e],
    h.links,
    h.adapter,
    h.save,
    h.remove,
    h.importEntry,
  );
  assert.equal(h.writes(), 1);
  await reconcileHealth(
    [{ ...e, ml: 400 }],
    h.links,
    h.adapter,
    h.save,
    h.remove,
    h.importEntry,
  );
  assert.equal(h.remote.get(e.id)?.ml, 400);
  await reconcileHealth(
    [],
    h.links,
    h.adapter,
    h.save,
    h.remove,
    h.importEntry,
  );
  assert.equal(h.remote.size, 0);
  await reconcileHealth(
    [{ ...e, health: { platform: "ios", id: "external" } }],
    h.links,
    h.adapter,
    h.save,
    h.remove,
    h.importEntry,
  );
  assert.equal(h.remote.size, 0);
});
test("Health failures leave persistent pending work that is retried without duplicate remote records", async () => {
  const h = harness();
  const write = h.adapter.write;
  let fail = true;
  h.adapter.write = async (entry) => {
    if (fail) {
      fail = false;
      throw Error("device locked");
    }
    return write(entry);
  };
  await assert.rejects(
    reconcileHealth([e], h.links, h.adapter, h.save, h.remove, h.importEntry),
  );
  assert.match(h.links.get(e.id)!.signature, /^pending:/);
  await reconcileHealth(
    [e],
    h.links,
    h.adapter,
    h.save,
    h.remove,
    h.importEntry,
  );
  assert.equal(h.remote.size, 1);
  assert.equal(h.links.get(e.id)!.signature, healthSignature(e));
});
test("imported hydration uses measured volume, leaves nutrients unknown, and respects local hide", async () => {
  const h = harness();
  h.adapter.read = async () => [
    {
      id: "external",
      ml: 375,
      at: new Date().toISOString(),
      source: "Apple Health water",
    },
  ];
  await reconcileHealth(
    [],
    h.links,
    h.adapter,
    h.save,
    h.remove,
    h.importEntry,
  );
  assert.equal(h.imported[0].ml, 375);
  assert.equal(h.imported[0].drink.nutrition.caffeine, null);
  assert.equal(h.imported[0].health?.id, "external");
  await reconcileHealth(
    [],
    h.links,
    h.adapter,
    h.save,
    h.remove,
    h.importEntry,
  );
  assert.equal(h.imported.length, 1);
});

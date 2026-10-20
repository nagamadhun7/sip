import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calculateTargets,
  quickHistory,
  progress,
  caffeineClearBy,
  repeatDay,
} from "../src/lib/tracking.ts";
import { defaults, totals, localDay } from "../src/lib/model.ts";
import type { Entry } from "../src/lib/model.ts";
const profile = {
  age: 30,
  weight_kg: 70,
  sex: "female" as const,
  status: "standard" as const,
};
const e: Entry = {
  id: "1",
  drink: {
    id: "coffee",
    name: "Coffee",
    serving: 200,
    color: "#000",
    source: "Test label",
    nutrition: {
      sugar: 2,
      caffeine: 50,
      calories: 10,
      sodium: null,
      potassium: 20,
    },
  },
  ml: 200,
  at: "2026-10-20T12:00:00Z",
};
test("targets derive from profile and preserve medical-plan targets", () => {
  const normal = calculateTargets(profile);
  assert.equal(normal.water, 1600);
  assert.equal(normal.caffeine, 399);
  assert.equal(
    calculateTargets({ ...profile, status: "pregnant" }).water,
    1840,
  );
  assert.equal(calculateTargets({ ...profile, status: "nursing" }).water, 2160);
  assert.equal(
    calculateTargets({ ...profile, status: "pregnant" }).caffeine,
    200,
  );
  assert.equal(calculateTargets({ ...profile, age: 15 }).caffeine, 0);
  assert.deepEqual(
    calculateTargets({ ...profile, status: "medical" }, defaults),
    defaults,
  );
  assert.throws(() => calculateTargets({ ...profile, weight_kg: 0 }));
});
test("quick adds are exact recent history portions, not seeded drinks", () => {
  assert.deepEqual(quickHistory([]), []);
  const recent = { ...e, id: "2", ml: 350, at: "2026-10-20T13:00:00Z" };
  assert.deepEqual(
    quickHistory([e, recent, { ...e, id: "3" }]).map((r) => r.ml),
    [350, 200],
  );
});
test("focus progress uses saved targets, unknowns prevent a false success", () => {
  const settings = { ...defaults, focus: "caffeine" as const, caffeine: 0 };
  assert.equal(progress([e], settings, localDay(e.at)).taken, 100);
  assert.equal(progress([e], settings, localDay(e.at)).onTarget, false);
  assert.equal(progress([], settings).onTarget, false);
  const missing = {
    ...e,
    drink: { ...e.drink, nutrition: { ...e.drink.nutrition, caffeine: null } },
  };
  assert.equal(
    progress([missing], { ...settings, caffeine: 400 }, localDay(e.at))
      .onTarget,
    false,
  );
});
test("clear-by is ten hours after a 100 mg log at a 25 mg threshold", () => {
  assert.equal(
    caffeineClearBy([e], Date.parse(e.at)).getTime(),
    Date.parse(e.at) + 10 * 3600000,
  );
  assert.equal(
    caffeineClearBy([], Date.parse(e.at)).getTime(),
    Date.parse(e.at),
  );
});
test("repeat yesterday preserves drink/amount snapshots without changing source history", () => {
  const copies = repeatDay(
    [e],
    localDay(e.at),
    new Date("2026-10-21T12:00:00Z"),
  );
  assert.equal(copies[0].ml, 200);
  copies[0].drink.name = "Changed";
  assert.equal(e.drink.name, "Coffee");
  assert.equal(totals(copies).caffeine, 100);
});

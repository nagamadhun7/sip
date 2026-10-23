import { test } from "node:test";
import assert from "node:assert/strict";
import { caffeineCurve } from "../src/features/caffeine-curve.ts";
import type { Entry } from "../src/lib/model.ts";
const date = (hour: number) => new Date(2026, 9, 23, hour).getTime();
const e = (hour: number, mg: number | null, id = "coffee"): Entry => ({
  id,
  ml: 100,
  at: new Date(date(hour)).toISOString(),
  drink: {
    id,
    name: id,
    serving: 100,
    color: "#A0724A",
    source: "Test label",
    nutrition: {
      sugar: 0,
      caffeine: mg,
      calories: 0,
      sodium: null,
      potassium: null,
    },
  },
});
test("daily curve rises at logged drinks then follows the five-hour half-life", () => {
  const c = caffeineCurve([e(8, 100)], date(18), "22:00");
  assert.equal(c.active, 25);
  assert.ok(Math.abs(c.points.find((p) => p.at === date(13))!.mg - 50) < 1e-8);
  assert.equal(c.points.find((p) => p.at === date(8) - 1)!.mg, 0);
  assert.equal(c.points.find((p) => p.at === date(8))!.mg, 100);
  assert.equal(c.mostlyGone, true);
});
test("multiple drinks add correctly and previous-day caffeine carries over", () => {
  const old = e(3, 100, "old");
  old.at = new Date(date(3) - 24 * 3600000).toISOString();
  const c = caffeineCurve(
    [old, e(8, 100), e(13, 100, "second")],
    date(18),
    "22:00",
  );
  assert.ok(c.active > 75);
  assert.ok(c.points[0].mg > 0);
  assert.equal(c.doses.length, 2);
});
test("bedtime marker flags remaining caffeine and moves to tomorrow after bedtime", () => {
  const c = caffeineCurve([e(20, 200)], date(21), "22:00");
  assert.equal(c.mostlyGone, false);
  assert.ok(c.atBedtime > 100);
  const next = caffeineCurve([e(20, 200)], date(23), "22:00");
  assert.equal(new Date(next.bedtime).getDate(), 24);
  assert.ok(next.end > next.bedtime);
});
test("empty, missing and future data do not fabricate caffeine", () => {
  const c = caffeineCurve([e(8, null), e(23, 200)], date(18), "22:00");
  assert.equal(c.active, 0);
  assert.equal(c.missing, 1);
  assert.equal(c.doses.length, 0);
  assert.equal(caffeineCurve([], date(18), "22:00").max, 25);
  assert.throws(() => caffeineCurve([], date(18), "25:00"));
});

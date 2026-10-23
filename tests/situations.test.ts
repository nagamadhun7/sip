import test from "node:test";
import assert from "node:assert/strict";
import {
  situationTarget,
  validateSituation,
  inEatingWindow,
} from "../src/features/situations.ts";
import { defaults, localDay } from "../src/lib/model.ts";
const s = {
  mode: "fasting" as const,
  day: localDay(),
  extra_ml: 300,
  interval_minutes: 90,
  start: "12:00",
  end: "20:00",
};
test("situation uses saved adjustment and fasting accepts only its eating window", () => {
  validateSituation(s);
  assert.equal(situationTarget({ ...defaults, situation: s }), 2500);
  const at = new Date();
  at.setHours(11);
  assert.equal(inEatingWindow(at, s), false);
  at.setHours(12);
  assert.equal(inEatingWindow(at, s), true);
  assert.equal(
    situationTarget({
      ...defaults,
      situation: { ...s, mode: "flight", day: "2000-01-01" },
    }),
    2200,
  );
  assert.throws(() => validateSituation({ ...s, interval_minutes: 0 }));
});

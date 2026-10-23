import test from "node:test";
import assert from "node:assert/strict";
import {
  standardDrinks,
  alcoholAllowed,
  alcoholWeek,
} from "../src/features/alcohol.ts";
import { defaults, localDay } from "../src/lib/model.ts";
test("standard drinks use actual ml and ABV, adults must opt in, and unlogged days are not called alcohol-free", () => {
  assert.ok(Math.abs(standardDrinks(355, 5) - 1) < 0.01);
  assert.equal(alcoholAllowed(defaults), false);
  assert.equal(alcoholWeek([], defaults).freeDays, 0);
  assert.equal(
    alcoholWeek([], {
      ...defaults,
      alcohol: { limit: 1, grams: 14, freeDays: [localDay()] },
    }).freeDays,
    1,
  );
  assert.throws(() => standardDrinks(100, 101));
});

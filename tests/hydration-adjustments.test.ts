import test from "node:test";
import assert from "node:assert/strict";
import {
  adjustmentDefaults,
  automaticAdjustment,
  logExercise,
  parseWeather,
  validateAdjustments,
} from "../src/features/hydration-adjustments.ts";
import { defaults, localDay } from "../src/lib/model.ts";
import { situationTarget } from "../src/features/situations.ts";
const now = new Date(2026, 9, 23, 12),
  day = localDay(now),
  city = { name: "Test city", latitude: 0, longitude: 0 };
const a = {
  ...adjustmentDefaults,
  enabled: true,
  city,
  hot_extra_ml: 300,
  exercise_ml_per_30: 200,
  max_extra_ml: 600,
  weather: { day, max_c: 32, fetched_at: now.toISOString(), city: city.name },
};
test("real forecast and logged exercise apply once, capped and isolated by day", () => {
  const exercise = logExercise(a, 60, now),
    s = { ...defaults, hydrationAdjustments: { ...a, exercise: [exercise] } };
  assert.equal(automaticAdjustment(s, day).extra, 600);
  assert.equal(situationTarget(s, day), defaults.water + 600);
  assert.equal(situationTarget(s, "2026-10-24"), defaults.water);
  assert.equal(
    automaticAdjustment(
      {
        ...s,
        hydrationAdjustments: { ...s.hydrationAdjustments, enabled: false },
      },
      day,
    ).extra,
    0,
  );
});
test("kidney and medical plans never get automatic or manual increases", () => {
  const s = {
    ...defaults,
    hydrationAdjustments: a,
    situation: {
      mode: "workout" as const,
      day,
      extra_ml: 500,
      interval_minutes: 120,
      start: "08:00",
      end: "20:00",
    },
  };
  assert.equal(
    situationTarget({ ...s, trackingHelper: "kidney" }, day),
    defaults.water,
  );
  assert.equal(
    situationTarget(
      {
        ...s,
        profile: { age: 30, weight_kg: 65, sex: "female", status: "medical" },
      },
      day,
    ),
    defaults.water,
  );
});
test("forecast parser rejects missing values instead of fabricating weather", () => {
  assert.throws(() =>
    parseWeather(
      { daily: { time: [day], apparent_temperature_max: [null] } },
      city.name,
      day,
      now,
    ),
  );
  assert.throws(() =>
    parseWeather(
      { daily: { time: [], apparent_temperature_max: [] } },
      city.name,
      day,
      now,
    ),
  );
  assert.equal(
    parseWeather(
      { daily: { time: [day], apparent_temperature_max: [31] } },
      city.name,
      day,
      now,
    ).max_c,
    31,
  );
  assert.equal(
    automaticAdjustment(
      {
        ...defaults,
        hydrationAdjustments: { ...a, city: { ...city, name: "Different" } },
      },
      day,
    ).extra,
    0,
  );
});
test("invalid rules and exercise durations fail; saved exercise retains its original rate", () => {
  assert.throws(() => validateAdjustments({ ...a, hot_extra_ml: -1 }));
  assert.throws(() => logExercise(a, 0));
  const entry = logExercise(a, 45, now);
  assert.equal(entry.extra_ml, 300);
  assert.equal(
    automaticAdjustment(
      {
        ...defaults,
        hydrationAdjustments: {
          ...a,
          weather: undefined,
          exercise_ml_per_30: 900,
          exercise: [entry],
        },
      },
      day,
    ).exercise,
    300,
  );
});

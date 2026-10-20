import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseLocal,
  validateParsed,
  entriesFromParsed,
  logSchema,
} from "../src/logging/parse.ts";
import { handleParse } from "../backend/src/parsing.ts";
import type { Drink } from "../src/lib/model.ts";
const coffee: Drink = {
  id: "coffee",
  name: "Coffee",
  color: "#aaa",
  serving: 240,
  source: "Label",
  nutrition: {
    sugar: 0,
    caffeine: 40,
    calories: 1,
    sodium: null,
    potassium: null,
  },
};
const water: Drink = {
  ...coffee,
  id: "water",
  name: "Water",
  serving: 250,
  nutrition: { sugar: 0, caffeine: 0, calories: 0, sodium: 0, potassium: 0 },
};
const catalog = [coffee, water],
  now = new Date(2026, 9, 20, 18, 0);
test("common drinks resolve entirely locally with actual saved servings and explicit amounts", () => {
  const p = parseLocal("250 ml water and one coffee", catalog, [], now)!;
  assert.deepEqual(
    p.map((p) => p.amount_ml),
    [250, 240],
  );
  assert.equal(
    parseLocal("coffee at 2 pm", catalog, [], now)![0].amount_ml,
    240,
  );
  assert.equal(
    new Date(parseLocal("coffee at 2 pm", catalog, [], now)![0].at).getHours(),
    14,
  );
  assert.equal(parseLocal("1 l water", catalog, [], now)![0].amount_ml, 1000);
  assert.equal(parseLocal("two coffee", catalog, [], now)![0].amount_ml, 480);
});
test("saved containers determine the portion and unresolved modifiers do not silently log a different drink", () => {
  assert.equal(
    parseLocal(
      "my bottle",
      catalog,
      [{ id: "b", name: "my bottle", drink_id: "water", ml: 650 }],
      now,
    )![0].amount_ml,
    650,
  );
  assert.equal(
    parseLocal("coffee with 5 pumps of syrup", catalog, [], now),
    null,
  );
  assert.equal(parseLocal("pizza and coffee", catalog, [], now), null);
  assert.equal(parseLocal("nonsense", catalog, [], now), null);
  assert.throws(() => parseLocal("coffee at 11 pm", catalog, [], now));
});
test("parser rejects model nutrition, filters unknown IDs and validates dates", () => {
  assert.equal(
    logSchema.safeParse({ drinks: [], message: "", nutrition: { sugar: 0 } })
      .success,
    false,
  );
  const result = {
    drinks: [
      { drink_id: "coffee", amount_ml: 240, at: now.toISOString() },
      { drink_id: "unknown", amount_ml: 240, at: now.toISOString() },
    ],
    message: "",
  };
  assert.equal(validateParsed(result, catalog, now).length, 1);
  assert.throws(() =>
    validateParsed(
      {
        ...result,
        drinks: [
          {
            ...result.drinks[0],
            at: new Date(now.getTime() + 3600000).toISOString(),
          },
        ],
      },
      catalog,
      now,
    ),
  );
  const entries = entriesFromParsed(
    validateParsed(result, catalog, now),
    catalog,
    () => "entry",
  );
  entries[0].drink.name = "Changed";
  assert.equal(coffee.name, "Coffee");
});
test("parse service skips non-drinks, retries strict JSON and enforces the shared per-user quota", async () => {
  const map = new Map<string, unknown>();
  let calls = 0;
  const deps = {
    store: {
      get: async <T>(key: string) => map.get(key) as T | undefined,
      put: async (key: string, value: unknown) => {
        map.set(key, structuredClone(value));
      },
    },
    isPro: async () => false,
    now: () => now,
    freeMonthly: 1,
    generate: async () => {
      calls++;
      return calls === 1
        ? "bad"
        : JSON.stringify({
            drinks: [
              { drink_id: "coffee", amount_ml: 240, at: now.toISOString() },
            ],
            message: "",
          });
    },
  };
  const input = {
    text: "A cold coffee please",
    now: now.toISOString(),
    timezone_offset: now.getTimezoneOffset(),
    catalog: catalog.map(({ id, name, serving }) => ({ id, name, serving })),
  };
  assert.equal(
    (await handleParse({ ...input, text: "Pizza meal" }, deps)).status,
    422,
  );
  assert.equal(calls, 0);
  assert.equal((await handleParse(input, deps)).status, 200);
  assert.equal(calls, 2);
  assert.equal((await handleParse(input, deps)).status, 429);
});

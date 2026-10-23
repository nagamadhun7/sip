import { test } from "node:test";
import assert from "node:assert/strict";
import { searchUSDADrinks } from "../backend/src/lookup.ts";
import snapshot from "../src/data/usda-base-foods.json" with { type: "json" };
test("catalog search fails clearly without configuration and never makes an AI request", async () => {
  const result = await searchUSDADrinks("milk", undefined);
  assert.equal(result.status, 503);
  assert.equal((await result.json()).code, "NOT_CONFIGURED");
  assert.equal((await searchUSDADrinks("", undefined)).status, 400);
});
test("catalog search accepts measured liquid labels and rejects gram-only serving guesses", async () => {
  const original = globalThis.fetch;
  const milk = snapshot.foods.find((f) => f.fdcId === 2485416)!;
  let calls = 0;
  globalThis.fetch = async (input) => {
    calls++;
    if (String(input).includes("foods/search"))
      return Response.json({ foods: [{ fdcId: milk.fdcId }, { fdcId: 2 }] });
    return Response.json(
      String(input).includes("food/2?")
        ? { ...milk, gtinUpc: "12345678", servingSizeUnit: "g" }
        : milk,
    );
  };
  try {
    const response = await searchUSDADrinks("milk", "test-key");
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.drinks.length, 1);
    assert.equal(result.drinks[0].serving, 240);
    assert.ok(
      Math.abs(result.drinks[0].extraNutrition.added_sugar - 11 / 2.4) < 1e-8,
    );
    assert.equal(calls, 3);
  } finally {
    globalThis.fetch = original;
  }
});

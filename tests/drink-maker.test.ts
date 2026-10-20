import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calculate,
  completeNutrition,
  swapHint,
  defaultRecipe,
  defaultProfile,
  recipeSchema,
  parseRecipeOutput,
  filterIngredientIds,
  adjustRecipe,
  goalsFor,
  checkRequest,
  toDrink,
  fitSentence,
  ingredients,
} from "../src/drink-maker/core.ts";
import type { MakerRequest, Recipe } from "../src/drink-maker/core.ts";
import { totals } from "../src/lib/model.ts";
import { handleMaker, cacheKey, outputSchema } from "../backend/src/service.ts";
import type { Store, Dependencies } from "../backend/src/service.ts";
const input = (): MakerRequest => ({
  request: "Cold vanilla latte. About 100 mg caffeine, under 10 g sugar.",
  size_ml: 400,
  filters: { dairy_free: false, vegan: false, caffeine_free: false },
  context: {
    sugar_left: 25,
    caffeine_left: 200,
    bedtime: "22:00",
    focus: "balance",
    profile: { ...defaultProfile, age_band: "18-64" },
    current_caffeine: 0,
    minutes_to_bedtime: 600,
    incomplete_sugar: false,
    incomplete_caffeine: false,
  },
});
const near = (a: number, b: number) =>
  assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);
test("catalog has estimated food values, finite nutrients and no supplements", () => {
  for (const i of ingredients) {
    assert.equal(i.estimate, "Estimated");
    assert.ok(i.max_amount > 0);
    for (const n of Object.values(i.nutrition))
      assert.ok(n === null || (Number.isFinite(n) && n >= 0));
    assert.equal(/protein powder|extract|supplement/i.test(i.name), false);
  }
});
test("totals use per-unit amounts for all five nutrients and melted volume", () => {
  const t = calculate(defaultRecipe.ingredients);
  near(t.volume_ml, 400);
  near(t.nutrition.sugar!, 14);
  near(t.nutrition.caffeine!, 126);
  near(t.nutrition.calories!, 126);
  near(t.nutrition.sodium!, 88);
  near(t.nutrition.potassium!, 270);
  assert.deepEqual(t.missing.potassium, ["Vanilla syrup"]);
});
test("unknown nutrient is not counted, but is explicitly incomplete", () => {
  const parts = [
    { ingredient_id: "sparkling-water", amount: 200, unit: "ml" as const },
  ];
  assert.equal(calculate(parts).nutrition.sodium, 0);
  assert.equal(completeNutrition(parts).sodium, null);
  assert.throws(() =>
    calculate([{ ingredient_id: "x", amount: 1, unit: "ml" }]),
  );
  assert.throws(() =>
    calculate([{ ingredient_id: "milk", amount: -1, unit: "ml" }]),
  );
  assert.throws(() =>
    calculate([{ ingredient_id: "milk", amount: 1, unit: "shot" }]),
  );
});
test("swap hint is calculated from real one-pump change", () => {
  assert.match(swapHint(defaultRecipe.ingredients), /sugar 14 g to 9 g/);
  assert.equal(calculate(defaultRecipe.ingredients).nutrition.sugar, 14);
  assert.match(
    swapHint([{ ingredient_id: "beer", amount: 100, unit: "ml" }]),
    /not listed/,
  );
});
test("strict schema rejects nutrition numbers, invalid units, negatives and extra keys", () => {
  assert.ok(recipeSchema.safeParse(defaultRecipe).success);
  for (const bad of [
    { ...defaultRecipe, nutrition: { sugar: 0 } },
    {
      ...defaultRecipe,
      ingredients: [{ ingredient_id: "milk", amount: -1, unit: "ml" }],
    },
    {
      ...defaultRecipe,
      ingredients: [{ ingredient_id: "milk", amount: 1, unit: "cup" }],
    },
    {
      ...defaultRecipe,
      ingredients: [{ ingredient_id: "milk", amount: 1, unit: "ml", sugar: 0 }],
    },
  ])
    assert.equal(recipeSchema.safeParse(bad).success, false);
});
test("JSON parser discards prose and unsafe notes; does not accept unsupported claims", () => {
  assert.deepEqual(
    parseRecipeOutput(
      "```json\n" + JSON.stringify(defaultRecipe) + "\n``` extra",
    ),
    defaultRecipe,
  );
  assert.equal(
    parseRecipeOutput(
      JSON.stringify({
        ...defaultRecipe,
        notes: "Tastes amazing and burns fat",
      }),
    ).notes,
    "",
  );
  assert.throws(() =>
    parseRecipeOutput(
      JSON.stringify({ ...defaultRecipe, name: "Fat burns fat latte" }),
    ),
  );
  assert.throws(() => parseRecipeOutput("not json"));
});
test("ID filtering drops unknowns/wrong units, applies diet and merges bounded amounts", () => {
  const r: Recipe = {
    ...defaultRecipe,
    ingredients: [
      { ingredient_id: "secret-drug", amount: 1, unit: "tsp" },
      { ingredient_id: "milk", amount: 10, unit: "ml" },
      { ingredient_id: "espresso", amount: 10, unit: "shot" },
      { ingredient_id: "espresso", amount: 1, unit: "shot" },
      { ingredient_id: "water", amount: 2, unit: "shot" },
    ],
  };
  const f = filterIngredientIds(
    r,
    { dairy_free: true, vegan: true, caffeine_free: false },
    input().context.profile,
  );
  assert.deepEqual(f.recipe.ingredients, [
    { ingredient_id: "espresso", amount: 4, unit: "shot" },
  ]);
  assert.equal(f.dropped.length, 3);
});
test("adjustment reaches sugar goal and caffeine target using catalog numbers", () => {
  const r = adjustRecipe(defaultRecipe, input());
  assert.ok(r.met);
  assert.ok(r.totals.nutrition.sugar! <= 10);
  assert.ok(Math.abs(r.totals.nutrition.caffeine! - 100) <= 15);
  near(r.totals.volume_ml, 400);
});
test("unreachable caffeine target is reported truthfully", () => {
  const r = adjustRecipe(defaultRecipe, {
    ...input(),
    request: "Iced latte about 400 mg caffeine",
  });
  assert.equal(r.met, false);
  assert.ok(r.totals.nutrition.caffeine! <= 200);
  assert.match(fitSentence(r, input().context), /Goals not fully met/);
});
test("profile and remaining limits are respected, medical limits are not replaced", () => {
  const i = input();
  i.context.profile.pregnant = true;
  i.context.caffeine_left = 400;
  assert.equal(goalsFor(i).caffeineMax, 200);
  i.context.profile.medical_plan = true;
  i.context.caffeine_left = 40;
  assert.equal(goalsFor(i).caffeineMax, 40);
  assert.ok(adjustRecipe(defaultRecipe, i).totals.nutrition.caffeine! <= 40);
  for (const age of ["unknown", "under18"] as const) {
    i.context.profile.age_band = age;
    assert.equal(goalsFor(i).caffeineMax, 0);
    assert.equal(adjustRecipe(defaultRecipe, i).totals.nutrition.caffeine, 0);
  }
});
test("diet phrases, zero caffeine and incomplete context prevent false fit claims", () => {
  const i = input();
  i.request = "Iced vegan no dairy caffeine-free latte";
  const r = adjustRecipe(defaultRecipe, i);
  assert.equal(r.totals.nutrition.caffeine, 0);
  i.context.incomplete_sugar = true;
  assert.equal(adjustRecipe(defaultRecipe, i).met, false);
});
test("alcohol only when requested, adult, enabled, and not pregnant/nursing", () => {
  const r: Recipe = {
    name: "Spritz",
    ingredients: [
      { ingredient_id: "wine", amount: 100, unit: "ml" },
      { ingredient_id: "water", amount: 100, unit: "ml" },
    ],
    notes: "",
  };
  const i = input();
  i.context.profile.alcohol_tracking = true;
  assert.equal(
    adjustRecipe(r, i).recipe.ingredients.some(
      (p) => p.ingredient_id === "wine",
    ),
    false,
  );
  i.request = "Wine spritz";
  assert.equal(
    adjustRecipe(r, i).recipe.ingredients.some(
      (p) => p.ingredient_id === "wine",
    ),
    true,
  );
  i.context.profile.pregnant = true;
  assert.equal(
    adjustRecipe(r, i).recipe.ingredients.some(
      (p) => p.ingredient_id === "wine",
    ),
    false,
  );
  assert.equal(
    outputSchema(
      input(),
    ).properties.ingredients.items.properties.ingredient_id.enum.includes(
      "wine",
    ),
    false,
  );
});
test("cheap non-drink and safety checks reject before AI; ordinary preferences pass", () => {
  for (const text of [
    "make pasta",
    "medicine drink",
    "caffeine powder coffee",
    "protein powder smoothie",
    "detox tea",
    "coffee burns fat",
    "1000 mg caffeine latte",
    "500 mg caffeine coffee",
    "qwerty",
  ])
    assert.equal(checkRequest(text).ok, false, text);
  assert.equal(checkRequest(input().request).ok, true);
});
test("saved custom drink preserves recipe, volume, icon, known partial totals and completeness", () => {
  const drink = toDrink(defaultRecipe, "saved", "#6FAEE8", "cup");
  assert.equal(drink.recipe?.ingredients.length, 4);
  assert.equal(drink.shape, "cup");
  assert.equal(drink.serving, 400);
  const t = totals([
    { id: "entry", drink, ml: 400, at: new Date().toISOString() },
  ]);
  near(t.sugar, 14);
  near(t.caffeine, 126);
  near(t.potassium, 270);
  assert.equal(t.missing.potassium, 1);
  assert.throws(() =>
    toDrink(
      {
        ...defaultRecipe,
        ingredients: [{ ingredient_id: "espresso", amount: 4, unit: "shot" }],
      },
      "x",
      "#fff",
      "glass",
    ),
  );
});
function harness(options: Partial<Dependencies> = {}) {
  const values = new Map<string, unknown>();
  let calls = 0;
  const store: Store = {
    get: async <T>(key: string) => values.get(key) as T | undefined,
    put: async (key, value) => {
      values.set(key, structuredClone(value));
    },
  };
  const deps: Dependencies = {
    store,
    isPro: async () => false,
    generate: async () => {
      calls++;
      return JSON.stringify(defaultRecipe);
    },
    now: () => new Date("2026-10-20T12:00:00Z"),
    ...options,
  };
  return { deps, values, calls: () => calls };
}
test("server skips model for invalid input, non-drinks and unsafe alcohol", async () => {
  const h = harness();
  for (const body of [
    { ...input(), size_ml: 0 },
    { ...input(), request: "Pizza dinner" },
    { ...input(), request: "Wine spritz" },
  ])
    assert.ok((await handleMaker(body, h.deps)).status >= 400);
  assert.equal(h.calls(), 0);
});
test("server caches repeats without charging AI uses, but context changes miss cache", async () => {
  const h = harness();
  const a = await (await handleMaker(input(), h.deps)).json();
  const b = await (await handleMaker(input(), h.deps)).json();
  assert.equal(a.cached, false);
  assert.equal(b.cached, true);
  assert.equal(b.usage.monthly, 1);
  assert.equal(h.calls(), 1);
  const changed = input();
  changed.context.sugar_left = 5;
  await handleMaker(changed, h.deps);
  assert.equal(h.calls(), 2);
  assert.notEqual(await cacheKey(input()), await cacheKey(changed));
});
test("free quota is server-enforced, cached result still works at quota", async () => {
  const h = harness({ freeMonthly: 1 });
  assert.equal((await handleMaker(input(), h.deps)).status, 200);
  const i = input();
  i.request += " Make another iced latte.";
  const r = await handleMaker(i, h.deps);
  assert.equal(r.status, 429);
  assert.equal((await r.json()).paywall, true);
  assert.equal((await handleMaker(input(), h.deps)).status, 200);
  assert.equal(h.calls(), 1);
});
test("daily limit, UTC rollover and Pro entitlement are enforced independently", async () => {
  const h = harness({ isPro: async () => true, proDaily: 1 });
  const first = await (await handleMaker(input(), h.deps)).json();
  assert.equal(first.usage.monthly_limit, null);
  const cached = await (await handleMaker(input(), h.deps)).json();
  assert.equal(cached.usage.pro, true);
  const i = input();
  i.request += " Another coffee";
  assert.equal((await handleMaker(i, h.deps)).status, 429);
  h.deps.now = () => new Date("2026-10-21T00:00:00Z");
  assert.equal((await handleMaker(i, h.deps)).status, 200);
});
test("invalid model output retries once; failures refund monthly use but retain daily attempt", async () => {
  let calls = 0;
  const h = harness({
    generate: async () => {
      calls++;
      return calls === 1 ? "bad" : JSON.stringify(defaultRecipe);
    },
  });
  assert.equal((await handleMaker(input(), h.deps)).status, 200);
  assert.equal(calls, 2);
  const fail = harness({
    generate: async () => {
      throw Error("offline");
    },
  });
  assert.equal((await handleMaker(input(), fail.deps)).status, 502);
  assert.equal((fail.values.get("usage") as { monthly: number }).monthly, 0);
  assert.equal((fail.values.get("usage") as { daily: number }).daily, 1);
});
test("server drops hallucinated IDs and returns computed actual totals", async () => {
  const h = harness({
    generate: async () =>
      JSON.stringify({
        ...defaultRecipe,
        ingredients: [
          ...defaultRecipe.ingredients,
          { ingredient_id: "magic", amount: 1, unit: "tsp" },
        ],
      }),
  });
  const body = await (await handleMaker(input(), h.deps)).json();
  assert.equal(
    body.recipe.ingredients.some(
      (p: { ingredient_id: string }) => p.ingredient_id === "magic",
    ),
    false,
  );
  near(
    body.totals.nutrition.sugar,
    calculate(body.recipe.ingredients).nutrition.sugar!,
  );
  assert.equal(body.met, true);
});

test("UTC monthly rollover restores free uses while billing outages fail closed", async () => {
  const h = harness({ freeMonthly: 1 });
  await handleMaker(input(), h.deps);
  h.deps.now = () => new Date("2026-11-01T00:00:00Z");
  const next = input();
  next.request += " Another iced version.";
  const body = await (await handleMaker(next, h.deps)).json();
  assert.equal(body.usage.monthly, 1);
  assert.equal(body.usage.daily, 1);
  const fail = harness({
    isPro: async () => {
      throw Error("offline");
    },
  });
  assert.equal((await handleMaker(input(), fail.deps)).status, 503);
  assert.equal(fail.calls(), 0);
});
test("adjustment stays within requested volume, ingredient bounds and nutrition limits over mixed recipes", () => {
  for (const size of [50, 150, 400, 1000])
    for (const sugar of [0, 5, 25])
      for (const caffeine of [0, 40, 200]) {
        const i = input();
        i.size_ml = size;
        i.context.sugar_left = sugar;
        i.context.caffeine_left = caffeine;
        const r = adjustRecipe(defaultRecipe, i);
        near(r.totals.volume_ml, size);
        assert.ok(r.totals.nutrition.sugar! <= Math.min(10, sugar) + 1e-6);
        assert.ok(r.totals.nutrition.caffeine! <= caffeine + 1e-6);
        assert.ok(
          r.recipe.ingredients.every(
            (p) =>
              p.amount >= 0 &&
              p.amount <=
                ingredients.find((n) => n.id === p.ingredient_id)!.max_amount,
          ),
        );
      }
});

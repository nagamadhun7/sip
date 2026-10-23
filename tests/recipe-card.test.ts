import test from "node:test";
import assert from "node:assert/strict";
import { recipeCard } from "../src/features/recipe-card.ts";
test("shared card uses saved volume and nutrition and escapes user text", () => {
  const r = recipeCard({
    id: "x",
    name: "<script>&",
    color: "#aaaaaa",
    source: "label",
    serving: 200,
    nutrition: {
      sugar: 3,
      caffeine: null,
      calories: 10,
      sodium: null,
      potassium: null,
    },
  });
  assert.match(r.xml, /&lt;script&gt;&amp;/);
  assert.match(r.xml, /sugar: 6 g/);
  assert.match(r.xml, /caffeine: not listed/);
  assert.ok(r.height > 0);
});

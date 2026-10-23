import type { Drink } from "../lib/model.ts";
import { nutrients } from "../lib/model.ts";
import data from "../data/ingredients.json" with { type: "json" };
const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[c]!,
  );
export function recipeCard(drink: Drink) {
  const wrap = (text: string) =>
    text.match(/.{1,42}(?:\s|$)|.{1,42}/g)?.map((s) => s.trim()) ?? [];
  const lines = [
    ...wrap(drink.name),
    `${drink.serving} ml · Estimated`,
    ...(drink.recipe?.ingredients.flatMap((p) =>
      wrap(
        `${data.ingredients.find((i) => i.id === p.ingredient_id)?.name ?? p.ingredient_id}: ${p.amount} ${p.unit}`,
      ),
    ) ?? ["Ingredients not recorded for this drink."]),
    ...nutrients.map(
      (k) =>
        `${k}: ${drink.nutrition[k] === null || drink.missingNutrition?.includes(k) ? "not listed" : `${+((drink.nutrition[k]! * drink.serving) / 100).toFixed(1)} ${k === "sugar" ? "g" : k === "calories" ? "kcal" : "mg"}`}`,
    ),
    "Sip · Ingredient and label estimates",
  ];
  const height = 160 + lines.length * 52;
  return {
    height,
    xml: `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="${height}" viewBox="0 0 1080 ${height}"><rect width="1080" height="${height}" fill="white"/>${lines.map((line, i) => `<text x="60" y="${90 + i * 52}" font-family="sans-serif" font-size="${i === 0 ? 40 : 30}" fill="#14436F">${escape(line)}</text>`).join("")}</svg>`,
  };
}

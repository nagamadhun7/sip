import snapshot from "./usda-base-foods.json" with { type: "json" };
import { parseUSDACatalogFood } from "../lib/usda.ts";
import type { Drink } from "../lib/model.ts";
export const usdaCatalog: Drink[] = snapshot.foods
  .map((food) => parseUSDACatalogFood(food))
  .filter((drink): drink is Drink => drink !== null);

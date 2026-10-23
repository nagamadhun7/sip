import type { Drink, Nutrient } from "./model.ts";
export function parseUSDA(barcode: string, food: any): Drink | null {
  if (
    String(food?.gtinUpc ?? "").replace(/^0+/, "") !==
    barcode.replace(/^0+/, "")
  )
    return null;
  const category =
    String(food.brandedFoodCategory ?? food.foodCategory?.description ?? "") +
    " " +
    String(food.description ?? "");
  if (
    /dressing|sauce|soup|spread|ice cream/i.test(category) ||
    !/beverage|drink|coffee|tea|milk|juice|water|soda|nectar|cola|brew/i.test(
      category,
    )
  )
    return null;
  const serving = Number(food.servingSize),
    unit = String(food.servingSizeUnit ?? "").toLowerCase();
  if (
    !["ml", "l", "cl"].includes(unit) ||
    !Number.isFinite(serving) ||
    serving <= 0
  )
    return null;
  const ml = serving * (unit === "l" ? 1000 : unit === "cl" ? 10 : 1);
  if (ml > 10000) return null;
  const labels = food.labelNutrients ?? {};
  const names: Record<Nutrient, string> = {
    sugar: "sugars",
    calories: "calories",
    sodium: "sodium",
    potassium: "potassium",
    caffeine: "caffeine",
  };
  const nutrition = Object.fromEntries(
    Object.entries(names).map(([key, name]) => {
      const value = labels[name]?.value;
      return [
        key,
        typeof value === "number" && Number.isFinite(value) && value >= 0
          ? (value * 100) / ml
          : null,
      ];
    }),
  ) as Drink["nutrition"];
  return {
    id: "barcode-" + barcode,
    barcode,
    name: String(food.description ?? "Scanned drink").slice(0, 150),
    serving: ml,
    color: "#8AB5C7",
    nutrition,
    extraNutrition: {
      carbs: labelAmount(labels.carbohydrates, ml),
      added_sugar: labelAmount(labels.addedSugar ?? labels.addedSugars, ml),
      calcium: labelAmount(labels.calcium, ml),
      vitamin_d: labelAmount(labels.vitaminD, ml),
    },
    source: `USDA FoodData Central${food.fdcId ? " #" + food.fdcId : ""} · printed serving label`,
  };
}

function labelAmount(nutrient: any, ml: number): number | null {
  const value = nutrient?.value;
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? (value * 100) / ml
    : null;
}
export function parseUSDACatalogFood(food: any): Drink | null {
  const barcode = String(food?.gtinUpc ?? "");
  if (!/^\d{8,14}$/.test(barcode)) return null;
  return parseUSDA(barcode, food);
}

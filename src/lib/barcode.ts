import type { Drink } from "./model";
export function parseProduct(barcode: string, product: any): Drink {
  if (!product || typeof product !== "object")
    throw Error("Product data is missing.");
  const n = product.nutriments ?? {},
    categories = String(product.categories_tags ?? "");
  const quantityUnit = String(
    product.product_quantity_unit ?? "",
  ).toLowerCase();
  if (
    /sauces|dressings|soups|spreads|breads/.test(categories) ||
    (!categories.includes("beverage") &&
      !["ml", "l", "cl"].includes(quantityUnit))
  )
    throw Error(
      "This product is not identified as a drink. Enter the drink label manually.",
    );
  const number = (key: string, multiplier = 1) => {
    const v = n[key];
    return v !== undefined &&
      v !== null &&
      v !== "" &&
      Number.isFinite(Number(v)) &&
      Number(v) >= 0
      ? Number(v) * multiplier
      : null;
  };
  const serving =
    typeof product.serving_size === "string"
      ? product.serving_size.match(/([\d.]+)\s*(ml|cl|l)\b/i)
      : null;
  const servingMl = serving
    ? Number(serving[1]) *
      (({ ml: 1, cl: 10, l: 1000 } as Record<string, number>)[
        serving[2].toLowerCase()
      ] ?? 1)
    : Number(product.product_quantity) *
        (quantityUnit === "l" ? 1000 : quantityUnit === "cl" ? 10 : 1) || 0;
  return {
    id: "barcode-" + barcode,
    barcode,
    name: String(
      product.product_name ||
        product.product_name_en ||
        product.brands ||
        "Scanned drink",
    ).slice(0, 150),
    color: "#8AB5C7",
    serving: servingMl > 0 && servingMl <= 10000 ? servingMl : 0,
    nutrition: {
      sugar: number("sugars_100g"),
      caffeine: number("caffeine_100g", 1000),
      calories: number("energy-kcal_100g"),
      sodium: number("sodium_100g", 1000),
      potassium: number("potassium_100g", 1000),
    },
    extraNutrition: {
      carbs: number("carbohydrates_100g"),
      added_sugar: number("added-sugars_100g"),
      calcium: number("calcium_100g", 1000),
      vitamin_d: number("vitamin-d_100g", 1000000),
    },
    source: "Open Food Facts · confirm per-100-ml values against your label",
  };
}
export async function lookupBarcode(
  barcode: string,
  signal?: AbortSignal,
  fallback?: (barcode: string) => Promise<Drink | null>,
): Promise<Drink | null> {
  if (!/^\d{8,14}$/.test(barcode)) throw Error("Enter an 8–14 digit barcode.");
  const abort = new AbortController();
  const cancel = () => abort.abort();
  signal?.addEventListener("abort", cancel);
  const timeout = setTimeout(() => abort.abort(), 12000);
  try {
    const result = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}?fields=product_name,product_name_en,brands,nutriments,categories_tags,serving_size,product_quantity_unit`,
      {
        signal: abort.signal,
        headers: {
          "User-Agent": "Sip/1.0 (iOS and Android drink tracker)",
          Accept: "application/json",
        },
      },
    );
    if (!result.ok)
      throw Error(`Product lookup failed (${result.status}). Try again later.`);
    const response = await result.json();
    if (response.status !== 1) return fallback ? fallback(barcode) : null;
    return parseProduct(barcode, response.product);
  } catch (e) {
    if (signal?.aborted) throw Error("Lookup cancelled.");
    if (fallback) return fallback(barcode);
    if (abort.signal.aborted)
      throw Error("Lookup timed out. Check your connection and try again.");
    throw e;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", cancel);
  }
}

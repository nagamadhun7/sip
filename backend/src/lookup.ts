import { parseUSDA } from "../../src/lib/usda.ts";
import { json } from "./service.ts";
export async function foodLookup(barcode: unknown, key: string | undefined) {
  if (typeof barcode !== "string" || !/^\d{8,14}$/.test(barcode))
    return json({ message: "Enter an 8–14 digit barcode." }, 400);
  if (!key)
    return json(
      {
        code: "NOT_CONFIGURED",
        message:
          "USDA fallback needs the publisher’s FoodData Central API key. Enter the label manually.",
      },
      503,
    );
  try {
    const url = "https://api.nal.usda.gov/fdc/v1/";
    const search = await fetch(
      url + "foods/search?api_key=" + encodeURIComponent(key),
      {
        method: "POST",
        signal: AbortSignal.timeout(10000),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: barcode,
          dataType: ["Branded"],
          pageSize: 10,
        }),
      },
    );
    if (!search.ok) throw Error("USDA lookup is unavailable.");
    const body = (await search.json()) as {
      foods?: { fdcId: number; gtinUpc?: string }[];
    };
    const exact = body.foods?.find(
      (f) =>
        String(f.gtinUpc ?? "").replace(/^0+/, "") ===
        barcode.replace(/^0+/, ""),
    );
    if (!exact) return json({ drink: null });
    const details = await fetch(
      url + "food/" + exact.fdcId + "?api_key=" + encodeURIComponent(key),
      { signal: AbortSignal.timeout(10000) },
    );
    if (!details.ok) throw Error("USDA details are unavailable.");
    return json({ drink: parseUSDA(barcode, await details.json()) });
  } catch {
    return json(
      {
        message:
          "USDA lookup is unavailable. Retry or enter the label manually.",
      },
      502,
    );
  }
}
export async function searchUSDADrinks(
  query: unknown,
  key: string | undefined,
) {
  if (typeof query !== "string" || query.trim().length < 2 || query.length > 80)
    return json(
      { message: "Enter a drink name from 2 to 80 characters." },
      400,
    );
  if (!key)
    return json(
      {
        code: "NOT_CONFIGURED",
        message:
          "USDA catalog search needs the publisher’s FoodData Central API key. Local drinks and manual entry still work.",
      },
      503,
    );
  try {
    const url = "https://api.nal.usda.gov/fdc/v1/";
    const response = await fetch(
      url + "foods/search?api_key=" + encodeURIComponent(key),
      {
        method: "POST",
        signal: AbortSignal.timeout(10000),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: query.trim(),
          dataType: ["Branded"],
          pageSize: 12,
        }),
      },
    );
    if (!response.ok) throw Error();
    const body = (await response.json()) as { foods?: { fdcId: number }[] };
    const { parseUSDACatalogFood } = await import("../../src/lib/usda.ts");
    const results = await Promise.allSettled(
      (body.foods ?? []).slice(0, 6).map(async (food) => {
        const detail = await fetch(
          url + "food/" + food.fdcId + "?api_key=" + encodeURIComponent(key),
          { signal: AbortSignal.timeout(8000) },
        );
        return detail.ok ? parseUSDACatalogFood(await detail.json()) : null;
      }),
    );
    const drinks = results.flatMap((result) =>
      result.status === "fulfilled" && result.value ? [result.value] : [],
    );
    return json({ drinks });
  } catch {
    return json(
      { message: "USDA catalog is unavailable. Retry or use local drinks." },
      502,
    );
  }
}

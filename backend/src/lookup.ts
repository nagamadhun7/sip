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

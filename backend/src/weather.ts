import { json } from "./service.ts";
export async function weatherLookup(
  body: unknown,
  key: string | undefined,
  request: typeof fetch = fetch,
) {
  const input = body as {
    kind?: unknown;
    query?: unknown;
    latitude?: unknown;
    longitude?: unknown;
  };
  let url: URL;
  if (
    input?.kind === "city" &&
    typeof input.query === "string" &&
    input.query.trim().length >= 2 &&
    input.query.length <= 80
  ) {
    url = new URL("https://customer-geocoding-api.open-meteo.com/v1/search");
    url.search = new URLSearchParams({
      name: input.query.trim(),
      count: "5",
      language: "en",
      format: "json",
    }).toString();
  } else if (
    input?.kind === "forecast" &&
    typeof input.latitude === "number" &&
    typeof input.longitude === "number" &&
    Number.isFinite(input.latitude) &&
    Number.isFinite(input.longitude) &&
    Math.abs(input.latitude) <= 90 &&
    Math.abs(input.longitude) <= 180
  ) {
    url = new URL("https://customer-api.open-meteo.com/v1/forecast");
    url.search = new URLSearchParams({
      latitude: String(input.latitude),
      longitude: String(input.longitude),
      daily: "apparent_temperature_max",
      timezone: "auto",
      forecast_days: "2",
    }).toString();
  } else
    return json({ message: "Choose a city or valid city coordinates." }, 400);
  if (!key)
    return json(
      {
        code: "NOT_CONFIGURED",
        message:
          "Weather needs the publisher’s commercial Open-Meteo key. Exercise adjustments work offline.",
      },
      503,
    );
  url.searchParams.set("apikey", key);
  try {
    const response = await request(url.toString(), {
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw Error("weather");
    const result = (await response.json()) as Record<string, unknown>;
    return json(
      input.kind === "city"
        ? { results: result.results ?? [] }
        : { daily: result.daily },
    );
  } catch {
    return json(
      { message: "Weather is unavailable. No new heat adjustment was added." },
      502,
    );
  }
}

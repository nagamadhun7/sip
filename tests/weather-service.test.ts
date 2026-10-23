import test from "node:test";
import assert from "node:assert/strict";
import { weatherLookup } from "../backend/src/weather.ts";
test("commercial weather requires a server key and rejects invalid requests before fetching", async () => {
  let called = false;
  const request = (async () => {
    called = true;
    return Response.json({});
  }) as typeof fetch;
  assert.equal(
    (
      await weatherLookup(
        { kind: "forecast", latitude: 999, longitude: 0 },
        "secret",
        request,
      )
    ).status,
    400,
  );
  assert.equal(
    (await weatherLookup({ kind: "city", query: "Paris" }, undefined, request))
      .status,
    503,
  );
  assert.equal(called, false);
});
test("weather proxy sends only allowlisted query fields and never returns its key", async () => {
  let url = "";
  const request = (async (u: unknown) => {
    url = String(u);
    return Response.json({
      daily: { time: ["2026-10-23"], apparent_temperature_max: [30] },
      apikey: "secret",
    });
  }) as typeof fetch;
  const r = await weatherLookup(
    { kind: "forecast", latitude: 40, longitude: -74, profile: { age: 30 } },
    "secret",
    request,
  );
  assert.equal(new URL(url).hostname, "customer-api.open-meteo.com");
  assert.equal(new URL(url).searchParams.get("apikey"), "secret");
  assert.equal(url.includes("profile"), false);
  assert.equal((await r.text()).includes("secret"), false);
});

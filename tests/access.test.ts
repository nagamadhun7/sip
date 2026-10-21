import { test } from "node:test";
import assert from "node:assert/strict";
import { accessStatus } from "../backend/src/access.ts";
test("allowance is based on server storage and verified entitlement, with UTC resets", async () => {
  const deps = {
    store: {
      get: async <T>() =>
        ({ day: "2026-10-20", month: "2026-10", daily: 2, monthly: 3 }) as T,
      put: async () => {},
    },
    now: () => new Date("2026-10-20T12:00:00Z"),
    isPro: async () => false,
  };
  const free = await (await accessStatus(deps)).json();
  assert.equal(free.daily_used, 2);
  assert.equal(free.monthly_limit, 3);
  const pro = await (
    await accessStatus({ ...deps, isPro: async () => true })
  ).json();
  assert.equal(pro.daily_limit, 10);
  assert.equal(pro.monthly_limit, null);
  const next = await (
    await accessStatus({ ...deps, now: () => new Date("2026-11-01T00:00:00Z") })
  ).json();
  assert.equal(next.daily_used, 0);
  assert.equal(next.monthly_used, 0);
});

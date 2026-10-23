import { test } from "node:test";
import assert from "node:assert/strict";
import { dailyLimitNotices } from "../src/features/daily-limits.ts";
import { defaults, totals } from "../src/lib/model.ts";
test("daily notices use personal limits and only flag nutrients actually over", () => {
  const sum = totals([]);
  sum.sugar = 30;
  sum.caffeine = 110;
  sum.sodium = 500;
  const result = dailyLimitNotices(sum, {
    ...defaults,
    sugar: 25,
    caffeine: 100,
    sodium: 1000,
  });
  assert.deepEqual(
    result.map((r) => r.key),
    ["sugar", "caffeine"],
  );
  assert.match(result[0].text, /5 g over your 25 g/);
  assert.match(result[1].text, /10 mg over your 100 mg/);
});
test("missing sugar never promises a safe remaining allowance", () => {
  const sum = totals([]);
  sum.sugar = 10;
  sum.missing.sugar = 1;
  const [notice] = dailyLimitNotices(sum, defaults);
  assert.equal(notice.over, false);
  assert.match(notice.text, /10 g recorded/);
  assert.doesNotMatch(notice.text, /left/);
  assert.match(notice.detail!, /actual total may be higher/);
});
test("zero and exact limits are handled without invented calorie targets", () => {
  const sum = totals([]);
  assert.match(
    dailyLimitNotices(sum, { ...defaults, sugar: 0 })[0].text,
    /limit reached/,
  );
  sum.sugar = 0.001;
  assert.match(
    dailyLimitNotices(sum, { ...defaults, sugar: 0 })[0].text,
    /<0.01 g over/,
  );
});

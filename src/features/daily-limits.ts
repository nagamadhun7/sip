import type { Settings, totals } from "../lib/model.ts";
export function dailyLimitNotices(
  sum: ReturnType<typeof totals>,
  settings: Settings,
) {
  return (["sugar", "caffeine", "sodium"] as const).flatMap((key) => {
    const limit = settings[key],
      amount = sum[key],
      over = amount > limit;
    if (key !== "sugar" && !over) return [];
    const missing = sum.missing[key] > 0;
    const value = Math.abs(limit - amount);
    const display =
      value > 0 && value < 0.01 ? "<0.01" : String(+value.toFixed(2));
    const unit = key === "sugar" ? "g" : "mg",
      name = key[0].toUpperCase() + key.slice(1);
    return [
      {
        key,
        over,
        missing,
        text: over
          ? `${name}: ${display} ${unit} over your ${limit} ${unit} daily limit.`
          : missing
            ? `${name}: ${+amount.toFixed(2)} ${unit} recorded of your ${limit} ${unit} daily limit.`
            : amount === limit
              ? `${name}: daily limit reached (${limit} ${unit}).`
              : `${name}: ${display} ${unit} left of your ${limit} ${unit} daily limit.`,
        detail: missing
          ? "Some drinks have this nutrient not listed; the actual total may be higher."
          : undefined,
      },
    ];
  });
}

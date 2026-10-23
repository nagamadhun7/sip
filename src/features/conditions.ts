import type { Entry, Settings } from "../lib/model.ts";
import { totals } from "../lib/model.ts";
import { goalsForSettings } from "./drink-goals.ts";
export const helperLabels = {
  none: "None",
  pregnancy: "Pregnancy",
  diabetes: "Diabetes · sugar & carb tracking",
  kidney: "Kidney plan",
  pressure: "Blood-pressure plan",
  fasting: "Intermittent fasting",
} as const;
export type TrackingHelper = keyof typeof helperLabels;
export function applyHelper(
  settings: Settings,
  helper: TrackingHelper,
): Settings {
  const next = { ...settings, trackingHelper: helper };
  const goals = goalsForSettings(settings);
  if (helper === "pregnancy") next.caffeine = Math.min(settings.caffeine, 200);
  if (helper === "diabetes") next.focus = "sugar";
  next.drinkGoals = goals.map((g) => {
    if (helper === "pregnancy" && g.key === "caffeine")
      return { ...g, amount: next.caffeine };
    if (helper === "diabetes" && ["carbs", "added_sugar"].includes(g.key))
      return { ...g, visible: true };
    // Kidney plans need a user-entered ceiling, never a generic potassium target.
    if (helper === "kidney" && g.key === "potassium")
      return {
        ...g,
        kind: "limit",
        amount: settings.trackingHelper === "kidney" ? g.amount : null,
        visible: true,
      };
    if (
      (["kidney", "pressure"].includes(helper) && g.key === "sodium") ||
      (helper === "pressure" && g.key === "potassium")
    )
      return { ...g, visible: true };
    return g;
  });
  if (helper === "fasting")
    next.situation =
      settings.situation?.mode === "fasting"
        ? settings.situation
        : {
            mode: "fasting",
            day: "",
            extra_ml: 0,
            interval_minutes: 120,
            start: "12:00",
            end: "20:00",
          };
  else if (
    settings.trackingHelper === "fasting" &&
    settings.situation?.mode === "fasting"
  )
    next.situation = undefined;
  return next;
}
export function fastingEnabled(s: Settings) {
  return s.trackingHelper === "fasting" || s.situation?.mode === "fasting";
}
export function goalFluid(entries: Entry[], s: Settings) {
  if (!fastingEnabled(s)) return totals(entries).water;
  return entries
    .filter(
      (e) =>
        e.drink.nutrition.calories === 0 &&
        !e.drink.missingNutrition?.includes("calories"),
    )
    .reduce((sum, e) => sum + e.ml, 0);
}
export function helperReason(s: Settings) {
  switch (s.trackingHelper) {
    case "pregnancy":
      return "Pregnancy helper: caffeine reference lowered to 200 mg or your existing lower limit. You can edit it in Daily targets. This covers drinks only; food and medicines may also contain caffeine.";
    case "diabetes":
      return "Sugar & carb helper: carbohydrate and sugar tracking are visible. Enter your own limits in Daily targets; no glucose predictions or insulin advice.";
    case "kidney":
      return "Kidney helper: sodium and potassium are visible. Set potassium as a ceiling from your own plan in Daily targets. Fluid needs vary; automatic goal increases are off.";
    case "pressure":
      return "Blood-pressure helper: sodium and potassium tracking are visible. Keep or edit your own sodium limit and potassium goal in Daily targets.";
    case "fasting":
      return "Fasting helper: only drinks explicitly listed as zero calories count toward the fluid goal. Other drinks stay in your log and nutrient totals. Unknown calories do not qualify. Edit the eating window in Situation mode.";
    default:
      return "Choose a tracking helper. Existing logs and limits are preserved when you turn a helper off.";
  }
}

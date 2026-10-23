import { caffeineLimit } from "../features/cutback.ts";
import { z } from "zod";
import data from "../data/ingredients.json" with { type: "json" };
import type {
  Drink,
  Nutrition,
  Nutrient,
  Settings,
  Entry,
} from "../lib/model.ts";
import { nutrients, caffeineNow } from "../lib/model.ts";
export const INGREDIENT_VERSION = data.version;
export const ingredients = data.ingredients as Ingredient[];
export type Unit = "ml" | "shot" | "pump" | "tsp";
export type Ingredient = {
  id: string;
  name: string;
  unit: Unit;
  volume_ml: number;
  step: number;
  max_amount: number;
  nutrition: Nutrition;
  extraNutrition?: Drink["extraNutrition"];
  dairy: boolean;
  vegan: boolean;
  alcohol: boolean;
  estimate: "Estimated";
};
export type Part = { ingredient_id: string; amount: number; unit: Unit };
export type Recipe = { name: string; ingredients: Part[]; notes: string };
export type Filters = {
  dairy_free: boolean;
  vegan: boolean;
  caffeine_free: boolean;
};
export type Profile = {
  age_band: "unknown" | "under18" | "18-64" | "65plus";
  pregnant: boolean;
  nursing: boolean;
  medical_plan: boolean;
  alcohol_tracking: boolean;
};
export const defaultProfile: Profile = {
  age_band: "unknown",
  pregnant: false,
  nursing: false,
  medical_plan: false,
  alcohol_tracking: false,
};
export type MakerContext = {
  sugar_left: number;
  caffeine_left: number;
  bedtime: string;
  focus: string;
  profile: Profile;
  current_caffeine: number;
  minutes_to_bedtime: number;
  incomplete_sugar: boolean;
  incomplete_caffeine: boolean;
};
const finite = z.number().finite().nonnegative();
export const profileSchema = z
  .object({
    age_band: z.enum(["unknown", "under18", "18-64", "65plus"]),
    pregnant: z.boolean(),
    nursing: z.boolean(),
    medical_plan: z.boolean(),
    alcohol_tracking: z.boolean(),
  })
  .strict();
export const filtersSchema = z
  .object({
    dairy_free: z.boolean(),
    vegan: z.boolean(),
    caffeine_free: z.boolean(),
  })
  .strict();
export const contextSchema = z
  .object({
    sugar_left: finite.max(100000),
    caffeine_left: finite.max(100000),
    bedtime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    focus: z.string().max(30),
    profile: profileSchema,
    current_caffeine: finite.max(10000000),
    minutes_to_bedtime: finite.max(1440),
    incomplete_sugar: z.boolean(),
    incomplete_caffeine: z.boolean(),
  })
  .strict();
export const requestSchema = z
  .object({
    request: z.string().trim().min(3).max(800),
    size_ml: z.number().finite().min(50).max(1000),
    filters: filtersSchema,
    context: contextSchema,
  })
  .strict();
export type MakerRequest = z.infer<typeof requestSchema>;
export const recipeSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    ingredients: z
      .array(
        z
          .object({
            ingredient_id: z.string().max(50),
            amount: z.number().finite().positive().max(1000),
            unit: z.enum(["ml", "shot", "pump", "tsp"]),
          })
          .strict(),
      )
      .min(1)
      .max(12),
    notes: z.string().max(200),
  })
  .strict();
export const findIngredient = (id: string) =>
  ingredients.find((i) => i.id === id);
export function calculate(parts: Part[]) {
  const total: Nutrition = {
    sugar: 0,
    caffeine: 0,
    calories: 0,
    sodium: 0,
    potassium: 0,
  };
  const missing: Record<Nutrient, string[]> = {
    sugar: [],
    caffeine: [],
    calories: [],
    sodium: [],
    potassium: [],
  };
  let volume = 0;
  for (const p of parts) {
    const i = findIngredient(p.ingredient_id);
    if (!i || p.unit !== i.unit || !Number.isFinite(p.amount) || p.amount < 0)
      throw Error("Invalid ingredient amount or unit.");
    volume += i.volume_ml * p.amount;
    for (const key of nutrients) {
      const n = i.nutrition[key];
      if (n === null) {
        missing[key].push(i.name);
      } else total[key] = (total[key] ?? 0) + n * p.amount;
    }
  }
  return { nutrition: total, volume_ml: volume, missing };
}
export function completeNutrition(parts: Part[]): Nutrition {
  const t = calculate(parts);
  return Object.fromEntries(
    nutrients.map((k) => [k, t.missing[k].length ? null : t.nutrition[k]]),
  ) as Nutrition;
}
export function filtersFromText(text: string, filters: Filters): Filters {
  return {
    ...filters,
    dairy_free:
      filters.dairy_free || /no dairy|dairy[- ]free|without dairy/i.test(text),
    vegan: filters.vegan || /\bvegan\b/i.test(text),
    caffeine_free:
      filters.caffeine_free || /caffeine[- ]free|no caffeine|decaf/i.test(text),
  };
}
export const alcoholRequested = (text: string) =>
  /\b(beer|wine|alcohol|vodka|rum|gin|whiskey|tequila|cocktail|spritz)\b/i.test(
    text,
  );
export function ingredientAllowed(
  i: Ingredient,
  filters: Filters,
  profile: Profile,
) {
  return !(
    (filters.dairy_free && i.dairy) ||
    (filters.vegan && !i.vegan) ||
    (filters.caffeine_free &&
      (i.nutrition.caffeine === null || i.nutrition.caffeine > 0)) ||
    (i.alcohol &&
      (!profile.alcohol_tracking ||
        !["18-64", "65plus"].includes(profile.age_band) ||
        profile.pregnant ||
        profile.nursing))
  );
}
export function filterIngredientIds(
  recipe: Recipe,
  filters: Filters,
  profile: Profile,
) {
  const parts: Part[] = [];
  const dropped: string[] = [];
  for (const p of recipe.ingredients) {
    const i = findIngredient(p.ingredient_id);
    if (!i || i.unit !== p.unit || !ingredientAllowed(i, filters, profile)) {
      dropped.push(p.ingredient_id);
      continue;
    }
    const prior = parts.find((v) => v.ingredient_id === p.ingredient_id);
    if (prior) prior.amount += p.amount;
    else parts.push({ ...p });
  }
  return {
    recipe: {
      ...recipe,
      ingredients: parts.map((p) => ({
        ...p,
        amount: Math.min(p.amount, findIngredient(p.ingredient_id)!.max_amount),
      })),
    },
    dropped,
  };
}
const banned =
  /\b(supplement|extract|stimulant|medication|medicine|drug|pill|tablet|pre[- ]?workout|protein powder|protein scoop|caffeine powder|creatine|melatonin|adderall|ephedra|nicotine|cocaine|bleach|essential oil)\b/i;
const medical =
  /\b(detox|burns? fat|weight loss|lose weight|lowers? blood pressure|cures?|treats? (?:diabetes|cancer)|heal(?:s|ing) disease)\b/i;
export function checkRequest(text: string): { ok: boolean; message: string } {
  const t = text.normalize("NFKC").replace(/[\u200B-\u200D\uFEFF]/g, "");
  if (banned.test(t))
    return {
      ok: false,
      message:
        "Drink maker uses normal food and drink ingredients, not supplements, extracts, stimulants or medicines.",
    };
  if (medical.test(t))
    return {
      ok: false,
      message:
        "Drink maker makes drink recipes, not medical or weight-loss recommendations.",
    };
  if (
    /\b(pasta|pizza|sandwich|steak|chicken|dinner|breakfast meal|meal plan|soup|salad|recipe for a cake)\b/i.test(
      t,
    )
  )
    return { ok: false, message: "Please describe a drink." };
  if (
    /(?:\b\d{4,}\s*mg\b|\b(?:5\d\d|[6-9]\d\d)\s*mg\s*(?:of )?caffeine)/i.test(t)
  )
    return {
      ok: false,
      message: "Drink maker does not make large-dose drinks.",
    };
  if (
    !/\b(drink|coffee|espresso|latte|brew|tea|milk|juice|water|soda|lemon|lime|cocoa|chocolate|vanilla|caramel|smoothie|shake|cold|hot|iced|refreshing|beer|wine|cocktail|spritz|mocha|cappuccino)\b/i.test(
      t,
    )
  )
    return {
      ok: false,
      message:
        "Please describe a drink, such as an iced coffee or sparkling lime water.",
    };
  return { ok: true, message: "" };
}
export function parseRecipeOutput(text: string): Recipe {
  let start = -1,
    depth = 0,
    quoted = false,
    escaped = false;
  for (let n = 0; n < text.length; n++) {
    const c = text[n];
    if (start < 0) {
      if (c === "{") {
        start = n;
        depth = 1;
      }
      continue;
    }
    if (quoted) {
      if (escaped) escaped = false;
      else if (c === "\\") escaped = true;
      else if (c === '"') quoted = false;
      continue;
    }
    if (c === '"') quoted = true;
    else if (c === "{") depth++;
    else if (c === "}" && --depth === 0) {
      const recipe = recipeSchema.parse(JSON.parse(text.slice(start, n + 1)));
      if (banned.test(recipe.name) || medical.test(recipe.name))
        throw Error("Unsupported recipe name.");
      return {
        ...recipe,
        notes: /^may taste (light|strong|mild|sweet|tart|bitter)\.?$/i.test(
          recipe.notes.trim(),
        )
          ? recipe.notes.trim()
          : "",
      };
    }
  }
  throw Error("The recipe response was not valid JSON.");
}
export function goalsFor(input: MakerRequest) {
  const text = input.request;
  const target =
    text.match(
      /(?:about|around|approximately|~)\s*(\d+(?:\.\d+)?)\s*mg(?:\s+of)?\s*caffeine/i,
    ) ?? text.match(/(\d+(?:\.\d+)?)\s*mg(?:\s+of)?\s*caffeine/i);
  const sugar = text.match(
    /(?:under|below|less than|at most|max(?:imum)?)\s*(\d+(?:\.\d+)?)\s*g(?:rams?)?(?:\s+of)?\s*sugar/i,
  );
  const upper = text.match(
    /(?:under|below|less than|at most)\s*(\d+(?:\.\d+)?)\s*mg(?:\s+of)?\s*caffeine/i,
  );
  const p = input.context.profile;
  let max = input.context.caffeine_left; // Never replace a medical-plan user's own remaining limit with a suggested target.
  if (p.age_band === "unknown" || p.age_band === "under18") max = 0;
  else if (!p.medical_plan && (p.pregnant || p.nursing))
    max = Math.min(max, 200);
  max = Math.min(max, 200);
  if (upper) max = Math.min(max, Number(upper[1]));
  if (filtersFromText(text, input.filters).caffeine_free) max = 0;
  return {
    sugarMax: Math.min(
      input.context.sugar_left,
      sugar ? Number(sugar[1]) : Infinity,
    ),
    caffeineMax: max,
    caffeineTarget: target && !upper ? Number(target[1]) : undefined,
  };
}
export function adjustRecipe(recipe: Recipe, input: MakerRequest) {
  const filters = filtersFromText(input.request, input.filters);
  const f = filterIngredientIds(
    {
      ...recipe,
      ingredients: recipe.ingredients.filter(
        (p) =>
          !findIngredient(p.ingredient_id)?.alcohol ||
          alcoholRequested(input.request),
      ),
    },
    filters,
    input.context.profile,
  );
  let parts = f.recipe.ingredients.map((p) => ({ ...p }));
  if (!parts.length)
    throw Error("No supported ingredients in that suggestion.");
  const goals = goalsFor(input);
  const warnings: string[] = [];
  // Coordinate descent using only catalog numbers, under fixed food-serving bounds.
  for (let pass = 0; pass < 5; pass++) {
    for (const key of ["sugar", "caffeine"] as const) {
      const limit =
        key === "sugar"
          ? goals.sugarMax
          : Math.min(goals.caffeineMax, goals.caffeineTarget ?? Infinity);
      const sum = calculate(parts).nutrition[key] ?? 0;
      if (sum > limit + 1e-6) {
        const scale = limit / sum;
        parts = parts.map((p) =>
          (findIngredient(p.ingredient_id)!.nutrition[key] ?? 0) > 0
            ? { ...p, amount: p.amount * scale }
            : p,
        );
      }
    }
    const caffeine = calculate(parts).nutrition.caffeine ?? 0;
    if (
      goals.caffeineTarget !== undefined &&
      caffeine > 0 &&
      caffeine < goals.caffeineTarget * 0.85
    ) {
      const target = Math.min(goals.caffeineTarget, goals.caffeineMax);
      const factor = target / caffeine;
      parts = parts.map((p) => {
        const i = findIngredient(p.ingredient_id)!;
        return (i.nutrition.caffeine ?? 0) > 0
          ? { ...p, amount: Math.min(i.max_amount, p.amount * factor) }
          : p;
      });
    }
    const vol = calculate(parts).volume_ml;
    if (vol > input.size_ml) {
      const factor = input.size_ml / vol;
      parts = parts.map((p) => ({ ...p, amount: p.amount * factor }));
    }
  }
  parts = parts
    .filter((p) => p.amount > 0.0001)
    .map((p) => ({ ...p, amount: Math.floor(p.amount * 100) / 100 }));
  const totalVol = calculate(parts).volume_ml;
  const gap = input.size_ml - totalVol;
  if (gap > 0.01) {
    const water = parts.find((p) => p.ingredient_id === "water");
    if (water) water.amount += gap;
    else parts.push({ ingredient_id: "water", amount: gap, unit: "ml" });
  }
  const result = { ...f.recipe, ingredients: parts };
  const totals = calculate(parts);
  const caffeine = totals.nutrition.caffeine ?? 0;
  const sugar = totals.nutrition.sugar ?? 0;
  if (f.dropped.length)
    warnings.push("Unsupported or filtered ingredients were removed.");
  const missedSugar = sugar > goals.sugarMax + 1e-6;
  const missedCaffeine =
    goals.caffeineTarget !== undefined &&
    Math.abs(caffeine - goals.caffeineTarget) >
      goals.caffeineTarget * 0.15 + 1e-6;
  if (missedSugar) warnings.push("This recipe is over your sugar goal.");
  if (missedCaffeine)
    warnings.push(
      `Caffeine is ${Math.round(caffeine)} mg; your request was about ${goals.caffeineTarget} mg.`,
    );
  if (caffeine > goals.caffeineMax + 1e-6)
    warnings.push("This recipe is over your remaining caffeine limit.");
  if (input.context.incomplete_sugar || input.context.incomplete_caffeine)
    warnings.push(
      "Some drinks today have missing nutrition; remaining limits may be incomplete.",
    );
  if (totals.missing.sugar.length || totals.missing.caffeine.length)
    warnings.push(
      "Some recipe nutrients are not listed; totals are incomplete.",
    );
  return {
    recipe: result,
    totals,
    goals,
    warnings,
    met:
      !missedSugar &&
      !missedCaffeine &&
      caffeine <= goals.caffeineMax + 1e-6 &&
      !totals.missing.sugar.length &&
      !totals.missing.caffeine.length &&
      !input.context.incomplete_sugar &&
      !input.context.incomplete_caffeine,
  };
}
export function swapHint(parts: Part[]) {
  const before = calculate(parts);
  if (before.missing.sugar.length)
    return "Some sugar values are not listed; compare known ingredient values before swapping.";
  for (const p of [...parts].sort(
    (a, b) =>
      (findIngredient(b.ingredient_id)!.nutrition.sugar ?? 0) *
        findIngredient(b.ingredient_id)!.step -
      (findIngredient(a.ingredient_id)!.nutrition.sugar ?? 0) *
        findIngredient(a.ingredient_id)!.step,
  )) {
    const i = findIngredient(p.ingredient_id)!;
    if ((i.nutrition.sugar ?? 0) <= 0 || p.amount < i.step) continue;
    const afterParts = parts.map((row) =>
      row === p ? { ...row, amount: Math.max(0, p.amount - i.step) } : row,
    );
    const after = calculate(afterParts);
    if ((before.nutrition.sugar ?? 0) - (after.nutrition.sugar ?? 0) >= 0.5)
      return `Try ${+(p.amount - i.step).toFixed(2)} ${i.unit}${i.unit === "ml" || p.amount - i.step === 1 ? "" : "s"} of ${i.name.toLowerCase()}: sugar ${+(before.nutrition.sugar ?? 0).toFixed(1)} g to ${+(after.nutrition.sugar ?? 0).toFixed(1)} g.`;
  }
  const dairy = parts.find((p) => p.ingredient_id === "milk");
  if (dairy) {
    const after = calculate(
      parts.map((p) =>
        p === dairy ? { ...p, ingredient_id: "almond-milk" } : p,
      ),
    );
    return `Try almond milk: sugar ${+(before.nutrition.sugar ?? 0).toFixed(1)} g to ${+(after.nutrition.sugar ?? 0).toFixed(1)} g.`;
  }
  return "Adjust an ingredient to compare the totals.";
}
export function toDrink(
  recipe: Recipe,
  id: string,
  color: string,
  shape: import("../lib/drink-icons").IconShape,
): Drink {
  const t = calculate(recipe.ingredients);
  if (t.volume_ml < 1 || t.volume_ml > 1000 || !recipe.name.trim())
    throw Error("Name your drink and keep its volume between 1 and 1,000 ml.");
  for (const p of recipe.ingredients) {
    const i = findIngredient(p.ingredient_id)!;
    if (p.amount > i.max_amount)
      throw Error(`${i.name} exceeds the food-serving limit.`);
  }
  if ((t.nutrition.caffeine ?? 0) > 200)
    throw Error("Keep this recipe at or below 200 mg caffeine.");
  const ns = t.nutrition;
  return {
    id,
    missingNutrition: nutrients.filter((k) => t.missing[k].length > 0),
    name: recipe.name.trim().slice(0, 100),
    serving: t.volume_ml,
    color,
    shape,
    recipe: { ...recipe, catalog_version: INGREDIENT_VERSION },
    nutrition: Object.fromEntries(
      nutrients.map((k) => [
        k,
        ns[k] === null ? null : (ns[k]! * 100) / t.volume_ml,
      ]),
    ) as Nutrition,
    extraNutrition: Object.fromEntries(
      (["added_sugar", "calcium", "vitamin_d"] as const).map((key) => {
        let amount = 0;
        for (const part of recipe.ingredients) {
          const value = findIngredient(part.ingredient_id)?.extraNutrition?.[
            key
          ];
          if (value == null) return [key, null];
          amount += value * part.amount;
        }
        return [key, (amount * 100) / t.volume_ml];
      }),
    ),
    source: "Estimated from ingredient data",
  };
}
export function buildContext(
  settings: Settings,
  entries: Entry[],
  today: {
    sugar: number;
    caffeine: number;
    missing: { sugar: number; caffeine: number };
  },
  now = new Date(),
): MakerContext {
  const bed = new Date(now);
  const [h, m] = settings.bedtime.split(":").map(Number);
  bed.setHours(h, m, 0, 0);
  if (bed <= now) bed.setDate(bed.getDate() + 1);
  const profile = { ...defaultProfile, ...settings.makerProfile, ...(settings.trackingHelper === "pregnancy" ? {pregnant:true} : {}) };
  const cap = ["unknown", "under18"].includes(profile.age_band)
    ? 0
    : !profile.medical_plan && (profile.pregnant || profile.nursing)
      ? Math.min(caffeineLimit(settings, entries), 200)
      : caffeineLimit(settings, entries);
  return {
    sugar_left: Math.max(0, settings.sugar - today.sugar),
    caffeine_left: Math.max(0, cap - today.caffeine),
    bedtime: settings.bedtime,
    focus: settings.focus,
    profile,
    current_caffeine: caffeineNow(entries, now.getTime()),
    minutes_to_bedtime: Math.round((bed.getTime() - now.getTime()) / 60000),
    incomplete_sugar: today.missing.sugar > 0,
    incomplete_caffeine: today.missing.caffeine > 0,
  };
}
export function fitSentence(
  result: ReturnType<typeof adjustRecipe>,
  context: MakerContext,
) {
  const n = result.totals.nutrition;
  const sugarLeft = Math.max(0, context.sugar_left - (n.sugar ?? 0));
  const bedtimeMg =
    (context.current_caffeine + (n.caffeine ?? 0)) *
    Math.pow(0.5, context.minutes_to_bedtime / 60 / 5);
  return `${result.met ? "Fits the checked goals" : "Goals not fully met"}: ${+sugarLeft.toFixed(1)} g sugar left; about ${Math.round(bedtimeMg)} mg caffeine estimated at your ${context.bedtime} bedtime. ${result.warnings.join(" ")}`.trim();
}
export const defaultRecipe: Recipe = {
  name: "Iced vanilla oat latte",
  ingredients: [
    { ingredient_id: "espresso", amount: 2, unit: "shot" },
    { ingredient_id: "oat-milk", amount: 200, unit: "ml" },
    { ingredient_id: "vanilla-syrup", amount: 2, unit: "pump" },
    { ingredient_id: "ice", amount: 120, unit: "ml" },
  ],
  notes: "",
};

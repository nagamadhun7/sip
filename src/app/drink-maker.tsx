import { AccessiblePressable as Pressable } from "../components/accessible-pressable";
import { DrinkAppearance } from "../components/drink-appearance";
import type { IconShape } from "../lib/drink-icons";
import React, { useEffect, useRef, useState } from "react";
import {
  View,
  
  StyleSheet,
  Keyboard,
  ActivityIndicator,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useStore } from "../state/store";
import { Page, T, Input, Row, ErrorText, colors } from "../components/ui";
import { id, onDay, localDay, totals } from "../lib/model";
import {
  calculate,
  defaultRecipe,
  ingredients,
  ingredientAllowed,
  defaultProfile,
  swapHint,
  toDrink,
  buildContext,
  checkRequest,
  adjustRecipe,
  fitSentence,
  findIngredient,
  filtersFromText,
} from "../drink-maker/core";
import type { Recipe, Filters, Part, MakerRequest } from "../drink-maker/core";
import { MakerError, requestRecipe } from "../drink-maker/client";
const units = {
  sugar: "g",
  caffeine: "mg",
  calories: "",
  sodium: "mg",
  potassium: "mg",
};
function Primary({
  busy,
  disabled,
  onPress,
}: {
  busy: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Save drink"
      disabled={busy || disabled}
      onPress={onPress}
      style={{
        minHeight: 50,
        paddingVertical: 12,
        borderRadius: 25,
        backgroundColor: colors.blue,
        alignItems: "center",
        justifyContent: "center",
        opacity: busy || disabled ? 0.5 : 1,
      }}
    >
      {busy ? (
        <ActivityIndicator />
      ) : (
        <T bold style={{ color: "#103B62" }}>
          Save drink
        </T>
      )}
    </Pressable>
  );
}
function NutritionTotals({ parts }: { parts: Part[] }) {
  const sum = calculate(parts);
  return (
    <View style={{ flexDirection: "row", gap: 16 }}>
      {(["sugar", "caffeine", "calories"] as const).map((k) => (
        <View key={k} style={{ flex: 1, gap: 3 }}>
          <T muted size={12}>
            {k[0].toUpperCase() + k.slice(1)}
          </T>
          <T bold size={28}>
            {+(sum.nutrition[k] ?? 0).toFixed(1)}
            <T size={12} muted>
              {" "}
              {units[k]}
            </T>
          </T>
          {sum.missing[k].length ? (
            <T size={11} muted>
              partial · not listed for {sum.missing[k].join(", ")}
            </T>
          ) : null}
        </View>
      ))}
    </View>
  );
}
export default function DrinkMaker() {
  const params = useLocalSearchParams<{ recipe?: string; mode?: string }>();
  const store = useStore();
  const saved = store.library.find((d) => d.id === params.recipe);
  const [mode, setMode] = useState(params.mode === "goal" ? 0 : 1),
    [recipe, setRecipe] = useState<Recipe>(
      () => saved?.recipe ?? defaultRecipe,
    ),
    [suggestion, setSuggestion] = useState<ReturnType<
      typeof adjustRecipe
    > | null>(null),
    [goalInput, setGoalInput] = useState<MakerRequest | null>(null),
    [request, setRequest] = useState(""),
    [size, setSize] = useState("400"),
    [stableId] = useState(() => saved?.id ?? id()),
    [filters, setFilters] = useState<Filters>({
      dairy_free: false,
      vegan: false,
      caffeine_free: false,
    }),
    [search, setSearch] = useState<string | null>(null),
    [error, setError] = useState(""),
    [saving, setSaving] = useState(false),
    [generating, setGenerating] = useState(false),
    [paywall, setPaywall] = useState(false),
    [usage, setUsage] = useState(""),
    [color, setColor] = useState(saved?.color ?? "#6FAEE8"),
    [shape, setShape] = useState<IconShape>(saved?.shape ?? "glass");
  const generation = useRef<AbortController | null>(null),
    saveLock = useRef(false),
    variation = useRef(0);
  const profile = { ...defaultProfile, ...store.settings.makerProfile };
  useEffect(() => () => generation.current?.abort(), []);
  const parts = recipe.ingredients;
  const recipeTotals = calculate(parts);
  const today = totals(onDay(store.entries, localDay()));
  const context = buildContext(store.settings, store.entries, today);
  let currentSuggestion: ReturnType<typeof adjustRecipe> | null = null;
  if (suggestion && goalInput) {
    try {
      currentSuggestion = adjustRecipe(suggestion.recipe, {
        ...goalInput,
        context,
      });
    } catch {
      /* A changed profile can remove every ingredient. Require a new suggestion. */
    }
  }
  function invalidateSuggestion() {
    generation.current?.abort();
    setGenerating(false);
    setSuggestion(null);
    setPaywall(false);
    setError("");
  }
  const selected = mode === 1 ? recipe : currentSuggestion?.recipe;
  function step(index: number, direction: number) {
    setError("");
    setRecipe((r) => ({
      ...r,
      ingredients: r.ingredients
        .map((p, i) => {
          if (i !== index) return p;
          const food = findIngredient(p.ingredient_id)!;
          return {
            ...p,
            amount: Math.max(
              0,
              Math.min(
                food.max_amount,
                +(p.amount + direction * food.step).toFixed(2),
              ),
            ),
          };
        })
        .filter((p) => p.amount > 0),
    }));
  }
  async function generate(again = false) {
    if (generating) return;
    const valid = checkRequest(request);
    if (!valid.ok) {
      setError(valid.message);
      setSuggestion(null);
      return;
    }
    const volume = Number(size);
    if (!Number.isFinite(volume) || volume < 50 || volume > 1000) {
      setError("Choose a drink size from 50 to 1,000 ml.");
      return;
    }
    setGenerating(true);
    setError("");
    setPaywall(false);
    generation.current?.abort();
    const controller = new AbortController();
    generation.current = controller;
    const input: MakerRequest = {
      request:
        request +
        (again
          ? `\nMake a different version (variation ${++variation.current}).`
          : ""),
      size_ml: volume,
      filters: filtersFromText(request, filters),
      context,
    };
    Keyboard.dismiss();
    try {
      const response = await requestRecipe(input, controller.signal);
      if (controller.signal.aborted) return;
      const result = adjustRecipe(response.recipe, input);
      setSuggestion(result);
      setGoalInput(input);
      setUsage(
        response.cached
          ? "Saved suggestion · no AI use charged"
          : response.usage.pro
            ? "Pro · daily limits apply"
            : `${Math.max(0, (response.usage.monthly_limit ?? response.usage.monthly) - response.usage.monthly)} free AI uses left this month`,
      );
    } catch (e) {
      if (!controller.signal.aborted) {
        setError(
          e instanceof Error
            ? e.message
            : "Could not create a drink. Try again.",
        );
        setPaywall(e instanceof MakerError && e.paywall);
      }
    } finally {
      if (!controller.signal.aborted) setGenerating(false);
    }
  }
  async function save() {
    if (!selected || saveLock.current) return;
    saveLock.current = true;
    setSaving(true);
    setError("");
    try {
      const currentFilters =
        mode === 0 && goalInput
          ? goalInput.filters
          : { dairy_free: false, vegan: false, caffeine_free: false };
      if (
        selected.ingredients.some(
          (p) =>
            !ingredientAllowed(
              findIngredient(p.ingredient_id)!,
              currentFilters,
              profile,
            ),
        )
      )
        throw Error(
          "This recipe conflicts with your current profile or filters. Edit it in Lab.",
        );
      if (!/^#[0-9a-f]{6}$/i.test(color))
        throw Error("Enter a six-digit icon color, such as #6FAEE8.");
      const drink = toDrink(selected, stableId, color, shape);
      if ((calculate(selected.ingredients).nutrition.caffeine ?? 0) > 200)
        throw Error(
          "Keep this recipe at or below 200 mg caffeine. Reduce coffee or espresso in Lab.",
        );
      await store.saveDrink(drink);
      if (saved) router.back();
      else router.replace("/my-drinks");
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not save. Your recipe is still here; please retry.",
      );
    } finally {
      setSaving(false);
      saveLock.current = false;
    }
  }
  if (search !== null) {
    const list = ingredients.filter(
      (i) =>
        ingredientAllowed(
          i,
          { dairy_free: false, vegan: false, caffeine_free: false },
          profile,
        ) && i.name.toLowerCase().includes(search.toLowerCase()),
    );
    return (
      <Page>
        <Pressable onPress={() => setSearch(null)}>
          <T muted>‹ Back to recipe</T>
        </Pressable>
        <Input
          label="Search ingredients"
          value={search}
          onChangeText={setSearch}
          placeholder="Espresso, oat milk, ice…"
        />
        <T size={12} muted>
          All values Estimated. Ordinary food and drink ingredients only.
        </T>
        {list.map((i) => (
          <Row
            key={i.id}
            title={i.name}
            detail={`${i.step} ${i.unit} · Estimated`}
            onPress={() => {
              setRecipe((r) => {
                const prior = r.ingredients.find(
                  (p) => p.ingredient_id === i.id,
                );
                return {
                  ...r,
                  ingredients: prior
                    ? r.ingredients.map((p) =>
                        p === prior
                          ? {
                              ...p,
                              amount: Math.min(i.max_amount, p.amount + i.step),
                            }
                          : p,
                      )
                    : [
                        ...r.ingredients,
                        { ingredient_id: i.id, amount: i.step, unit: i.unit },
                      ],
                };
              });
              setSearch(null);
            }}
          />
        ))}
        {!list.length ? <T muted>No matching ingredients.</T> : null}
      </Page>
    );
  }
  return (
    <Page
      footer={
        <Primary
          busy={saving}
          disabled={!selected || !selected.ingredients.length || generating}
          onPress={() => void save()}
        />
      }
    >
      <View
        accessibilityRole="tablist"
        style={{
          flexDirection: "row",
          backgroundColor: "#F1F2F3",
          borderRadius: 24,
          padding: 3,
        }}
      >
        {["Goal", "Lab"].map((label, index) => (
          <Pressable
            key={label}
            accessibilityRole="tab"
            accessibilityState={{ selected: mode === index }}
            onPress={() => {
              setMode(index);
              setError("");
            }}
            style={{
              flex: 1,
              minHeight: 40,
              borderRadius: 21,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: mode === index ? "white" : "transparent",
            }}
          >
            <T bold={mode === index}>{label}</T>
          </Pressable>
        ))}
      </View>
      {mode === 1 ? (
        <>
          <NutritionTotals parts={parts} />
          <T size={13} muted>
            {swapHint(parts)}
          </T>
          <Input
            label="Drink name"
            value={recipe.name}
            onChangeText={(name) => setRecipe((r) => ({ ...r, name }))}
          />
          <T size={12} muted>
            Ingredients
          </T>
          {parts.map((p, index) => {
            const i = findIngredient(p.ingredient_id)!;
            return (
              <View
                key={p.ingredient_id}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  paddingVertical: 12,
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  borderColor: colors.line,
                }}
              >
                <View style={{ flex: 1 }}>
                  <T>{i.name}</T>
                  <T size={11} muted>
                    Estimated
                  </T>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Decrease ${i.name}`}
                  onPress={() => step(index, -1)}
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 17,
                    borderWidth: 1,
                    borderColor: colors.line,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <T>−</T>
                </Pressable>
                <T size={14} style={{ minWidth: 68, textAlign: "center" }}>
                  {p.amount} {p.unit}
                  {p.unit === "ml" || p.amount === 1 ? "" : "s"}
                </T>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Increase ${i.name}`}
                  onPress={() => step(index, 1)}
                  disabled={p.amount >= i.max_amount}
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 17,
                    borderWidth: 1,
                    borderColor: colors.line,
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: p.amount >= i.max_amount ? 0.3 : 1,
                  }}
                >
                  <T>+</T>
                </Pressable>
              </View>
            );
          })}
          <Pressable
            accessibilityRole="button"
            onPress={() => setSearch("")}
            style={{ paddingVertical: 10 }}
          >
            <T muted>+ Add ingredient</T>
          </Pressable>
          <T size={13} muted>
            Numbers are estimates from ingredient data.
          </T>
          <T size={13} muted>
            {+recipeTotals.volume_ml.toFixed(1)} ml total. Ice is counted as
            melted volume.
          </T>
          {(["sodium", "potassium"] as const).map((k) => (
            <T key={k} size={12} muted>
              {k[0].toUpperCase() + k.slice(1)}:{" "}
              {+(recipeTotals.nutrition[k] ?? 0).toFixed(1)} mg
              {recipeTotals.missing[k].length
                ? " · not listed for " + recipeTotals.missing[k].join(", ")
                : ""}
            </T>
          ))}
          <T size={12} muted>
            {(recipeTotals.nutrition.sugar ?? 0) > context.sugar_left
              ? "This recipe goes over your remaining sugar limit. "
              : ""}
            {(recipeTotals.nutrition.caffeine ?? 0) > context.caffeine_left
              ? "This recipe goes over your remaining caffeine limit. "
              : ""}
          </T>
        </>
      ) : (
        <>
          <T size={13} muted>
            A few free AI uses each month. Pro has a higher daily allowance. Lab
            is always free.
          </T>
          <Input
            label="What would you like?"
            value={request}
            onChangeText={(text) => {
              setRequest(text);
              invalidateSuggestion();
            }}
            multiline
            placeholder="Cold, vanilla, no dairy. About 100 mg caffeine, under 10 g sugar."
          />
          <Input
            label="Size (ml)"
            value={size}
            onChangeText={(v) => {
              setSize(v);
              invalidateSuggestion();
            }}
            numeric
          />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
            {(["dairy_free", "vegan", "caffeine_free"] as const).map((k) => (
              <Pressable
                key={k}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: filters[k] }}
                onPress={() => {
                  setFilters((f) => ({ ...f, [k]: !f[k] }));
                  invalidateSuggestion();
                }}
                style={{
                  paddingVertical: 8,
                  borderBottomWidth: filters[k] ? 2 : StyleSheet.hairlineWidth,
                  borderColor: filters[k] ? colors.blue : colors.line,
                }}
              >
                <T size={14}>
                  {k === "dairy_free"
                    ? "Dairy-free"
                    : k === "vegan"
                      ? "Vegan"
                      : "Caffeine-free"}
                  {filters[k] ? " ✓" : ""}
                </T>
              </Pressable>
            ))}
          </View>
          <Row
            title="Profile and limits"
            detail={`${profile.age_band === "unknown" ? "Age not set" : profile.age_band} · ${context.sugar_left.toFixed(1)} g sugar and ${Math.round(context.caffeine_left)} mg caffeine left`}
            onPress={() => router.push("/maker-profile")}
          />
          <T size={12} muted>
            Generate shares this request, limits, bedtime, focus, age band and
            pregnancy/nursing/dietary settings with the recipe server and
            OpenAI. Your drink history is not sent.
          </T>
          <Pressable
            accessibilityRole="button"
            disabled={generating}
            onPress={() => void generate()}
            style={{ paddingVertical: 12 }}
          >
            {generating ? (
              <ActivityIndicator />
            ) : (
              <T bold style={{ color: "#103B62" }}>
                Generate recipe
              </T>
            )}
          </Pressable>
          {generating ? (
            <Pressable
              onPress={() => {
                generation.current?.abort();
                setGenerating(false);
              }}
            >
              <T muted>Cancel</T>
            </Pressable>
          ) : null}
          {suggestion && !currentSuggestion ? (
            <T muted>
              Your profile no longer allows this recipe. Generate another
              suggestion.
            </T>
          ) : null}
          {currentSuggestion ? (
            <>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  gap: 8,
                }}
              >
                <T size={24} bold style={{ flex: 1 }}>
                  {currentSuggestion!.recipe.name}
                </T>
                <T size={11} muted>
                  Suggested
                </T>
              </View>
              {currentSuggestion!.recipe.ingredients.map((p) => (
                <Row
                  key={p.ingredient_id}
                  title={findIngredient(p.ingredient_id)!.name}
                  value={`${+p.amount.toFixed(2)} ${p.unit}`}
                />
              ))}
              <NutritionTotals parts={currentSuggestion!.recipe.ingredients} />
              <T size={13} muted>
                {goalInput
                  ? fitSentence(
                      adjustRecipe(currentSuggestion!.recipe, {
                        ...goalInput,
                        context,
                      }),
                      context,
                    )
                  : ""}
              </T>
              {currentSuggestion!.recipe.notes ? (
                <T size={12} muted>
                  {currentSuggestion!.recipe.notes}
                </T>
              ) : null}
              <T size={12} muted>
                {usage}
              </T>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                }}
              >
                <Pressable
                  disabled={generating}
                  onPress={() => void generate(true)}
                >
                  <T style={{ color: "#103B62" }}>Try again</T>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setRecipe(currentSuggestion!.recipe);
                    setMode(1);
                  }}
                >
                  <T style={{ color: "#103B62" }}>Edit in Lab</T>
                </Pressable>
              </View>
            </>
          ) : null}
        </>
      )}
      <DrinkAppearance
        shape={shape}
        color={color}
        onShape={setShape}
        onColor={setColor}
      />
      <ErrorText error={error} />
      {paywall ? (
        <Pressable onPress={() => router.push("/pro")}>
          <T style={{ color: "#103B62" }}>View Sip Pro</T>
        </Pressable>
      ) : null}
    </Page>
  );
}

export { ErrorBoundary } from "../components/route-error";

import { DrinkIcon } from "../components/drink-icon";
import { DrinkAppearance } from "../components/drink-appearance";
import React, { useState } from "react";
import { View, Pressable, Alert, Platform, Image } from "react-native";
import { router, useLocalSearchParams, Stack } from "expo-router";
import { DateTimePicker } from "@expo/ui/community/datetime-picker";
import { useStore } from "../state/store";

import {
  Drink,
  Entry,
  id,
  nutrients,
  Nutrient,
  validateEntry,
  totals,
  onDay,
  localDay,
} from "../lib/model";
import {
  Page,
  T,
  Input,
  Button,
  Row,
  ErrorText,
  colors,
} from "../components/ui";
import { requestRecipe } from "../drink-maker/client";
import { buildContext, toDrink, adjustRecipe } from "../drink-maker/core";
export default function DrinkForm() {
  const params = useLocalSearchParams<{
    drink?: string;
    entry?: string;
    custom?: string;
    name?: string;
    barcode?: string;
    photo?: string;
  }>();
  const store = useStore();
  const existing = store.entries.find((e) => e.id === params.entry),
    base =
      existing?.drink ??
      [...store.library, ...store.catalog].find((d) => d.id === params.drink);
  const [initial, setInitial] = useState<Drink>(
    () =>
      base ?? {
        id: id(),
        name: params.name ?? "",
        color: colors.blue,
        shape: "tall-glass",
        iconType: "custom-drink",
        serving: 0,
        nutrition: {
          sugar: null,
          caffeine: null,
          calories: null,
          sodium: null,
          potassium: null,
        },
        source: "Entered from label",
        barcode: params.barcode,
        label_photo: params.photo,
      },
  );
  const [name, setName] = useState(initial.name),
    [ml, setMl] = useState(
      String(
        +(
          (existing?.ml ?? initial.serving) /
          (store.settings.units === "oz" ? 29.5735295625 : 1)
        ).toFixed(3),
      ),
    ),
    [at, setAt] = useState(() => new Date(existing?.at ?? Date.now())),
    [nutrition, setNutrition] = useState(
      Object.fromEntries(
        nutrients.map((k) => [
          k,
          initial.nutrition[k] === null ? "" : String(initial.nutrition[k]),
        ]),
      ) as Record<Nutrient, string>,
    ),
    [description, setDescription] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [containerName, setContainerName] = useState(""),
    [picker, setPicker] = useState<"date" | "time" | null>(null);
  const unit = {
    sugar: "g",
    caffeine: "mg",
    calories: "kcal",
    sodium: "mg",
    potassium: "mg",
  };
  const factor = store.settings.units === "oz" ? 29.5735295625 : 1;
  const amount = Number(ml.replace(",", ".")) * factor;
  const norm = (s: string) =>
    s.trim() === "" ? null : Number(s.replace(",", "."));
  const draft = (): Entry => ({
    id: existing?.id ?? id(),
    health: existing?.health,
    ml: amount,
    at: at.toISOString(),
    drink: {
      ...initial,
      name: name.trim(),
      serving: amount,
      missingNutrition: nutrients.every(
        (k) => norm(nutrition[k]) === initial.nutrition[k],
      )
        ? initial.missingNutrition
        : [],
      recipe: nutrients.every(
        (k) => norm(nutrition[k]) === initial.nutrition[k],
      )
        ? initial.recipe
        : undefined,
      nutrition: Object.fromEntries(
        nutrients.map((k) => [k, norm(nutrition[k])]),
      ) as Drink["nutrition"],
    },
  });
  async function fromText() {
    setBusy(true);
    setError("");
    try {
      if (!Number.isFinite(amount) || amount < 50 || amount > 1000)
        throw Error("Choose an amount from 50 to 1,000 ml first.");
      const input = {
        request: description,
        size_ml: amount,
        filters: { dairy_free: false, vegan: false, caffeine_free: false },
        context: buildContext(
          store.settings,
          store.entries,
          totals(onDay(store.entries, localDay())),
        ),
      };
      const response = await requestRecipe(input, new AbortController().signal);
      const adjusted = adjustRecipe(response.recipe, input);
      const drink = toDrink(
        adjusted.recipe,
        initial.id,
        initial.color,
        "glass",
      );
      setInitial(drink);
      setName(drink.name);
      setMl(String(+(drink.serving / factor).toFixed(3)));
      setNutrition(
        Object.fromEntries(
          nutrients.map((k) => [
            k,
            drink.nutrition[k] === null ? "" : String(drink.nutrition[k]),
          ]),
        ) as Record<Nutrient, string>,
      );
      if (!adjusted.met) setError(adjusted.warnings.join(" "));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function save(onlyLibrary = false) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (!/^#[0-9a-f]{6}$/i.test(initial.color))
        throw Error("Enter a six-digit icon color, such as #6FAEE8.");
      const entry = draft();
      validateEntry(entry);
      if (onlyLibrary || !base || params.custom)
        await store.saveDrink({ ...entry.drink, id: base?.id ?? initial.id });
      if (containerName.trim()) {
        await store.saveDrink(entry.drink);
        await store.saveContainer({
          id: id(),
          name: containerName.trim(),
          drink_id: entry.drink.id,
          ml: entry.ml,
        });
      }
      if (!onlyLibrary) await store.saveEntry(entry);
      router.dismissAll();
      router.replace("/");
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not save. Your changes are still here; try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!existing) return;
    setBusy(true);
    try {
      await store.removeEntry(existing.id);
      router.dismissAll();
      router.replace("/");
    } catch {
      setError("Could not delete this entry. Please try again.");
      setBusy(false);
    }
  }
  return (
    <Page
      footer={
        <Button
          title={existing ? "Save changes" : "Add to today"}
          onPress={() => save()}
          busy={busy}
        />
      }
    >
      <Stack.Screen
        options={{
          title: existing
            ? "Edit a drink"
            : params.custom
              ? "New drink"
              : name || "Drink",
        }}
      />
      <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
        <DrinkIcon drink={initial} size={36} />
        <T size={28} bold>
          {name || "New drink"}
        </T>
      </View>
      {!existing?.health ? (
        <DrinkAppearance
          shape={initial.shape ?? "tall-glass"}
          color={initial.color}
          onShape={(shape) =>
            setInitial({ ...initial, shape, iconType: "custom-drink" })
          }
          onColor={(color) =>
            setInitial({
              ...initial,
              color,
              shape: initial.shape ?? "tall-glass",
              iconType: "custom-drink",
            })
          }
        />
      ) : null}
      {initial.label_photo ? (
        <>
          <Image
            accessibilityLabel="Saved nutrition label"
            source={{ uri: initial.label_photo }}
            style={{ width: "100%", height: 240 }}
            resizeMode="contain"
          />
          <T muted>
            Enter the printed values below. The photo stays on this device.
          </T>
        </>
      ) : null}
      <Input
        label="Drink name"
        value={name}
        onChangeText={setName}
        placeholder="e.g. Iced oat latte"
      />
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 18 }}>
        <Pressable
          accessibilityLabel="Decrease amount"
          onPress={() =>
            setMl(String(+(Math.max(1, amount - 50) / factor).toFixed(3)))
          }
          style={{
            padding: 16,
            borderWidth: 1,
            borderColor: colors.line,
            borderRadius: 28,
          }}
        >
          <T size={22}>−</T>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Input
            numeric
            label={`Amount (${store.settings.units === "oz" ? "US fl oz" : "ml"})`}
            value={ml}
            onChangeText={setMl}
          />
        </View>
        <Pressable
          accessibilityLabel="Increase amount"
          onPress={() =>
            setMl(String(+(Math.min(10000, amount + 50) / factor).toFixed(3)))
          }
          style={{
            padding: 16,
            borderWidth: 1,
            borderColor: colors.line,
            borderRadius: 28,
          }}
        >
          <T size={22}>+</T>
        </Pressable>
      </View>
      <Row
        title="Date"
        value={at.toLocaleDateString()}
        onPress={() => setPicker("date")}
      />
      <Row
        title="Time"
        value={at.toLocaleTimeString([], {
          hour: "numeric",
          minute: "2-digit",
        })}
        onPress={() => setPicker("time")}
      />
      {picker ? (
        <View style={{ gap: 10 }}>
          <DateTimePicker
            value={at}
            mode={picker}
            maximumDate={new Date()}
            onChange={(event, date) => {
              if (date && event.type !== "dismissed") setAt(date);
              if (Platform.OS === "android") setPicker(null);
            }}
            onDismiss={() => setPicker(null)}
          />
          {Platform.OS === "ios" ? (
            <Button secondary title="Done" onPress={() => setPicker(null)} />
          ) : null}
        </View>
      ) : null}
      {!existing ? (
        <>
          <Input
            label="Build custom drink from text"
            value={description}
            onChangeText={setDescription}
            placeholder="Iced vanilla oat latte"
          />
          <Button
            secondary
            title="Build recipe from text"
            disabled={busy || !description.trim()}
            onPress={() => void fromText()}
          />
          <T size={12} muted>
            Shares this request and your selected profile context with the
            recipe service. Nutrition is calculated from ingredient data.
          </T>
        </>
      ) : null}
      <View style={{ gap: 5 }}>
        <T size={20} bold>
          Nutrition
        </T>
        <T size={13} muted>
          Enter label values per 100 ml. Blank means unknown, not zero.
        </T>
        <T size={12} muted>
          {initial.source}
        </T>
      </View>
      {nutrients.map((k) => (
        <View
          key={k}
          style={{ flexDirection: "row", alignItems: "center", gap: 20 }}
        >
          <View style={{ flex: 1 }}>
            <Input
              numeric
              label={`${k[0].toUpperCase() + k.slice(1)} (${unit[k]} / 100 ml)`}
              value={nutrition[k]}
              onChangeText={(v) => setNutrition((n) => ({ ...n, [k]: v }))}
              placeholder="Not listed"
            />
          </View>
          <View style={{ width: 85, alignItems: "flex-end" }}>
            <T bold>
              {nutrition[k].trim() &&
              Number.isFinite(norm(nutrition[k])) &&
              Number.isFinite(amount)
                ? +((Number(norm(nutrition[k])) * amount) / 100).toFixed(1)
                : "not listed"}
            </T>
            <T size={12} muted>
              {unit[k]} in drink
            </T>
          </View>
        </View>
      ))}
      <Input
        label="Save as container (optional name)"
        value={containerName}
        onChangeText={setContainerName}
        placeholder="My bottle"
      />
      <ErrorText error={error} />
      {!existing ? (
        <Button
          title="Save to my drinks only"
          secondary
          onPress={() => save(true)}
          disabled={busy}
        />
      ) : (
        <Button
          title="Delete this entry"
          danger
          disabled={busy}
          onPress={() =>
            Alert.alert(
              "Delete this drink?",
              "This removes this entry and recalculates your totals.",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Delete",
                  style: "destructive",
                  onPress: () => void remove(),
                },
              ],
            )
          }
        />
      )}
      <T size={12} muted>
        Nutrition is an estimate unless verified against your label. Sugar is
        total sugar; product labels do not always report added sugar separately.
      </T>
    </Page>
  );
}

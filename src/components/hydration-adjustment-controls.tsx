import React, { useState } from "react";
import { View } from "react-native";
import { Host, Switch } from "@expo/ui";
import { useStore } from "../state/store";
import { localDay } from "../lib/model";
import {
  adjustmentDefaults,
  validateAdjustments,
  automaticBlocked,
  logExercise,
  fetchCity,
  fetchWeather,
  adjustmentReason,
  type HydrationAdjustments,
} from "../features/hydration-adjustments";
import { situationTarget } from "../features/situations";
import { T, Button, Input, ErrorText } from "./ui";
export function HydrationAdjustmentControls() {
  const store = useStore(),
    saved = store.settings.hydrationAdjustments;
  const [enabled, setEnabled] = useState(saved?.enabled ?? false),
    [threshold, setThreshold] = useState(String(saved?.threshold_c ?? 30)),
    [heat, setHeat] = useState(String(saved?.hot_extra_ml ?? 0)),
    [rate, setRate] = useState(String(saved?.exercise_ml_per_30 ?? 0)),
    [cap, setCap] = useState(String(saved?.max_extra_ml ?? 1500)),
    [query, setQuery] = useState(""),
    [city, setCity] = useState(saved?.city),
    [cities, setCities] = useState<NonNullable<HydrationAdjustments["city"]>[]>(
      [],
    ),
    [minutes, setMinutes] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const current = () => ({
    ...adjustmentDefaults,
    ...store.settings.hydrationAdjustments,
  });
  return (
    <View style={{ gap: 12 }}>
      <T size={13} muted>
        Set your own extra fluid for heat and exercise. No adjustment is assumed
        until you enter one. Rules change the goal and behind-goal reminders;
        they do not estimate sweat loss.
      </T>
      {automaticBlocked(store.settings) ? (
        <T size={13}>
          Automatic increases are disabled for your kidney or medical plan.
        </T>
      ) : null}
      <Host matchContents>
        <Switch
          label="Automatic water-goal adjustments"
          value={enabled}
          disabled={busy || automaticBlocked(store.settings)}
          onValueChange={setEnabled}
        />
      </Host>
      <Input
        label="Hot-day feels-like threshold (0–55 °C)"
        numeric
        value={threshold}
        onChangeText={setThreshold}
      />
      <Input
        label="Extra fluid on a hot day (0–3,000 ml)"
        numeric
        value={heat}
        onChangeText={setHeat}
      />
      <Input
        label="Extra per 30 exercise minutes (0–1,500 ml)"
        numeric
        value={rate}
        onChangeText={setRate}
      />
      <Input
        label="Maximum automatic extra per day (0–3,000 ml)"
        numeric
        value={cap}
        onChangeText={setCap}
      />
      <T size={13} muted>
        City weather uses Open-Meteo’s daily feels-like forecast. Searching
        sends only your city query; no GPS permission or drink/profile data is
        used.
      </T>
      <Input label="Weather city" value={query} onChangeText={setQuery} />
      <Button
        secondary
        title="Find weather city"
        disabled={busy}
        onPress={() =>
          void run(async () => {
            const found = await fetchCity(query);
            setCities(found);
            if (!found.length) setMessage("No city found. Try a nearby city.");
          })
        }
      />
      {cities.map((c) => (
        <Button
          secondary
          key={`${c.latitude}:${c.longitude}`}
          title={c.name}
          onPress={() => {
            setCity(c);
            setCities([]);
          }}
        />
      ))}
      <T size={13}>
        {city
          ? `Selected city: ${city.name}`
          : "No weather city selected. Exercise still works offline."}
      </T>
      {city ? (
        <Button
          secondary
          title="Clear weather city"
          disabled={busy}
          onPress={() => {
            setCity(undefined);
            setCities([]);
          }}
        />
      ) : null}
      <Button
        title="Save adjustment rules"
        busy={busy}
        onPress={() =>
          void run(async () => {
            const next = {
              ...current(),
              enabled,
              threshold_c: Number(threshold),
              hot_extra_ml: Number(heat),
              exercise_ml_per_30: Number(rate),
              max_extra_ml: Number(cap),
              city,
              weather:
                city?.name === saved?.city?.name && city
                  ? current().weather
                  : undefined,
              weather_error: undefined,
            };
            if ([threshold, heat, rate, cap].some((v) => !v.trim()))
              throw Error("Fill in every rule; enter 0 for no increase.");
            validateAdjustments(next);
            await store.saveSettings({
              ...store.settings,
              hydrationAdjustments: next,
            });
            setMessage("Adjustment rules saved.");
          })
        }
      />
      <Button
        secondary
        title="Refresh weather now"
        disabled={busy || !saved?.city}
        onPress={() =>
          void run(async () => {
            const a = current(),
              weather = await fetchWeather(a);
            await store.saveSettings({
              ...store.settings,
              hydrationAdjustments: { ...a, weather, weather_error: undefined },
            });
            setMessage("Forecast saved on this device.");
          })
        }
      />
      <T size={13}>{adjustmentReason(store.settings)}</T>
      <T size={13}>
        Today’s adjusted total-fluid goal: {situationTarget(store.settings)} ml.
        Manual situation adjustments and automatic extras are combined.
      </T>
      {saved?.weather ? (
        <T size={12} muted>
          Forecast refreshed{" "}
          {new Date(saved.weather.fetched_at).toLocaleString()}. Source:
          Open-Meteo. Previous-day forecasts never increase today’s goal.
        </T>
      ) : null}
      <ErrorText error={saved?.weather_error ?? ""} />
      <Input
        label="Exercise just completed (minutes)"
        numeric
        value={minutes}
        onChangeText={setMinutes}
      />
      <Button
        title="Log exercise"
        disabled={busy}
        onPress={() =>
          void run(async () => {
            const a = current(),
              entry = logExercise(a, Number(minutes));
            await store.saveSettings({
              ...store.settings,
              hydrationAdjustments: { ...a, exercise: [...a.exercise, entry] },
            });
            setMinutes("");
            setMessage("Exercise saved using your saved adjustment rate.");
          })
        }
      />
      {(saved?.exercise ?? [])
        .filter((e) => localDay(e.at) === localDay())
        .map((e) => (
          <View key={e.id} style={{ gap: 6 }}>
            <T size={13}>
              {e.minutes} min · {new Date(e.at).toLocaleTimeString()} ·{" "}
              {e.extra_ml} ml rule adjustment
            </T>
            <Button
              secondary
              title={`Remove ${e.minutes} minute exercise log`}
              disabled={busy}
              onPress={() =>
                void run(async () => {
                  const a = current();
                  await store.saveSettings({
                    ...store.settings,
                    hydrationAdjustments: {
                      ...a,
                      exercise: a.exercise.filter((x) => x.id !== e.id),
                    },
                  });
                })
              }
            />
          </View>
        ))}
      {!(saved?.exercise ?? []).some((e) => localDay(e.at) === localDay()) ? (
        <T muted size={13}>
          No exercise logged today.
        </T>
      ) : null}
      {message ? <T size={13}>{message}</T> : null}
      <ErrorText error={error} />
    </View>
  );
}

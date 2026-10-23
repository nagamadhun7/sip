import type { Settings } from "../lib/model.ts";
import { localDay, id } from "../lib/model.ts";
export type ExerciseLog = {
  id: string;
  at: string;
  minutes: number;
  extra_ml: number;
};
export type HydrationAdjustments = {
  enabled: boolean;
  threshold_c: number;
  hot_extra_ml: number;
  exercise_ml_per_30: number;
  max_extra_ml: number;
  city?: { name: string; latitude: number; longitude: number };
  weather?: { day: string; max_c: number; fetched_at: string; city: string };
  weather_error?: string;
  exercise: ExerciseLog[];
};
// Editable tracking rules, not estimates of sweat loss or a prescribed intake.
export const adjustmentDefaults: HydrationAdjustments = {
  enabled: false,
  threshold_c: 30,
  hot_extra_ml: 0,
  exercise_ml_per_30: 0,
  max_extra_ml: 1500,
  exercise: [],
};
export function validateAdjustments(a: HydrationAdjustments) {
  for (const [value, max] of [
    [a.hot_extra_ml, 3000],
    [a.exercise_ml_per_30, 1500],
    [a.max_extra_ml, 3000],
  ])
    if (!Number.isFinite(value) || value < 0 || value > max)
      throw Error("Choose water adjustments within the displayed ranges.");
  if (
    !Number.isFinite(a.threshold_c) ||
    a.threshold_c < 0 ||
    a.threshold_c > 55
  )
    throw Error("Choose a heat threshold from 0–55 °C.");
}
export function automaticBlocked(s: Settings) {
  return s.trackingHelper === "kidney" || s.profile?.status === "medical";
}
export function automaticAdjustment(s: Settings, day = localDay()) {
  const a = s.hydrationAdjustments;
  if (!a?.enabled || automaticBlocked(s))
    return { extra: 0, heat: 0, exercise: 0 };
  const heat =
    a.weather?.day === day &&
    a.weather.city === a.city?.name &&
    a.weather.max_c >= a.threshold_c
      ? a.hot_extra_ml
      : 0;
  const exercise = a.exercise
    .filter((e) => localDay(e.at) === day)
    .reduce((n, e) => n + e.extra_ml, 0);
  return { extra: Math.min(a.max_extra_ml, heat + exercise), heat, exercise };
}
export function logExercise(
  a: HydrationAdjustments,
  minutes: number,
  now = new Date(),
): ExerciseLog {
  if (!Number.isFinite(minutes) || minutes < 1 || minutes > 720)
    throw Error("Enter exercise minutes from 1–720.");
  validateAdjustments(a);
  return {
    id: id(),
    at: now.toISOString(),
    minutes,
    extra_ml: Math.round((minutes / 30) * a.exercise_ml_per_30),
  };
}
export function parseWeather(
  body: any,
  city: string,
  day: string,
  now = new Date(),
) {
  const index = body?.daily?.time?.indexOf(day),
    value = body?.daily?.apparent_temperature_max?.[index];
  if (
    index < 0 ||
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < -90 ||
    value > 70
  )
    throw Error(
      "Today's weather is unavailable. No heat adjustment was added.",
    );
  return { day, max_c: value, fetched_at: now.toISOString(), city };
}
let weatherService: ((body: unknown) => Promise<any>) | undefined;
export function configureWeatherService(
  service: (body: unknown) => Promise<any>,
) {
  weatherService = service;
}
export async function fetchCity(query: string) {
  if (query.trim().length < 2) throw Error("Enter a city name.");
  let data: any;
  if (weatherService)
    data = await weatherService({ kind: "city", query: query.trim() });
  else {
    const response = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query.trim())}&count=5&language=en&format=json`,
      { signal: AbortSignal.timeout(10000) },
    );
    if (!response.ok) throw Error("City search is unavailable. Try again.");
    data = await response.json();
  }
  return (data.results ?? [])
    .filter(
      (r: any) => Number.isFinite(r.latitude) && Number.isFinite(r.longitude),
    )
    .map((r: any) => ({
      name: [r.name, r.admin1, r.country].filter(Boolean).join(", "),
      latitude: r.latitude,
      longitude: r.longitude,
    })) as NonNullable<HydrationAdjustments["city"]>[];
}
export async function fetchWeather(a: HydrationAdjustments, now = new Date()) {
  if (!a.city) throw Error("Choose a city first.");
  if (weatherService)
    return parseWeather(
      await weatherService({
        kind: "forecast",
        latitude: a.city.latitude,
        longitude: a.city.longitude,
      }),
      a.city.name,
      localDay(now),
      now,
    );
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${a.city.latitude}&longitude=${a.city.longitude}&daily=apparent_temperature_max&timezone=auto&forecast_days=2`;
  const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!response.ok)
    throw Error("Weather is unavailable. Your saved goal is unchanged.");
  return parseWeather(await response.json(), a.city.name, localDay(now), now);
}
export function adjustmentReason(s: Settings, day = localDay()) {
  if (automaticBlocked(s))
    return "Automatic increases are off for your kidney or medical plan. Keep the fluid goal from your own plan.";
  const a = s.hydrationAdjustments,
    v = automaticAdjustment(s, day);
  if (!a?.enabled) return "Automatic adjustments are off.";
  return `Automatic adjustment: +${v.extra} ml (${v.heat} ml heat rule, ${v.exercise} ml logged exercise; capped at ${a.max_extra_ml} ml). ${a.weather?.day === day ? `Forecast feels-like high ${a.weather.max_c} °C in ${a.weather.city}.` : "No current-day forecast; no heat increase."} Your editable tracking rule, not a fluid prescription.`;
}

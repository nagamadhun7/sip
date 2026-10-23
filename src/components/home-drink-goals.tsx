import { adjustmentReason } from "../features/hydration-adjustments";
import { fastingEnabled, goalFluid } from "../features/conditions";
import { situationTarget } from "../features/situations";
import React, { useState } from "react";
import { View, ScrollView, useWindowDimensions } from "react-native";
import { router } from "expo-router";
import { useStore } from "../state/store";
import { useToday } from "../lib/use-today";
import { onDay, formatVolume } from "../lib/model";
import {
  goalsForSettings,
  drinkDayTotals,
  goalStatus,
  goalLabels,
  caffeineTiming,
} from "../features/drink-goals";
import { caffeineLimit } from "../features/cutback";
import { alcoholAllowed } from "../features/alcohol";
import { T } from "./ui";
import { AccessiblePressable as Pressable } from "./accessible-pressable";
export function WaterHeadline() {
  const { entries, settings } = useStore(),
    day = useToday(),
    total = drinkDayTotals(onDay(entries, day), settings),
    goal = goalsForSettings(settings).find((g) => g.key === "plain_water")!;
  return (
    <Pressable
      accessibilityLabel={`Plain water ${formatVolume(total.plainWater, settings.units)}, total fluid ${formatVolume(total.totalFluid, settings.units)}${fastingEnabled(settings) ? `, zero-calorie fluid ${formatVolume(goalFluid(onDay(entries, day), settings), settings.units)} of ${formatVolume(situationTarget(settings, day), settings.units)} goal` : ""}`}
      onPress={() => router.push("/targets")}
      style={{ alignItems: "center", gap: 7, paddingTop: 12 }}
    >
      <T size={13} muted>
        Plain water today
      </T>
      <T
        size={56}
        bold
        style={{
          letterSpacing: -2,
          textAlign: "center",
          fontVariant: ["tabular-nums"],
        }}
      >
        {formatVolume(total.plainWater, settings.units)}
      </T>
      <T size={13} muted>
        Total fluid {formatVolume(total.totalFluid, settings.units)}
        {goal.amount !== null
          ? ` · ${total.plainWater >= goal.amount ? "Target reached" : formatVolume(goal.amount - total.plainWater, settings.units) + " to go"}`
          : ""}
      </T>
      {fastingEnabled(settings) ? (
        <T size={12} muted>
          Zero-calorie fluid:{" "}
          {formatVolume(
            goalFluid(onDay(entries, day), settings),
            settings.units,
          )}{" "}
          of {formatVolume(situationTarget(settings, day), settings.units)} goal
        </T>
      ) : null}
    </Pressable>
  );
}
export function HomeDrinkGoals() {
  const { entries, settings } = useStore(),
    day = useToday(),
    { fontScale } = useWindowDimensions(),
    [details, setDetails] = useState(false),
    rows = onDay(entries, day),
    totals = drinkDayTotals(rows, settings),
    timing = caffeineTiming(rows, settings);
  const goals = goalsForSettings(settings)
    .filter((g) => g.key !== "alcohol" || alcoholAllowed(settings))
    .map((g) =>
      g.key === "caffeine"
        ? { ...g, amount: caffeineLimit(settings, entries, day) }
        : g,
    );
  const sugar = goals.find((g) => g.key === "added_sugar")!,
    extras = goals.filter(
      (g) =>
        g.visible &&
        !["plain_water", "caffeine", "added_sugar"].includes(g.key),
    );
  const over = goals.filter(
    (g) =>
      g.kind === "limit" &&
      g.amount !== null &&
      totals.values[g.key].amount !== null &&
      totals.values[g.key].amount! > g.amount,
  );
  return (
    <View style={{ gap: 10 }}>
      <View
        style={{ flexDirection: fontScale > 1.3 ? "column" : "row", gap: 18 }}
      >
        {(["caffeine", "added_sugar", "calories"] as const).map((key) => {
          const total = totals.values[key],
            unit =
              key === "added_sugar" ? "g" : key === "calories" ? "kcal" : "mg";
          return (
            <Pressable
              key={key}
              onPress={() =>
                key === "caffeine" ? router.push("/caffeine") : setDetails(true)
              }
              style={{ flex: 1, gap: 5 }}
            >
              <T size={12} muted>
                {goalLabels[key]}
              </T>
              <T size={22} bold>
                {total.amount === null
                  ? "Not listed"
                  : `${+total.amount.toFixed(1)} ${unit}`}
              </T>
              {total.missing ? (
                <T size={10} muted>
                  Incomplete data
                </T>
              ) : null}
            </Pressable>
          );
        })}
      </View>
      {over.map((g) => (
        <T key={g.key} size={13} bold style={{ color: "#913E2B" }}>
          {goalLabels[g.key]}: {goalStatus(g, totals.values[g.key])}
        </T>
      ))}
      {!over.some((g) => g.key === "added_sugar") && sugar.amount !== null ? (
        <Pressable onPress={() => router.push("/targets")}>
          <T size={12} muted>
            Added sugar: {goalStatus(sugar, totals.values.added_sugar)}
          </T>
        </Pressable>
      ) : null}
      {timing && timing.lateMg > 0 ? (
        <T size={12} style={{ color: "#913E2B" }}>
          {+timing.lateMg.toFixed(1)} mg caffeine recorded after your cutoff.
        </T>
      ) : null}
      <Pressable
        accessibilityState={{ expanded: details }}
        onPress={() => setDetails(!details)}
        style={{ alignSelf: "flex-end", justifyContent: "center" }}
      >
        <T size={12} muted>
          {details ? "Hide drink details −" : "Drink details +"}
        </T>
      </Pressable>
      {details ? (
        <View style={{ gap: 14 }}>
          {settings.hydrationAdjustments?.enabled ? (
            <T size={12} muted>
              {adjustmentReason(settings, day)}
            </T>
          ) : null}
          <T size={12} muted>
            Total sugar:{" "}
            {totals.totalSugar.amount === null
              ? "not listed"
              : `${+totals.totalSugar.amount.toFixed(1)} g${totals.totalSugar.missing ? " recorded · incomplete" : ""}`}{" "}
            · Natural sugar:{" "}
            {totals.naturalSugar.amount === null
              ? "not listed"
              : `${+totals.naturalSugar.amount.toFixed(1)} g${totals.naturalSugar.missing ? " recorded · incomplete" : ""}`}
          </T>
          {timing ? (
            <T size={12} muted>
              Last caffeine:{" "}
              {new Date(timing.at).toLocaleTimeString(
                settings.locale ?? "en-US",
                { hour: "numeric", minute: "2-digit" },
              )}
              . Cutoff{" "}
              {new Date(timing.cutoff).toLocaleTimeString(
                settings.locale ?? "en-US",
                { hour: "numeric", minute: "2-digit" },
              )}
              , bedtime {settings.bedtime}.
              {timing.incomplete ? " Some caffeine values are not listed." : ""}
            </T>
          ) : null}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <T bold size={14}>
              More from your drinks
            </T>
            <Pressable
              accessibilityLabel="Choose nutrient cards and goals"
              onPress={() => router.push("/targets")}
            >
              <T size={12}>Choose</T>
            </Pressable>
          </View>
          {extras.length ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 10 }}
            >
              {extras.map((g) => (
                <Pressable
                  key={g.key}
                  onPress={() => router.push("/targets")}
                  style={{
                    width: 160,
                    padding: 14,
                    borderRadius: 18,
                    backgroundColor: "#F7F7F7",
                    gap: 6,
                  }}
                >
                  <T size={13} bold>
                    {goalLabels[g.key]}
                  </T>
                  <T size={11} muted>
                    {g.kind === "target" ? "Target" : "Limit"}
                  </T>
                  <T>
                    {totals.values[g.key].amount === null
                      ? "Not listed"
                      : `${+totals.values[g.key].amount!.toFixed(1)} ${g.unit}`}
                  </T>
                  <T size={11} muted>
                    {goalStatus(g, totals.values[g.key])}
                  </T>
                </Pressable>
              ))}
            </ScrollView>
          ) : null}
          <T size={11} muted>
            Values are from drinks only. Nutrients not listed are excluded;
            totals marked incomplete may be higher.
          </T>
        </View>
      ) : null}
    </View>
  );
}

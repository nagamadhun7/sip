import { situationTarget } from "../features/situations";
import React from "react";
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
import { T, Bar } from "./ui";
import { AccessiblePressable as Pressable } from "./accessible-pressable";
export function WaterHeadline() {
  const { entries, settings } = useStore(),
    day = useToday();
  const total = drinkDayTotals(onDay(entries, day), settings),
    goal = goalsForSettings(settings).find((g) => g.key === "plain_water")!;
  return (
    <Pressable
      accessibilityLabel={`Plain water ${formatVolume(total.plainWater, settings.units)}; total fluid ${formatVolume(total.totalFluid, settings.units)}. Set water goal`}
      onPress={() => router.push("/targets")}
      style={{ alignItems: "center", gap: 8, paddingTop: 12 }}
    >
      <T size={13} muted>
        Plain water today
      </T>
      <T
        size={52}
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
        Total fluid: {formatVolume(total.totalFluid, settings.units)}
      </T>
      <T size={13}>
        {goal.amount === null
          ? "Set your plain-water goal"
          : total.plainWater >= goal.amount
            ? "Plain-water target reached"
            : `${formatVolume(goal.amount - total.plainWater, settings.units)} to go`}
      </T>
      <T size={12} muted>
        Total-fluid goal:{" "}
        {formatVolume(situationTarget(settings, day), settings.units)}
      </T>
    </Pressable>
  );
}
export function HomeDrinkGoals() {
  const { fontScale } = useWindowDimensions();
  const { entries, settings } = useStore(),
    day = useToday(),
    rows = onDay(entries, day);
  const totals = drinkDayTotals(rows, settings),
    goals = goalsForSettings(settings)
      .filter((g) => g.key !== "alcohol" || alcoholAllowed(settings))
      .map((g) =>
        g.key === "caffeine"
          ? { ...g, amount: caffeineLimit(settings, entries, day) }
          : g,
      );
  const timing = caffeineTiming(rows, settings);
  const main = goals.filter((g) =>
      ["plain_water", "caffeine", "added_sugar"].includes(g.key),
    ),
    extras = goals.filter(
      (g) =>
        g.visible &&
        !["plain_water", "caffeine", "added_sugar"].includes(g.key),
    );
  function render(g: (typeof goals)[number], small = false) {
    const total = totals.values[g.key],
      over =
        g.kind === "limit" &&
        g.amount !== null &&
        total.amount !== null &&
        total.amount > g.amount;
    const status =
      g.key === "plain_water" && g.amount !== null && total.amount !== null
        ? total.amount >= g.amount
          ? "Target reached"
          : `${formatVolume(g.amount - total.amount, settings.units)} to go`
        : goalStatus(g, total);
    const color =
      g.kind === "target" ? "#6FAEE8" : over ? "#B34B32" : "#D99B67";
    return (
      <Pressable
        key={g.key}
        accessibilityLabel={`${goalLabels[g.key]}, ${g.kind}, ${total.amount === null ? "not listed" : total.amount + " " + g.unit}, ${status}`}
        onPress={() =>
          router.push(g.key === "caffeine" ? "/caffeine" : "/targets")
        }
        style={{
          flex: small ? undefined : 1,
          width: small ? 160 : undefined,
          gap: 6,
          padding: small ? 14 : 0,
          borderRadius: 18,
          backgroundColor: small ? "#F7F7F7" : undefined,
        }}
      >
        <T size={11} muted>
          {g.kind === "target" ? "TARGET" : "LIMIT"}
        </T>
        <T size={13} bold>
          {goalLabels[g.key]}
        </T>
        <T size={22} bold>
          {total.amount === null
            ? "Not listed"
            : g.key === "plain_water"
              ? formatVolume(total.amount, settings.units)
              : `${+total.amount.toFixed(1)} ${g.unit}${total.missing ? " recorded" : ""}`}
        </T>
        {g.amount !== null ? (
          <Bar
            value={
              g.amount > 0
                ? (total.amount ?? 0) / g.amount
                : (total.amount ?? 0) > 0
                  ? 1
                  : 0
            }
            color={color}
          />
        ) : null}
        <T size={12} style={{ color: over ? "#913E2B" : "#596875" }}>
          {status}
        </T>
        {total.missing ? (
          <T size={11} muted>
            {total.missing} drink(s) missing data
          </T>
        ) : null}
      </Pressable>
    );
  }
  return (
    <View style={{ gap: 18 }}>
      <View
        style={{
          flexDirection: fontScale > 1.3 ? "column" : "row",
          flexWrap: "wrap",
          gap: 18,
        }}
      >
        {main.map((g) => render(g))}
      </View>
      {goals
        .filter(
          (g) =>
            g.kind === "limit" &&
            !["caffeine", "added_sugar"].includes(g.key) &&
            g.amount !== null &&
            totals.values[g.key].amount !== null &&
            totals.values[g.key].amount! > g.amount,
        )
        .map((g) => (
          <T key={g.key} size={13} bold style={{ color: "#913E2B" }}>
            {goalLabels[g.key]}: {goalStatus(g, totals.values[g.key])}
          </T>
        ))}
      <T size={12} muted>
        Total sugar:{" "}
        {totals.totalSugar.amount === null
          ? "not listed"
          : `${+totals.totalSugar.amount.toFixed(1)} g${totals.totalSugar.missing ? " recorded (incomplete)" : ""}`}{" "}
        · Natural sugar:{" "}
        {totals.naturalSugar.amount === null
          ? "not listed"
          : `${+totals.naturalSugar.amount.toFixed(1)} g${totals.naturalSugar.missing ? " recorded (incomplete)" : ""}`}
      </T>
      <T size={12} muted>
        Blue targets fill toward a goal. Amber limits show your remaining
        allowance. All values are from drinks.
      </T>
      {timing ? (
        <View
          style={{
            gap: 5,
            borderLeftWidth: 3,
            borderColor: timing.lateMg > 0 ? "#B34B32" : "#6FAEE8",
            paddingLeft: 12,
          }}
        >
          <T size={13}>
            Last caffeine:{" "}
            {new Date(timing.at).toLocaleTimeString(
              settings.locale ?? "en-US",
              { hour: "numeric", minute: "2-digit" },
            )}
          </T>
          {timing.lateMg > 0 ? (
            <T size={13} style={{ color: "#913E2B" }}>
              {+timing.lateMg.toFixed(1)} mg recorded after your caffeine cutoff
              (
              {new Date(timing.cutoff).toLocaleTimeString(
                settings.locale ?? "en-US",
                { hour: "numeric", minute: "2-digit" },
              )}
              ), based on bedtime {settings.bedtime}.
            </T>
          ) : null}
          {timing.incomplete ? (
            <T size={11} muted>
              Some caffeine values are not listed.
            </T>
          ) : null}
        </View>
      ) : null}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <T size={16} bold>
          More from your drinks
        </T>
        <Pressable
          accessibilityLabel="Choose nutrient cards"
          onPress={() => router.push("/targets")}
        >
          <T size={13}>Choose</T>
        </Pressable>
      </View>
      {extras.length ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 10 }}
        >
          {extras.map((g) => render(g, true))}
        </ScrollView>
      ) : (
        <T size={12} muted>
          Choose extra nutrients to display here.
        </T>
      )}
    </View>
  );
}

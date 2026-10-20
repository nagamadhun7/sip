import React from "react";
import { View } from "react-native";
import { useStore } from "../state/store";
import { localDay, onDay, totals, formatVolume } from "../lib/model";
import { Page, T, Bar, colors } from "../components/ui";
export default function Balance() {
  const { entries, settings } = useStore(),
    sum = totals(onDay(entries, localDay()));
  return (
    <Page>
      <T muted>Today, from your drinks</T>
      {(["water", "caffeine", "sugar", "sodium", "potassium"] as const).map(
        (k) => {
          const target = settings[k],
            value = sum[k],
            remaining = target - value,
            isLimit = ["sugar", "caffeine", "sodium"].includes(k),
            fmt = (v: number) =>
              k === "water"
                ? formatVolume(v, settings.units)
                : `${Math.round(v)} ${k === "sugar" ? "g" : "mg"}`;
          return (
            <View key={k} style={{ gap: 5, paddingVertical: 8 }}>
              <T>
                {k === "water"
                  ? "Fluid intake"
                  : k[0].toUpperCase() + k.slice(1)}
              </T>
              <T size={30} bold>
                {fmt(value)}{" "}
                <T size={14} muted>
                  of {fmt(target)}
                  {isLimit ? " limit" : ""}
                </T>
              </T>
              <Bar
                value={value / target}
                color={
                  k === "sugar"
                    ? colors.peach
                    : k === "caffeine"
                      ? colors.brown
                      : colors.blue
                }
              />
              <T
                size={13}
                style={{
                  color: remaining < 0 && isLimit ? "#B5532F" : colors.muted,
                }}
              >
                {remaining < 0
                  ? `${fmt(-remaining)} ${isLimit ? "over" : "above target"}`
                  : `${fmt(remaining)} ${isLimit ? "left" : "to go"}`}
              </T>
              {k !== "water" && sum.missing[k] > 0 ? (
                <T size={12} muted>
                  {sum.missing[k]} drink(s) missing {k}; total is incomplete.
                </T>
              ) : null}
            </View>
          );
        },
      )}
      <T size={13} muted>
        These totals cover drinks you logged. Food and unlogged drinks are not
        included. Targets are personal tracking goals, not medical advice.
      </T>
    </Page>
  );
}

import React, { useState, useEffect } from "react";
import { router } from "expo-router";
import { AccessiblePressable as Pressable } from "./accessible-pressable";
import { View, AppState } from "react-native";
import type { Drink } from "../lib/model";
import { formatVolume, localDay } from "../lib/model";
import { useStore } from "../state/store";
import { beforeDrink, type LimitPreview } from "../features/before-drink";
import { T, Button } from "./ui";
export function BeforeDrink({
  drink,
  ml,
  onSmaller,
}: {
  drink: Drink;
  ml: number;
  onSmaller: () => void;
}) {
  const { entries, settings } = useStore(),
    [more, setMore] = useState(false),
    [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") setNow(new Date());
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, []);
  let check: ReturnType<typeof beforeDrink>;
  try {
    check = beforeDrink(drink, ml, entries, settings, now);
  } catch (e) {
    return (
      <T size={13} muted>
        {(e as Error).message}
      </T>
    );
  }
  const n = (value: number) =>
    new Intl.NumberFormat(settings.locale ?? "en-US", {
      maximumFractionDigits: 1,
    }).format(value);
  const bedtime = new Date(check.bedtime).toLocaleTimeString(
    settings.locale ?? "en-US",
    { hour: "numeric", minute: "2-digit" },
  );
  function line(p: LimitPreview) {
    if (p.drink === null || p.after === null)
      return `${p.label}: not fully listed. This portion cannot be checked against your ${n(p.limit)} ${p.unit} ${p.key === "total_sugar" ? "reference" : "limit"}.`;
    if (p.incomplete)
      return `${p.label}: at least ${n(p.after)} ${p.unit} would be recorded${p.after > p.limit ? `, above your ${n(p.limit)} ${p.unit} limit` : ""}. Some values are not listed; remaining allowance is uncertain.`;
    if (p.limit === 0)
      return `${p.label}: ${n(p.after)} ${p.unit} after this drink${p.after > 0 ? " — over your saved zero limit" : " — within your saved zero limit"}.`;
    return `${p.label}: this puts you at ${n(p.percent!)}% of your saved ${p.key === "total_sugar" ? "reference" : "limit"} (${n(p.after)} of ${n(p.limit)} ${p.unit}) — ${n(Math.abs(p.left!))} ${p.unit} ${p.left! < 0 ? "over" : "left"}.`;
  }
  const primary = check.limits.filter((p) =>
      ["added_sugar", "total_sugar", "caffeine"].includes(p.key),
    ),
    other = check.limits.filter((p) => !primary.includes(p));
  return (
    <View
      style={{
        gap: 10,
        paddingVertical: 18,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: "#EFEFEF",
      }}
    >
      <T size={21} bold>
        Before you drink
      </T>
      <T size={13} muted>
        If you drink {formatVolume(ml, settings.units)} now. Nothing has been
        logged.
      </T>
      <T bold size={18}>
        {check.atBedtime === null
          ? "Caffeine in this drink is not fully listed"
          : `About ${n(check.atBedtime)} mg caffeine at your ${localDay(check.bedtime) !== localDay() ? "next " : ""}${bedtime} bedtime${check.missing ? " from known values" : ""}`}
      </T>
      {check.drinkAtBedtime !== null ? (
        <T size={14}>
          About {n(check.drinkAtBedtime)} mg would remain from this drink, plus{" "}
          {n(check.baseline)} mg from earlier logged drinks.
        </T>
      ) : (
        <T size={14}>
          Earlier known logs alone give about {n(check.baseline)} mg at bedtime.
          Add the label’s caffeine value to include this drink.
        </T>
      )}
      {check.missing ? (
        <T size={12} muted>
          {check.missing} recent entry or entries have incomplete caffeine. The
          estimate may be higher.
        </T>
      ) : null}
      {primary.map((p) => (
        <T
          key={p.key}
          size={14}
          style={
            p.left !== null && p.left < 0 ? { color: "#913E2B" } : undefined
          }
        >
          {line(p)}
        </T>
      ))}
      {ml >= 2 ? (
        <Button secondary title="Check half this amount" onPress={onSmaller} />
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Leave without logging"
        onPress={() => router.back()}
        style={{ minHeight: 44, justifyContent: "center" }}
      >
        <T size={14}>Not now · leave without logging</T>
      </Pressable>
      {other.length ? (
        <Button
          secondary
          title={more ? "Hide other limits" : "Check other saved limits"}
          onPress={() => setMore(!more)}
        />
      ) : null}
      {more
        ? other.map((p) => (
            <T key={p.key} size={13}>
              {line(p)}
            </T>
          ))
        : null}
      <T size={11} muted>
        Estimated with a {check.halfLife}-hour caffeine half-life and no more
        caffeine after this drink. People vary; this does not predict sleep or
        say a drink is safe. Nutrition follows the saved ingredient or label
        data.
      </T>
    </View>
  );
}

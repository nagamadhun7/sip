import React, { useState, useRef } from "react";
import { View, Pressable, ScrollView } from "react-native";
import { Redirect, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useStore } from "../state/store";
import { localDay, onDay, totals, formatVolume, id } from "../lib/model";
import { quickHistory } from "../lib/tracking";
import { useToday } from "../lib/use-today";
import {
  T,
  Glass,
  Bar,
  Row,
  Icon,
  TabBar,
  colors,
  ErrorText,
  Button,
} from "../components/ui";
export default function Today() {
  const { entries, settings, saveEntry, saveEntries, undoLabel, undo } =
      useStore(),
    safe = useSafeAreaInsets();
  const [error, setError] = useState(""),
    [pending, setPending] = useState(false),
    day = useToday();
  const lock = useRef(false);
  const quicks = quickHistory(entries);
  if (!settings.onboarded) return <Redirect href="/onboarding" />;
  const today = onDay(entries, day),
    sum = totals(today);
  const quick = async (index: number) => {
    if (lock.current) return;
    lock.current = true;
    setPending(true);
    setError("");
    const previous = quicks[index];
    const drink = previous.drink;
    try {
      await saveEntry({
        id: id(),
        drink,
        ml: previous.ml,
        at: new Date().toISOString(),
      });
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not save. Please try again.",
      );
    } finally {
      lock.current = false;
      setPending(false);
    }
  };
  const repeatYesterday = async () => {
    if (lock.current) return;
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const records = onDay(entries, localDay(yesterday));
    if (!records.length) {
      setError("No drinks were logged yesterday. Choose a drink to add.");
      return;
    }
    lock.current = true;
    setPending(true);
    setError("");
    try {
      await saveEntries(
        records.map((e) => ({ ...e, id: id(), at: new Date().toISOString() })),
      );
    } catch {
      setError("Could not repeat yesterday. Please try again.");
    } finally {
      lock.current = false;
      setPending(false);
    }
  };
  return (
    <View style={{ flex: 1, backgroundColor: "white", paddingTop: safe.top }}>
      <ScrollView
        contentContainerStyle={{ padding: 24, paddingBottom: 40, gap: 22 }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <T size={34} bold>
            Today
          </T>
          <Pressable
            accessibilityLabel="Settings"
            onPress={() => router.push("/settings")}
            style={{ padding: 10 }}
          >
            <Icon name="settings" />
          </Pressable>
        </View>
        {settings.focus === "water" ? (
          <Pressable
            accessibilityLabel={`Hydration balance, ${formatVolume(sum.water, settings.units)} of ${formatVolume(settings.water, settings.units)}`}
            onPress={() => router.push("/balance")}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 28,
              paddingVertical: 6,
              paddingLeft: 14,
            }}
          >
            <Glass fraction={sum.water / settings.water} />
            <View>
              <T size={58} bold>
                {settings.units === "ml"
                  ? (sum.water / 1000).toFixed(1)
                  : (sum.water / 29.5735).toFixed(0)}
                <T size={19} muted>
                  {" "}
                  {settings.units === "ml" ? "L" : "fl oz"}
                </T>
              </T>
              <T muted>
                {sum.water >= settings.water
                  ? "Daily target reached"
                  : `${formatVolume(settings.water - sum.water, settings.units)} to go`}
              </T>
            </View>
          </Pressable>
        ) : (
          <Pressable
            onPress={() =>
              router.push(
                settings.focus === "caffeine" ? "/caffeine" : "/balance",
              )
            }
          >
            <T muted>Focus: {settings.focus}</T>
            <T size={60} bold>
              {Math.round(sum[settings.focus])}
              <T size={18} muted>
                {" "}
                {settings.focus === "sugar" ? "g" : "mg"}
              </T>
            </T>
            <T muted>
              of your {settings[settings.focus]}{" "}
              {settings.focus === "sugar" ? "g" : "mg"} limit
            </T>
            <Bar
              value={
                settings[settings.focus] > 0
                  ? sum[settings.focus] / settings[settings.focus]
                  : sum[settings.focus] > 0
                    ? 1
                    : 0
              }
              color={settings.focus === "sugar" ? colors.peach : colors.brown}
            />
          </Pressable>
        )}
        <View style={{ flexDirection: "row", gap: 12 }}>
          {quicks.map((previous, idx) => (
            <Pressable
              key={idx}
              accessibilityRole="button"
              disabled={pending}
              onPress={() => quick(idx)}
              style={{
                flex: 1,
                alignItems: "center",
                paddingVertical: 12,
                gap: 4,
              }}
            >
              <View
                style={{ flexDirection: "row", gap: 6, alignItems: "center" }}
              >
                <View
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    backgroundColor: previous.drink.color,
                  }}
                />
                <T>{previous.drink.name}</T>
              </View>
              <T size={13} muted>
                {formatVolume(previous.ml, settings.units)}
              </T>
            </Pressable>
          ))}
          <Pressable
            accessibilityRole="button"
            disabled={pending}
            onPress={() => void repeatYesterday()}
            style={{
              flex: 1,
              paddingVertical: 12,
              alignItems: "center",
              gap: 4,
            }}
          >
            <T>Same as</T>
            <T size={13} muted>
              yesterday
            </T>
          </Pressable>
        </View>
        <ErrorText error={error} />
        {undoLabel ? (
          <View style={{ gap: 8 }}>
            <T muted>{undoLabel}</T>
            <Button
              secondary
              title="Undo last change"
              onPress={() =>
                void undo().catch(() => setError("Could not undo. Retry."))
              }
            />
          </View>
        ) : null}
        <View style={{ flexDirection: "row", gap: 24 }}>
          {(["caffeine", "sugar", "calories"] as const).map((k) => (
            <Pressable
              key={k}
              onPress={() =>
                router.push(k === "caffeine" ? "/caffeine" : "/balance")
              }
              style={{ flex: 1 }}
            >
              <T size={13} muted>
                {k === "sugar"
                  ? "Sugar"
                  : k === "calories"
                    ? "Calories"
                    : "Caffeine"}
              </T>
              <T size={28} bold>
                {Math.round(sum[k])}
                <T size={14} muted>
                  {" "}
                  {k === "sugar" ? "g" : k === "calories" ? "kcal" : "mg"}
                </T>
              </T>
              {k !== "calories" ? (
                <Bar
                  value={
                    settings[k] > 0 ? sum[k] / settings[k] : sum[k] > 0 ? 1 : 0
                  }
                  color={k === "sugar" ? colors.peach : colors.brown}
                />
              ) : null}
              {sum.missing[k] > 0 ? (
                <T size={11} muted>
                  {sum.missing[k]} drink(s) missing data
                </T>
              ) : null}
            </Pressable>
          ))}
        </View>
        {!today.length ? (
          <View style={{ paddingVertical: 24, gap: 12 }}>
            <T size={24} bold>
              Add your first drink
            </T>
            <T muted>
              Tap the plus or scan a drink. Your recent drinks appear here after
              you log.
            </T>
            <Button title="Add a drink" onPress={() => router.push("/add")} />
          </View>
        ) : (
          <View>
            {today.map((e) => (
              <Row
                key={e.id}
                title={e.drink.name}
                detail={new Date(e.at).toLocaleTimeString([], {
                  hour: "numeric",
                  minute: "2-digit",
                })}
                value={formatVolume(e.ml, settings.units)}
                dot={e.drink.color}
                onPress={() =>
                  router.push({ pathname: "/drink", params: { entry: e.id } })
                }
              />
            ))}
          </View>
        )}
        <Pressable onPress={() => router.push("/balance")}>
          <T size={14} muted>
            View your daily balance ›
          </T>
        </Pressable>
      </ScrollView>
      <TabBar active="today" />
    </View>
  );
}

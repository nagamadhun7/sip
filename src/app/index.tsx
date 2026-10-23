import { AccessiblePressable as Pressable } from "../components/accessible-pressable";
import { AlcoholControls } from "../components/alcohol-controls";
import { caffeineLimit } from "../features/cutback";
import { situationTarget } from "../features/situations";
import { DrinkIcon } from "../components/drink-icon";
import React, { useState, useRef } from "react";
import { View, ScrollView, useWindowDimensions } from "react-native";
import { Redirect, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useStore } from "../state/store";
import { localDay, onDay, totals, formatVolume, id } from "../lib/model";
import { quickHistory } from "../lib/tracking";
import { useToday } from "../lib/use-today";
import { T, Row, Icon, TabBar, ErrorText, Button } from "../components/ui";
export default function Today() {
  const {
      entries,
      settings: baseSettings,
      saveEntry,
      saveEntries,
      undoLabel,
      undo,
    } = useStore(),
    safe = useSafeAreaInsets();
  const [error, setError] = useState(""),
    [pending, setPending] = useState(false),
    day = useToday();
  const { fontScale } = useWindowDimensions();
  const lock = useRef(false);
  const settings = {
    ...baseSettings,
    water: situationTarget(baseSettings, day),
    caffeine: caffeineLimit(baseSettings, entries, day),
  };
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
        records.map((e) => ({
          ...e,
          health: undefined,
          id: id(),
          at: new Date().toISOString(),
        })),
      );
    } catch {
      setError("Could not repeat yesterday. Please try again.");
    } finally {
      lock.current = false;
      setPending(false);
    }
  };
  const grouped = Array.from(
    today
      .reduce((map, entry) => {
        const key = entry.drink.id;
        const previous = map.get(key);
        map.set(key, {
          drink: entry.drink,
          ml: (previous?.ml ?? 0) + entry.ml,
        });
        return map;
      }, new Map<string, { drink: (typeof today)[number]["drink"]; ml: number }>())
      .values(),
  ).sort((a, b) => b.ml - a.ml);
  const maxVolume = Math.max(1, ...grouped.map((g) => g.ml));
  const focus = settings.focus;
  const totalText =
    focus === "water"
      ? formatVolume(sum.water, settings.units)
      : `${Math.round(sum[focus])} ${focus === "sugar" ? "g" : "mg"}`;
  const remaining = Math.max(0, settings[focus] - sum[focus]);
  return (
    <View style={{ flex: 1, backgroundColor: "white", paddingTop: safe.top }}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{
          paddingHorizontal: 24,
          paddingTop: 10,
          paddingBottom: 24,
          gap: 24,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Pressable
            onPress={() => router.push("/week")}
            style={{
              borderRadius: 24,
              backgroundColor: "#F7F7F7",
              paddingHorizontal: 16,
              paddingVertical: 9,
              flexDirection: "row",
              gap: 10,
              alignItems: "center",
            }}
          >
            <T bold>Today</T>
            <T muted>⌄</T>
          </Pressable>
          <View style={{ flexDirection: "row", gap: 4, alignItems: "center" }}>
            <Pressable
              accessibilityLabel="My drinks"
              onPress={() => router.push("/my-drinks")}
              style={{ padding: 10 }}
            >
              <Icon name="drop" size={21} />
            </Pressable>
            <Pressable
              accessibilityLabel="Settings"
              onPress={() => router.push("/settings")}
              style={{ padding: 10 }}
            >
              <Icon name="settings" size={21} />
            </Pressable>
          </View>
        </View>

        <Pressable
          accessibilityLabel={`${focus}: ${totalText}. Open balance`}
          onPress={() =>
            router.push(focus === "caffeine" ? "/caffeine" : "/balance")
          }
          style={{ alignItems: "center", gap: 7, paddingTop: 12 }}
        >
          <T size={13} muted>
            {focus === "water"
              ? "Fluid intake today"
              : `${focus[0].toUpperCase() + focus.slice(1)} today`}
          </T>
          <T
            size={fontScale > 1.3 ? 44 : 56}
            bold
            style={{
              letterSpacing: -2,
              fontVariant: ["tabular-nums"],
              textAlign: "center",
            }}
          >
            {totalText}
          </T>
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              justifyContent: "center",
              gap: 8,
            }}
          >
            <View
              style={{
                backgroundColor: "#F7F7F7",
                borderRadius: 20,
                paddingHorizontal: 13,
                paddingVertical: 7,
              }}
            >
              <T size={12}>
                {focus === "water"
                  ? formatVolume(remaining, settings.units)
                  : `${Math.round(remaining)} ${focus === "sugar" ? "g" : "mg"}`}{" "}
                {focus === "water" ? "to go" : "left"}
              </T>
            </View>
            <View
              style={{
                backgroundColor: "#F7F7F7",
                borderRadius: 20,
                paddingHorizontal: 13,
                paddingVertical: 7,
              }}
            >
              <T size={12}>
                {focus === "water"
                  ? formatVolume(settings.water, settings.units)
                  : `${settings[focus]} ${focus === "sugar" ? "g" : "mg"}`}{" "}
                {focus === "water" ? "goal" : "limit"}
              </T>
            </View>
          </View>
        </Pressable>
        {grouped.length ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              gap: 12,
              alignItems: "flex-end",
              paddingTop: 10,
            }}
          >
            {grouped.map((g, i) => (
              <Pressable
                key={g.drink.id}
                accessibilityLabel={`${g.drink.name}, ${formatVolume(g.ml, settings.units)} today. Edit drink`}
                onPress={() =>
                  router.push({
                    pathname: "/drink",
                    params: { drink: g.drink.id },
                  })
                }
                style={{
                  width: Math.max(74, fontScale > 1.3 ? 100 : 74),
                  height: 240,
                  justifyContent: "flex-end",
                }}
              >
                <View
                  style={{
                    height: (g.ml / maxVolume) * 235,
                    position: "absolute",
                    bottom: 0,
                    width: "100%",
                    borderRadius: 20,
                    backgroundColor: [
                      "#F8EBCB",
                      "#F3D4DF",
                      "#F8DDB7",
                      "#DCE8E5",
                    ][i % 4],
                    paddingHorizontal: 7,
                    paddingVertical: 0,
                    justifyContent: "flex-end",
                    alignItems: "center",
                    gap: 5,
                  }}
                ></View>
                <View
                  style={{
                    alignItems: "center",
                    gap: 4,
                    paddingTop: 9,
                    minHeight: 70,
                    paddingBottom: 15,
                  }}
                >
                  <DrinkIcon drink={g.drink} size={26} />
                  <T size={12} bold style={{ textAlign: "center" }}>
                    {formatVolume(g.ml, settings.units)}
                  </T>
                  <T size={11} style={{ textAlign: "center" }}>
                    {g.drink.name}
                  </T>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        ) : (
          <View style={{ paddingVertical: 36, alignItems: "center", gap: 10 }}>
            <T size={22} bold>
              Add your first drink
            </T>
            <T muted style={{ textAlign: "center" }}>
              Your drinks and daily totals will appear here.
            </T>
            <Button title="Add a drink" onPress={() => router.push("/add")} />
          </View>
        )}
        <View
          style={{ flexDirection: fontScale > 1.3 ? "column" : "row", gap: 18 }}
        >
          {(["caffeine", "sugar", "calories"] as const).map((k) => (
            <Pressable
              key={k}
              onPress={() =>
                router.push(k === "caffeine" ? "/caffeine" : "/balance")
              }
              style={{ flex: 1, gap: 5 }}
            >
              <T size={12} muted>
                {k[0].toUpperCase() + k.slice(1)}
              </T>
              <T size={20} bold>
                {Math.round(sum[k])}{" "}
                <T size={12} muted>
                  {k === "sugar" ? "g" : k === "calories" ? "kcal" : "mg"}
                </T>
              </T>
              {sum.missing[k] > 0 ? (
                <T size={11} muted>
                  {sum.missing[k]} missing data
                </T>
              ) : null}
            </Pressable>
          ))}
        </View>
        <View style={{ gap: 10, alignSelf: "stretch" }}>
          <T size={13} muted>
            Quick add from your history
          </T>
          <View
            style={{
              flexDirection: fontScale > 1.3 ? "column" : "row",
              flexWrap: "wrap",
              gap: 10,
            }}
          >
            {quicks.map((previous, idx) => (
              <Pressable
                key={idx}
                disabled={pending}
                onPress={() => void quick(idx)}
                style={{
                  backgroundColor: "#F7F7F7",
                  borderRadius: 22,
                  padding: 12,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <DrinkIcon drink={previous.drink} size={24} />
                <T size={13}>
                  {previous.drink.name} ·{" "}
                  {formatVolume(previous.ml, settings.units)}
                </T>
              </Pressable>
            ))}
            <Pressable
              disabled={pending}
              onPress={() => void repeatYesterday()}
              style={{ padding: 12 }}
            >
              <T size={13}>Same as yesterday</T>
            </Pressable>
          </View>
        </View>

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <T size={13} muted>
            {new Date().toLocaleDateString(settings.locale ?? "en-US", {
              month: "short",
              day: "numeric",
            })}
          </T>
          <T size={13} muted>
            {today.length} {today.length === 1 ? "drink" : "drinks"}
          </T>
        </View>
        <View>
          <AlcoholControls summary />
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
        <ErrorText error={error} />
        {undoLabel ? (
          <View style={{ gap: 8 }}>
            <T size={12} muted>
              {undoLabel}
            </T>
            <Button
              secondary
              title="Undo last change"
              onPress={() =>
                void undo().catch(() => setError("Could not undo. Retry."))
              }
            />
          </View>
        ) : null}
      </ScrollView>
      <TabBar active="today" />
    </View>
  );
}
export { ErrorBoundary } from "../components/route-error";

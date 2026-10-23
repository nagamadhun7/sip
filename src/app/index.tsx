import { WaterHeadline, HomeDrinkGoals } from "../components/home-drink-goals";
import { alcoholAllowed, isAlcohol } from "../features/alcohol";
import { pinnedDrinks } from "../features/history";
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
import { localDay, onDay, formatVolume, id } from "../lib/model";
import { quickHistory } from "../lib/tracking";
import { useToday } from "../lib/use-today";
import { T, Row, Icon, TabBar, ErrorText, Button } from "../components/ui";
export default function Today() {
  const {
      entries,
      library,
      catalog,
      settings: baseSettings,
      saveEntry,
      saveEntries,
      undoLabel,
      undo,
    } = useStore(),
    safe = useSafeAreaInsets();
  const [error, setError] = useState(""),
    [pending, setPending] = useState(false),
    [showAllRecent, setShowAllRecent] = useState(false),
    day = useToday();
  const { fontScale } = useWindowDimensions();
  const lock = useRef(false);
  const settings = {
    ...baseSettings,
    water: situationTarget(baseSettings, day),
    caffeine: caffeineLimit(baseSettings, entries, day),
  };
  const favorites = pinnedDrinks(settings.favoriteDrinkIds ?? [], [
    ...library,
    ...catalog,
  ]).filter((d) => !isAlcohol(d) || alcoholAllowed(settings));
  const quicks = [
    ...favorites.map((drink) => ({ drink, ml: drink.serving })),
    ...quickHistory(entries).filter(
      (e) =>
        (!isAlcohol(e.drink) || alcoholAllowed(settings)) &&
        !favorites.some((d) => d.id === e.drink.id),
    ),
  ];
  if (!settings.onboarded) return <Redirect href="/onboarding" />;
  const today = onDay(entries, day).sort(
    (a, b) => Date.parse(b.at) - Date.parse(a.at),
  );
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

        <WaterHeadline />
        <HomeDrinkGoals />
        <View style={{ gap: 10, alignSelf: "stretch" }}>
          <T size={13} muted>
            Quick add
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
          {!today.length ? (
            <T muted>
              No drinks logged today. Use Quick add or tap the plus to log one.
            </T>
          ) : null}
          {(showAllRecent ? today : today.slice(0, 3)).map((e) => (
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
          {today.length > 3 ? (
            <Pressable
              accessibilityState={{ expanded: showAllRecent }}
              onPress={() => setShowAllRecent(!showAllRecent)}
              style={{ paddingVertical: 12 }}
            >
              <T size={13} bold>
                {showAllRecent
                  ? "Show fewer drinks"
                  : `Show all ${today.length} drinks`}
              </T>
            </Pressable>
          ) : null}
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

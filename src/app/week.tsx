import { situationTarget } from "../features/situations";
import { caffeineLimit } from "../features/cutback";
import { AccessiblePressable as Pressable } from "../components/accessible-pressable";
import React, { useState } from "react";
import { View, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useStore } from "../state/store";
import { lastDays, localDay, onDay, totals, formatVolume } from "../lib/model";
import { T, Row, Bar, TabBar, colors } from "../components/ui";
export default function Week() {
  const { entries, settings } = useStore(),
    safe = useSafeAreaInsets(),
    [offset, setOffset] = useState(0),
    [selected, setSelected] = useState(localDay());
  const end = new Date();
  end.setDate(end.getDate() + offset * 7);
  const days = lastDays(7, end),
    daily = days.map((d) => totals(onDay(entries, d))),
    max = Math.max(settings.water, ...daily.map((d) => d.water));
  const targetFor = (
    key: "water" | "caffeine" | "sugar" | "sodium" | "potassium",
    day: string,
  ) =>
    key === "water"
      ? situationTarget(settings, day)
      : key === "caffeine"
        ? caffeineLimit(settings, entries, day)
        : settings[key];
  function changeWeek(next: number) {
    setOffset(next);
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + next * 7);
    setSelected(localDay(endDate));
  }
  const data = totals(entries.filter((e) => days.includes(localDay(e.at))));
  return (
    <View style={{ flex: 1, backgroundColor: "white", paddingTop: safe.top }}>
      <ScrollView
        contentContainerStyle={{ padding: 24, gap: 24, paddingBottom: 40 }}
      >
        <T size={34} bold>
          Week
        </T>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Pressable
            accessibilityLabel="Previous week"
            onPress={() => changeWeek(offset - 1)}
            style={{ padding: 10 }}
          >
            <T>‹</T>
          </Pressable>
          <T muted>
            {new Date(days[0] + "T12:00:00").toLocaleDateString([], {
              month: "short",
              day: "numeric",
            })}{" "}
            – {end.toLocaleDateString([], { month: "short", day: "numeric" })}
          </T>
          <Pressable
            accessibilityLabel="Next week"
            disabled={offset >= 0}
            onPress={() => changeWeek(offset + 1)}
            style={{ padding: 10, opacity: offset >= 0 ? 0.3 : 1 }}
          >
            <T>›</T>
          </Pressable>
        </View>
        {!entries.some((e) => days.includes(localDay(e.at))) ? (
          <T muted>No drinks logged in this period.</T>
        ) : null}
        <View>
          <T size={52} bold>
            {formatVolume(data.water / 7, settings.units)}
          </T>
          <T muted>average per calendar day</T>
        </View>
        <ScrollView
          horizontal
          accessibilityLabel="Weekly intake chart"
          contentContainerStyle={{
            minWidth: 380,
            gap: 12,
            alignItems: "flex-end",
            paddingBottom: 10,
          }}
          style={{
            flexDirection: "row",
            gap: 12,
            height: 180,
            alignItems: "flex-end",
          }}
        >
          {days.map((day, index) => (
            <Pressable
              key={day}
              onPress={() => setSelected(day)}
              accessibilityState={{ selected: day === selected }}
              accessibilityLabel={`${day}: ${formatVolume(daily[index].water, settings.units)}`}
              style={{
                flex: 1,
                alignItems: "center",
                gap: 8,
                justifyContent: "flex-end",
                height: "100%",
              }}
            >
              <View
                style={{
                  width: "100%",
                  height: Math.max(3, (daily[index].water / max) * 135),
                  backgroundColor: day === selected ? "#9CC7EB" : "#DEEAF3",
                  borderRadius: 16,
                }}
              />
              <T size={12} muted>
                {day === selected ? "✓ " : ""}
                {new Date(day + "T12:00:00").toLocaleDateString([], {
                  weekday: "short",
                })}
              </T>
            </Pressable>
          ))}
        </ScrollView>
        {(["water", "caffeine", "sugar", "sodium", "potassium"] as const).map(
          (k) => (
            <View key={k}>
              <Row
                title={
                  k === "water"
                    ? "Fluid intake"
                    : k[0].toUpperCase() + k.slice(1)
                }
                value={
                  k === "water"
                    ? formatVolume(data.water / 7, settings.units)
                    : `${Math.round(data[k] / 7)} ${k === "sugar" ? "g" : "mg"}`
                }
              />
              <Bar
                value={
                  settings[k] > 0
                    ? data[k] / 7 / settings[k]
                    : data[k] > 0
                      ? 1
                      : 0
                }
                color={
                  k === "sugar"
                    ? colors.peach
                    : k === "caffeine"
                      ? colors.brown
                      : colors.blue
                }
              />
              <T size={12} muted>
                {
                  daily.filter(
                    (d, i) =>
                      onDay(entries, days[i]).length > 0 &&
                      (k === "water" || d.missing[k] === 0) &&
                      (k === "water" || k === "potassium"
                        ? d[k] >= targetFor(k, days[i])
                        : d[k] <= targetFor(k, days[i])),
                  ).length
                }{" "}
                of 7 days recorded{" "}
                {k === "water" || k === "potassium"
                  ? "reached target"
                  : "at or under limit"}
              </T>
            </View>
          ),
        )}
        <T size={20} bold>
          {new Date(selected + "T12:00:00").toLocaleDateString([], {
            weekday: "long",
            month: "short",
            day: "numeric",
          })}
        </T>
        {onDay(entries, selected).length ? (
          onDay(entries, selected).map((e) => (
            <Row
              key={e.id}
              title={e.drink.name}
              value={formatVolume(e.ml, settings.units)}
              dot={e.drink.color}
              onPress={() =>
                router.push({ pathname: "/drink", params: { entry: e.id } })
              }
            />
          ))
        ) : (
          <T muted>No drinks recorded on this day.</T>
        )}
        <T size={12} muted>
          Averages include days with no logged drinks. Missing nutrient values
          are excluded from totals.
        </T>
      </ScrollView>
      <TabBar active="week" />
    </View>
  );
}

export { ErrorBoundary } from "../components/route-error";

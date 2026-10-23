import React, { useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { AccessiblePressable as Pressable } from "./accessible-pressable";
import { T, Input, Row, Button, ErrorText } from "./ui";
import { useStore } from "../state/store";
import { localDay, onDay, totals, formatVolume } from "../lib/model";
import { monthDays, findHistory, periodTrend } from "../features/history";
export function HistoryExplorer() {
  const store = useStore(),
    now = new Date();
  const [month, setMonth] = useState(localDay(now).slice(0, 7)),
    [selected, setSelected] = useState(localDay(now)),
    [query, setQuery] = useState(""),
    [note, setNote] = useState(
      store.settings.dailyNotes?.[localDay(now)] ?? "",
    ),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(""),
    [busy, setBusy] = useState(false);
  const days = monthDays(month),
    first = new Date(month + "-01T12:00:00").getDay();
  const results = query.trim()
    ? findHistory(store.entries, query)
    : onDay(store.entries, selected);
  function select(day: string) {
    setSelected(day);
    setNote(store.settings.dailyNotes?.[day] ?? "");
    setError("");
    setSaved("");
  }
  function shift(delta: number) {
    const d = new Date(month + "-01T12:00:00");
    d.setMonth(d.getMonth() + delta);
    setMonth(localDay(d).slice(0, 7));
  }
  return (
    <View style={{ gap: 18 }}>
      <T size={24} bold>
        Your history
      </T>
      <Input
        label="Search all drinks and dates"
        value={query}
        onChangeText={setQuery}
        placeholder="Coffee or 2026-10-23"
      />
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Pressable
          accessibilityLabel="Previous month"
          onPress={() => shift(-1)}
        >
          <T size={24}>‹</T>
        </Pressable>
        <T bold>
          {new Date(month + "-01T12:00:00").toLocaleDateString(
            store.settings.locale ?? "en-US",
            { month: "long", year: "numeric" },
          )}
        </T>
        <Pressable
          accessibilityLabel="Next month"
          disabled={month >= localDay(now).slice(0, 7)}
          onPress={() => shift(1)}
        >
          <T size={24}>›</T>
        </Pressable>
      </View>
      <View style={{ flexDirection: "row" }}>
        {Array.from({ length: 7 }, (_, i) => (
          <View key={i} style={{ width: "14.2857%", alignItems: "center" }}>
            <T size={11} muted>
              {new Date(2023, 0, 1 + i).toLocaleDateString(
                store.settings.locale ?? "en-US",
                { weekday: "short" },
              )}
            </T>
          </View>
        ))}
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        {Array.from({ length: first }, (_, i) => (
          <View key={`blank${i}`} style={{ width: "14.2857%" }} />
        ))}
        {days.map((day) => {
          const rows = onDay(store.entries, day);
          return (
            <Pressable
              key={day}
              disabled={day > localDay(now)}
              accessibilityLabel={`${day}, ${rows.length} drinks${rows.length ? `, ${formatVolume(totals(rows).water, store.settings.units)}` : ""}`}
              accessibilityState={{ selected: day === selected }}
              onPress={() => select(day)}
              style={{
                width: "14.2857%",
                alignItems: "center",
                paddingVertical: 7,
                borderRadius: 14,
                backgroundColor: day === selected ? "#DDECF9" : "transparent",
                opacity: day > localDay(now) ? 0.35 : 1,
                gap: 3,
              }}
            >
              <T size={14} bold={day === selected}>
                {Number(day.slice(-2))}
              </T>
              <T size={10} muted>
                {rows.length ? `${rows.length}` : "—"}
              </T>
            </Pressable>
          );
        })}
      </View>
      <T size={12} muted>
        Numbers below dates show logged drinks. A dash means no records.
      </T>
      <T bold>
        {query.trim() ? `${results.length} matching entries` : selected}
      </T>
      {results.length ? (
        results.map((e) => (
          <Row
            key={e.id}
            title={e.drink.name}
            detail={new Date(e.at).toLocaleString(
              store.settings.locale ?? "en-US",
            )}
            value={formatVolume(e.ml, store.settings.units)}
            dot={e.drink.color}
            onPress={() =>
              router.push({ pathname: "/drink", params: { entry: e.id } })
            }
          />
        ))
      ) : (
        <T muted>No drinks recorded here.</T>
      )}
      <Input
        label={`Notes for ${selected}`}
        value={note}
        onChangeText={(v) => {
          setNote(v);
          setSaved("");
        }}
        multiline
        maxLength={1000}
        placeholder="What would you like to remember about this day?"
      />
      <Button
        secondary
        title="Save daily note"
        busy={busy}
        onPress={() => {
          setBusy(true);
          setError("");
          const dailyNotes = { ...store.settings.dailyNotes };
          if (note.trim()) dailyNotes[selected] = note.trim();
          else delete dailyNotes[selected];
          void store
            .saveSettings({ ...store.settings, dailyNotes })
            .then(() => setSaved("Note saved on this device."))
            .catch(() =>
              setError(
                "Could not save your note. Your text is still here; try again.",
              ),
            )
            .finally(() => setBusy(false));
        }}
      />
      {saved ? (
        <T size={12} muted>
          {saved}
        </T>
      ) : null}
      <ErrorText error={error} />
      <T size={24} bold>
        Trends
      </T>
      {[7, 30].map((count) => {
        const t = periodTrend(store.entries, count, now);
        return (
          <View
            key={count}
            style={{
              gap: 8,
              paddingVertical: 12,
              borderTopWidth: 1,
              borderColor: "#EFEFEF",
            }}
          >
            <T bold>Last {count} days</T>
            <Row
              title="Daily fluid average"
              value={formatVolume(t.dailyAverage, store.settings.units)}
            />
            <T size={13} muted>
              {t.recordedDays} days with records · {t.entries} drinks. The
              average includes all {count} calendar days.
            </T>
            <T size={13}>
              Recorded sugar: {+t.sugar.toFixed(1)} g · caffeine:{" "}
              {Math.round(t.caffeine)} mg
            </T>
            {t.missing.sugar || t.missing.caffeine ? (
              <T size={12} muted>
                Some entries have nutrients not listed; these totals are
                incomplete.
              </T>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

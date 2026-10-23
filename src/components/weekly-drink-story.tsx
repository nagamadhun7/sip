import React from "react";
import { View } from "react-native";
import { useStore } from "../state/store";
import { weeklyStory } from "../features/weekly-story";
import { formatVolume } from "../lib/model";
import { T } from "./ui";
export function WeeklyDrinkStory({
  end,
  completeLastDay = false,
}: {
  end: Date;
  completeLastDay?: boolean;
}) {
  const { entries, settings } = useStore(),
    story = weeklyStory(entries, settings, end, completeLastDay),
    locale = settings.locale ?? "en-US";
  const number = (value: number) =>
    new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value);
  function change(key: "caffeine" | "sugar" | "added_sugar") {
    const c = story.changes[key],
      label =
        key === "caffeine"
          ? "Caffeine"
          : key === "sugar"
            ? "Total sugar"
            : "Added sugar",
      unit = key === "caffeine" ? "mg" : "g";
    if (c.reason === "no-previous-data")
      return `${label}: no previous-week logs to compare.`;
    if (c.delta === null)
      return `${label}: comparison unavailable because some values are not listed.`;
    return c.delta === 0
      ? `${label}: unchanged from the previous seven days (${number(c.current!)} ${unit} recorded).`
      : `${label}: ${number(Math.abs(c.delta))} ${unit} ${c.delta > 0 ? "more" : "less"} recorded than the previous seven days.`;
  }
  return (
    <View
      style={{
        gap: 10,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: "#EFEFEF",
        paddingVertical: 18,
      }}
    >
      <T size={20} bold>
        Your drink story
      </T>
      {!story.entries ? (
        <T size={14} muted>
          No drinks recorded in this week yet. Your recap appears as you log.
        </T>
      ) : (
        <>
          <T size={14}>
            Most logged:{" "}
            {story.topDrinks.map((d) => `${d.name} (${d.count})`).join(", ")}.
          </T>
          {story.closestDay ? (
            <T size={14}>
              Closest to your current fluid goal:{" "}
              {new Date(story.closestDay.day + "T12:00:00").toLocaleDateString(
                locale,
                { weekday: "long", month: "short", day: "numeric" },
              )}{" "}
              — {formatVolume(story.closestDay.fluid, settings.units)} of{" "}
              {formatVolume(story.closestDay.target, settings.units)}.
            </T>
          ) : null}
          {story.previousEntries ? (
            <>
              <T size={14}>
                {change("caffeine")} {change("sugar")}
              </T>
              {story.changes.added_sugar.delta !== null ? (
                <T size={14}>{change("added_sugar")}</T>
              ) : (
                <T size={12} muted>
                  Added sugar not compared: incomplete data.
                </T>
              )}
            </>
          ) : (
            <T size={14} muted>
              No previous-week logs to compare caffeine and sugar yet.
            </T>
          )}
          <T size={11} muted>
            {story.recordedDays} days with logs here;{" "}
            {story.previousRecordedDays} in the previous seven days. Recorded
            drinks only.
          </T>
        </>
      )}
    </View>
  );
}

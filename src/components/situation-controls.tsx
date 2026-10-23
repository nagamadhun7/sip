import { automaticBlocked } from "../features/hydration-adjustments";
import React, { useState } from "react";
import { View } from "react-native";
import { useStore } from "../state/store";
import { T, Button, Input, ErrorText } from "./ui";
import {
  situations,
  validateSituation,
  situationReason,
} from "../features/situations";
import { localDay } from "../lib/model";
export function SituationControls() {
  const store = useStore(),
    saved = store.settings.situation,
    [mode, setMode] = useState(saved?.mode ?? "workout"),
    [extra, setExtra] = useState(String(saved?.extra_ml ?? 0)),
    [interval, setInterval] = useState(
      String(
        saved?.interval_minutes ??
          store.settings.reminderPreferences?.interval_minutes ??
          120,
      ),
    ),
    [start, setStart] = useState(saved?.start ?? "08:00"),
    [end, setEnd] = useState(saved?.end ?? "20:00"),
    [error, setError] = useState("");
  return (
    <View style={{ gap: 12 }}>
      <T size={22} bold>
        Situation mode
      </T>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {situations.map((m) => (
          <Button
            key={m}
            secondary
            title={`${m === mode ? "Selected: " : ""}${m.replace("-", " ")}`}
            onPress={() => setMode(m)}
          />
        ))}
      </View>
      <Input
        numeric
        label="Your extra water for this mode (ml)"
        value={extra}
        onChangeText={setExtra}
      />
      <Input
        numeric
        label="Mode reminder interval (minutes)"
        value={interval}
        onChangeText={setInterval}
      />
      {mode === "fasting" ? (
        <>
          <Input
            label="Eating window starts (HH:MM)"
            value={start}
            onChangeText={setStart}
          />
          <Input
            label="Eating window ends (HH:MM)"
            value={end}
            onChangeText={setEnd}
          />
        </>
      ) : null}
      <Button
        title="Save situation mode"
        onPress={() => {
          try {
            const situation = {
              mode,
              day: localDay(),
              extra_ml: Number(extra),
              interval_minutes: Number(interval),
              start,
              end,
            };
            validateSituation(situation);
            void store
              .saveSettings({ ...store.settings, situation })
              .catch((e) => setError(e.message));
            setError("");
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      />
      {saved ? (
        <>
          <T>
            {automaticBlocked(store.settings)
              ? "Your kidney or medical plan keeps its saved fluid goal. Situation extra water is not added."
              : situationReason(saved)}
          </T>
          <Button
            secondary
            title="Turn off situation mode"
            onPress={() =>
              void store
                .saveSettings({ ...store.settings, situation: undefined })
                .catch((e) => setError(e.message))
            }
          />
        </>
      ) : null}
      <ErrorText error={error} />
    </View>
  );
}

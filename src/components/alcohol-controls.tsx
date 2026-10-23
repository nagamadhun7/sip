import { defaultProfile } from "../drink-maker/core";
import React, { useState } from "react";
import { View } from "react-native";
import { useStore } from "../state/store";
import { T, Input, Button, ErrorText } from "./ui";
import { alcoholAllowed, alcoholWeek } from "../features/alcohol";
import { localDay } from "../lib/model";
export function AlcoholControls({ summary = false }: { summary?: boolean }) {
  const store = useStore(),
    s = store.settings,
    [limit, setLimit] = useState(s.alcohol ? String(s.alcohol.limit) : ""),
    [error, setError] = useState("");
  if ((s.profile?.age ?? 0) < 18) return null;
  const a = alcoholWeek(store.entries, s);
  return (
    <View style={{ gap: 12 }}>
      <T size={summary ? 18 : 22} bold>
        Alcohol pacing
      </T>
      {alcoholAllowed(s) ? (
        <>
          <T>
            {+a.count.toFixed(2)} standard drinks today
            {s.alcohol ? ` of your ${s.alcohol.limit} limit` : ""}.{" "}
            {a.unknown
              ? `${a.unknown} drink(s) missing ABV; total incomplete.`
              : ""}
          </T>
          <T>{a.freeDays} confirmed drink-free days this week.</T>
          {a.nudge ? <T>Consider water before your next drink.</T> : null}
          {!summary ? (
            <>
              <Input
                numeric
                label="Your own daily standard drink limit"
                value={limit}
                onChangeText={setLimit}
              />
              <T muted>
                US definition: 14 g alcohol per standard drink. No blood alcohol
                estimate.
              </T>
              <Button
                title="Save my alcohol limit"
                onPress={() => {
                  if (
                    !limit.trim() ||
                    !Number.isFinite(Number(limit)) ||
                    Number(limit) < 0
                  ) {
                    setError("Enter your own non-negative limit.");
                    return;
                  }
                  void store
                    .saveSettings({
                      ...s,
                      alcohol: {
                        limit: Number(limit),
                        grams: 14,
                        freeDays: s.alcohol?.freeDays ?? [],
                      },
                    })
                    .catch((e) => setError(e.message));
                }}
              />
              <Button
                secondary
                title="Confirm today is drink-free"
                disabled={!s.alcohol}
                onPress={() =>
                  void store
                    .saveSettings({
                      ...s,
                      alcohol: {
                        limit:
                          s.alcohol?.limit ??
                          (Number.isFinite(Number(limit)) ? Number(limit) : 0),
                        grams: 14,
                        freeDays: [
                          ...new Set([
                            ...(s.alcohol?.freeDays ?? []),
                            localDay(),
                          ]),
                        ],
                      },
                    })
                    .catch((e) => setError(e.message))
                }
              />
            </>
          ) : null}
        </>
      ) : !summary ? (
        <Button
          secondary
          title="Enable adult alcohol tracking"
          onPress={() =>
            void store
              .saveSettings({
                ...s,
                makerProfile: {
                  ...defaultProfile,
                  ...s.makerProfile,
                  alcohol_tracking: true,
                },
              })
              .catch((e) => setError(e.message))
          }
        />
      ) : null}
      <ErrorText error={error} />
    </View>
  );
}

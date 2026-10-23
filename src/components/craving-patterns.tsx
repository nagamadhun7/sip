import React, { useState, useMemo } from "react";
import { View } from "react-native";
import { Host, Switch } from "@expo/ui";
import { router, useLocalSearchParams } from "expo-router";
import { useStore } from "../state/store";
import { useToday } from "../lib/use-today";
import {
  cravingPatterns,
  patternAlternative,
  cravingDefaults,
} from "../features/craving-patterns";
import { formatVolume } from "../lib/model";
import { requestReminderPermission } from "../lib/reminders";
import { AccessiblePressable as Pressable } from "./accessible-pressable";
import { T, Button, Input, ErrorText } from "./ui";
function clock(minute: number, locale: string) {
  const at = new Date();
  at.setHours(0, minute, 0, 0);
  return at.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" });
}
export function CravingPatterns({ controls = false }: { controls?: boolean }) {
  const store = useStore(),
    params = useLocalSearchParams<{ patterns?: string }>();
  const day = useToday();
  const [open, setOpen] = useState(controls || params.patterns === "1"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [minutes, setMinutes] = useState(
      String(store.settings.cravingNudges?.lead_minutes ?? 10),
    );
  const prefs = { ...cravingDefaults, ...store.settings.cravingNudges },
    analysis = useMemo(
      () => cravingPatterns(store.entries, new Date(day + "T12:00:00")),
      [store.entries, day],
    ),
    locale = store.settings.locale ?? "en-US";
  async function change(patch: Partial<typeof prefs>) {
    setBusy(true);
    setError("");
    try {
      if (patch.enabled === true) await requestReminderPermission();
      await store.saveSettings({
        ...store.settings,
        cravingNudges: { ...prefs, ...patch },
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <View style={{ gap: 14 }}>
      {!controls ? (
        <Pressable
          onPress={() => setOpen(!open)}
          accessibilityState={{ expanded: open }}
          style={{
            paddingVertical: 14,
            borderBottomWidth: 1,
            borderColor: "#EFEFEF",
          }}
        >
          <T size={17} bold>
            Drink-time patterns {open ? "−" : "+"}
          </T>
        </Pressable>
      ) : null}
      {open ? (
        <>
          <T size={13} muted>
            From {analysis.from} to {analysis.to}: {analysis.loggedDays} days
            with logs. These are recorded routines, not a prediction of
            cravings. All analysis stays on this device.
          </T>
          {!analysis.patterns.length ? (
            <T size={14}>
              No consistent soda or third-coffee time yet. A pattern needs
              matching logs on at least three separate days, in the same
              two-hour window on most days that drink was recorded. Keep logging
              normally.
            </T>
          ) : null}
          {analysis.patterns.map((p) => {
            const alternative = patternAlternative(
                p,
                [...store.library, ...store.catalog],
                store.settings,
              ),
              unit = p.metric === "sugar" ? "g sugar" : "mg caffeine";
            return (
              <View
                key={p.kind}
                style={{
                  gap: 8,
                  paddingVertical: 12,
                  borderBottomWidth: 1,
                  borderColor: "#EFEFEF",
                }}
              >
                <T bold>
                  {p.kind === "soda" ? "Soda" : "Third coffee log"} · around{" "}
                  {clock(p.minute, locale)}
                </T>
                <T size={14}>
                  Recorded between {clock(p.startHour * 60, locale)} and{" "}
                  {clock((p.startHour + 2) * 60, locale)} on {p.days} of{" "}
                  {p.eligibleDays}{" "}
                  {p.kind === "soda"
                    ? "days with soda logs"
                    : "days with at least three coffee logs"}
                  .
                </T>
                <T size={13} muted>
                  Typical logged amount:{" "}
                  {formatVolume(p.ml, store.settings.units)}.{" "}
                  {p.amount === null
                    ? `${p.metric === "sugar" ? "Sugar" : "Caffeine"} not fully listed; no nutrient comparison.`
                    : `Median recorded ${unit}: ${+p.amount.toFixed(1)}.`}
                </T>
                <T size={14}>
                  Pause and choose what fits today.
                  {alternative
                    ? ` If you want an alternative, ${alternative.name} at ${formatVolume(p.ml, store.settings.units)} has ${+((alternative.nutrition[p.metric]! * p.ml) / 100).toFixed(1)} ${unit} from its saved data.`
                    : " Check your saved drinks for an option that fits your limits."}
                  {store.settings.trackingHelper === "kidney" ||
                  store.settings.profile?.status === "medical"
                    ? " Keep to your own fluid plan; this is not a prompt to drink more."
                    : ""}
                </T>
                {alternative ? (
                  <Button
                    secondary
                    title={`Review ${alternative.name}`}
                    onPress={() =>
                      router.push({
                        pathname: "/drink",
                        params: {
                          drink: alternative.id,
                          estimated_ml: String(p.ml),
                        },
                      })
                    }
                  />
                ) : null}
              </View>
            );
          })}
          <T size={12} muted>
            Third coffee means the third coffee entry in a local calendar day,
            not three standard cups. Entries recorded today are excluded from
            pattern learning. Serving sizes and nutrient estimates vary.
          </T>
          {controls ? (
            <>
              <Host matchContents>
                <Switch
                  label="Drink-time nudges"
                  value={prefs.enabled}
                  disabled={busy}
                  onValueChange={(enabled) => void change({ enabled })}
                />
              </Host>
              <Host matchContents>
                <Switch
                  label="Soda-time nudges"
                  value={prefs.soda}
                  disabled={busy}
                  onValueChange={(soda) => void change({ soda })}
                />
              </Host>
              <Host matchContents>
                <Switch
                  label="Third-coffee nudges"
                  value={prefs.thirdCoffee}
                  disabled={busy}
                  onValueChange={(thirdCoffee) => void change({ thirdCoffee })}
                />
              </Host>
              <Input
                label="Nudge minutes before usual time (0–60)"
                numeric
                value={minutes}
                onChangeText={setMinutes}
              />
              <Button
                secondary
                title="Save nudge timing"
                busy={busy}
                onPress={() => {
                  const value = Number(minutes);
                  if (
                    !minutes.trim() ||
                    !Number.isInteger(value) ||
                    value < 0 ||
                    value > 60
                  ) {
                    setError("Enter whole minutes from 0–60.");
                    return;
                  }
                  void change({ lead_minutes: value });
                }}
              />
              <T size={12} muted>
                Nudges are optional and do not turn on hydration reminders.
                Quiet hours, snooze, your eating window and the shared daily
                notification cap apply. Refreshing the app updates the next
                seven days. Notifications may show your recorded routine on the
                lock screen; opening one lets you review options without logging
                anything.
              </T>
              {prefs.enabled && !analysis.patterns.length ? (
                <T size={13}>
                  Nudges are on, but none are scheduled until enough matching
                  history exists.
                </T>
              ) : null}
              <ErrorText error={error} />
            </>
          ) : (
            <Button
              secondary
              title="Choose pattern nudges in Settings"
              onPress={() => router.push("/settings")}
            />
          )}
        </>
      ) : null}
    </View>
  );
}

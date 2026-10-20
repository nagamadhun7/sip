import React, { useState } from "react";
import { Linking } from "react-native";
import { Host, Switch } from "@expo/ui";
import { router } from "expo-router";
import { useStore } from "../state/store";
import { Settings } from "../lib/model";
import { shareCsv } from "../lib/export";
import { setReminders } from "../lib/reminders";
import { Page, T, Row, Button, ErrorText, Input } from "../components/ui";
export default function SettingsScreen() {
  const store = useStore(),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [bed, setBed] = useState(store.settings.bedtime);
  async function change(patch: Partial<Settings>) {
    setError("");
    setBusy(true);
    try {
      await store.saveSettings({ ...store.settings, ...patch });
    } catch {
      setError("Could not save setting. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  async function remind(enabled: boolean) {
    setError("");
    setBusy(true);
    const previous = store.settings,
      next = { ...previous, reminders: enabled };
    try {
      await setReminders(next);
      try {
        await store.saveSettings(next);
      } catch (e) {
        await setReminders(previous);
        throw e;
      }
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not change reminders. Please retry.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function exportData() {
    setError("");
    setBusy(true);
    try {
      await shareCsv(store.entries);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not export. Try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Page>
      <Row
        title="Your profile"
        detail="Age, weight, sex and status"
        onPress={() =>
          router.push({ pathname: "/onboarding", params: { edit: "1" } })
        }
      />
      <Row
        title="Daily targets"
        detail="Fluid intake, caffeine, sugar and more"
        onPress={() => router.push("/targets")}
      />
      <Row
        title="My drinks"
        detail="Saved drinks and Drink maker"
        onPress={() => router.push("/my-drinks")}
      />
      <Row
        title="Drink maker profile"
        detail="Age band, dietary and personal limits"
        onPress={() => router.push("/maker-profile")}
      />
      <T size={13} muted>
        Home screen focus
      </T>
      {(["water", "sugar", "caffeine"] as const).map((f) => (
        <Row
          key={f}
          title={
            f === "water" ? "Hydration" : f === "sugar" ? "Sugar" : "Caffeine"
          }
          value={store.settings.focus === f ? "✓" : ""}
          onPress={busy ? undefined : () => change({ focus: f })}
        />
      ))}
      <Row
        title="Units"
        detail="Fluid ounces are US fl oz"
        value={store.settings.units === "ml" ? "ml" : "fl oz"}
        onPress={
          busy
            ? undefined
            : () =>
                change({ units: store.settings.units === "ml" ? "oz" : "ml" })
        }
      />
      <Input
        label="Bedtime (24-hour HH:MM)"
        value={bed}
        onChangeText={setBed}
      />
      <Button
        secondary
        title="Save bedtime"
        disabled={busy}
        onPress={() => {
          if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(bed)) {
            setError("Enter a time such as 22:30.");
            return;
          }
          void change({ bedtime: bed });
        }}
      />
      <T size={20} bold>
        Reminders
      </T>
      <T size={13} muted>
        Daily at 10 am, 1 pm, 4 pm and 7 pm, in your device’s local time.
      </T>
      <Host matchContents>
        <Switch
          label="Hydration reminders"
          value={store.settings.reminders}
          disabled={busy}
          onValueChange={(v) => void remind(v)}
        />
      </Host>
      <Button
        title="Open device notification settings"
        secondary
        onPress={() => void Linking.openSettings()}
      />
      <Row
        title="Export data"
        detail={`${store.entries.length} entries · CSV file`}
        onPress={busy ? undefined : () => void exportData()}
      />
      <Row
        title="Your data"
        detail="Privacy, sources and deleting your records"
        onPress={() => router.push("/privacy")}
      />
      <ErrorText error={error} />
      <T size={12} muted>
        Sip 1.0.0 · Free tracker
      </T>
    </Page>
  );
}

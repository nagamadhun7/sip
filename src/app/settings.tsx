import React, { useState } from "react";
import { Linking } from "react-native";
import { Host, Switch } from "@expo/ui";
import { router } from "expo-router";
import { useStore } from "../state/store";
import { Settings } from "../lib/model";
import { shareCsv } from "../lib/export";
import { setReminders } from "../lib/reminders";
import { Page, T, Row, Button, ErrorText, Input } from "../components/ui";
import { defaultReminderPreferences } from "../lib/reminder-plan";
export default function SettingsScreen() {
  const store = useStore(),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [bed, setBed] = useState(store.settings.bedtime);
  const reminder = {
    ...defaultReminderPreferences,
    ...store.settings.reminderPreferences,
  };
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
      await setReminders(next, store.entries);
      try {
        await store.saveSettings(next);
      } catch (e) {
        await setReminders(previous, store.entries);
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
        Scheduled from your actual intake and preferences. Quiet hours and the
        daily cap apply.
      </T>
      <Host matchContents>
        <Switch
          label="Hydration reminders"
          value={store.settings.reminders}
          disabled={busy}
          onValueChange={(v) => void remind(v)}
        />
      </Host>
      {(["only_behind", "per_drink", "caffeine_cutoff"] as const).map((key) => (
        <Host key={key} matchContents>
          <Switch
            label={
              {
                only_behind: "Only when behind",
                per_drink: "Remind after a drink",
                caffeine_cutoff: "Caffeine cutoff reminder",
              }[key]
            }
            value={reminder[key]}
            disabled={busy}
            onValueChange={(value) =>
              void change({
                reminderPreferences: { ...reminder, [key]: value },
              })
            }
          />
        </Host>
      ))}
      {(
        [
          "quiet_start",
          "quiet_end",
          "interval_minutes",
          "daily_cap",
          "snooze_minutes",
          "cutoff_hours",
        ] as const
      ).map((key) => (
        <ReminderField
          key={key}
          name={key}
          value={String(reminder[key])}
          onSave={(value) => {
            const clock = key.startsWith("quiet_");
            if (
              clock
                ? !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)
                : !Number.isFinite(Number(value)) ||
                  (key === "daily_cap" && !Number.isInteger(Number(value))) ||
                  Number(value) < 1 ||
                  Number(value) >
                    (key === "daily_cap"
                      ? 8
                      : key === "cutoff_hours"
                        ? 24
                        : 1440)
            ) {
              setError("Enter a valid reminder value.");
              return;
            }
            void change({
              reminderPreferences: {
                ...reminder,
                [key]: clock ? value : Number(value),
              },
            });
          }}
        />
      ))}
      <Row
        title="Sip Pro"
        detail="Store options and restore purchases"
        onPress={() => router.push("/pro")}
      />
      <Row
        title="Health sync"
        detail={
          store.settings.healthSync
            ? store.settings.healthLastSync
              ? "Last sync " +
                new Date(store.settings.healthLastSync).toLocaleString()
              : "Sync enabled; waiting for first sync"
            : "Connect Apple Health or Health Connect"
        }
        onPress={
          busy
            ? undefined
            : async () => {
                setBusy(true);
                setError("");
                try {
                  await store.connectHealth();
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }
        }
      />
      {store.settings.healthSync ? (
        <>
          <Button
            secondary
            title="Sync Health now"
            disabled={busy}
            onPress={async () => {
              setBusy(true);
              try {
                await store.syncHealth();
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          />
          <Button
            secondary
            title="Disconnect Health"
            disabled={busy}
            onPress={() => void change({ healthSync: false })}
          />
        </>
      ) : null}
      <T size={12} muted>
        Health sync exports known drink nutrients and imports hydration records.
        Missing nutrients remain not listed. It runs after changes and while the
        app is active. Access depends on the permissions you grant.
      </T>
      {store.settings.healthLastError ? (
        <ErrorText error={store.settings.healthLastError} />
      ) : null}
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
      <ErrorText error={error || store.serviceError} />
      <T size={12} muted>
        Sip · Device storage
      </T>
    </Page>
  );
}

function ReminderField({
  name,
  value,
  onSave,
}: {
  name: string;
  value: string;
  onSave: (v: string) => void;
}) {
  const [text, setText] = useState(value);
  return (
    <>
      <Input
        label={
          {
            quiet_start: "Quiet hours start (HH:MM)",
            quiet_end: "Quiet hours end (HH:MM)",
            interval_minutes: "Minutes after a drink",
            daily_cap: "Daily notification cap (1–8)",
            snooze_minutes: "Snooze minutes",
            cutoff_hours: "Hours before bedtime for caffeine cutoff",
          }[name] ?? name
        }
        value={text}
        onChangeText={setText}
        numeric={!name.startsWith("quiet_")}
      />
      <Button
        secondary
        title={"Save " + name.replaceAll("_", " ")}
        onPress={() => onSave(text)}
      />
    </>
  );
}

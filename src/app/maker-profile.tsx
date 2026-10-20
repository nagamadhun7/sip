import React, { useState } from "react";
import { Host, Switch } from "@expo/ui";
import { router } from "expo-router";
import { useStore } from "../state/store";
import { defaultProfile } from "../drink-maker/core";
import { Page, T, Row, Button, ErrorText } from "../components/ui";
export default function MakerProfile() {
  const store = useStore(),
    [profile, setProfile] = useState({
      ...defaultProfile,
      ...store.settings.makerProfile,
    }),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function save() {
    setBusy(true);
    try {
      await store.saveSettings({ ...store.settings, makerProfile: profile });
      router.back();
    } catch {
      setError("Could not save your profile. Please retry.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Page
      footer={
        <Button title="Save profile" onPress={() => void save()} busy={busy} />
      }
    >
      <T size={14} muted>
        Optional. Stored on this phone; shared with the recipe service only when
        you generate in Goal mode.
      </T>
      <T bold>Age band</T>
      {(["unknown", "under18", "18-64", "65plus"] as const).map((age) => (
        <Row
          key={age}
          title={
            age === "unknown"
              ? "Prefer not to say"
              : age === "under18"
                ? "Under 18"
                : age === "65plus"
                  ? "65 or older"
                  : "18–64"
          }
          value={profile.age_band === age ? "✓" : ""}
          onPress={() => setProfile((p) => ({ ...p, age_band: age }))}
        />
      ))}
      {(
        ["pregnant", "nursing", "medical_plan", "alcohol_tracking"] as const
      ).map((key) => (
        <Host key={key} matchContents>
          <Switch
            value={profile[key]}
            label={
              {
                pregnant: "Pregnant",
                nursing: "Nursing",
                medical_plan: "I follow a medical plan",
                alcohol_tracking: "Alcohol tracking enabled",
              }[key]
            }
            onValueChange={(value) =>
              setProfile((p) => ({ ...p, [key]: value }))
            }
          />
        </Host>
      ))}
      <T size={13} muted>
        Goal mode offers caffeine-free recipes until an adult age band is
        selected. Pregnancy/nursing applies a lower caffeine ceiling. A medical
        plan uses the limits you set in Daily targets; the app does not
        prescribe new limits. Alcohol ingredients also require an adult age
        band, alcohol tracking enabled, and no pregnancy/nursing flag.
      </T>
      <Row
        title="Daily targets"
        detail="Set the limits your plan specifies"
        onPress={() => router.push("/targets")}
      />
      <ErrorText error={error} />
    </Page>
  );
}

import React, { useState } from "react";
import { router } from "expo-router";
import { useStore } from "../state/store";
import { Page, T, Input, Button, ErrorText } from "../components/ui";
export default function Targets() {
  const { settings, saveSettings } = useStore();
  const keys = ["water", "caffeine", "sugar", "sodium", "potassium"] as const;
  const [values, setValues] = useState(
      Object.fromEntries(keys.map((k) => [k, String(settings[k])])),
    ),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const labels = {
    water: "Fluid intake (ml)",
    caffeine: "Caffeine limit (mg)",
    sugar: "Total sugar limit (g)",
    sodium: "Sodium limit (mg)",
    potassium: "Potassium target (mg)",
  };
  async function save() {
    setError("");
    const update: any = { ...settings };
    for (const k of keys) {
      const n = Number(values[k].replace(",", "."));
      if (
        !Number.isFinite(n) ||
        (k === "water" ? n <= 0 : n < 0) ||
        n > 100000
      ) {
        setError(
          "Enter a nonnegative target below 100,000; fluid target must exceed zero.",
        );
        return;
      }
      update[k] = n;
    }
    setBusy(true);
    try {
      await saveSettings(update);
      router.back();
    } catch {
      setError("Could not save targets. Try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Page footer={<Button title="Save targets" onPress={save} busy={busy} />}>
      <T muted>Personal goals you can change at any time.</T>
      {keys.map((k) => (
        <Input
          key={k}
          numeric
          label={labels[k]}
          value={values[k]}
          onChangeText={(v) => setValues((s) => ({ ...s, [k]: v }))}
        />
      ))}
      <ErrorText error={error} />
      <T size={13} muted>
        Targets cover your drinks. Food contributes sugar, minerals and fluids
        too. Choose targets appropriate for you; follow your clinician’s plan if
        you have one.
      </T>
    </Page>
  );
}

export { ErrorBoundary } from "../components/route-error";

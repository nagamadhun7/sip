import { calculateTargets } from "../lib/tracking";
import React, { useState } from "react";
import { View } from "react-native";
import { Host, Switch } from "@expo/ui";
import { router } from "expo-router";
import { useStore } from "../state/store";
import { Page, T, Input, Button, ErrorText } from "../components/ui";
import {
  goalsForSettings,
  goalLabels,
  validateGoals,
} from "../features/drink-goals";
import { alcoholAllowed } from "../features/alcohol";
export default function Targets() {
  const { settings, saveSettings } = useStore();
  const [goals, setGoals] = useState(() => goalsForSettings(settings)),
    [values, setValues] = useState(() =>
      Object.fromEntries(
        goalsForSettings(settings).map((g) => [
          g.key,
          g.amount === null ? "" : String(g.amount),
        ]),
      ),
    ),
    [fluid, setFluid] = useState(String(settings.water)),
    [totalSugar, setTotalSugar] = useState(String(settings.sugar)),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function save() {
    setError("");
    try {
      const updated = goals.map((g) => ({
        ...g,
        amount: values[g.key].trim()
          ? Number(values[g.key].replace(",", "."))
          : null,
      }));
      validateGoals(updated);
      const water = Number(fluid.replace(",", ".")),
        sugar = Number(totalSugar.replace(",", "."));
      if (
        !fluid.trim() ||
        !totalSugar.trim() ||
        !Number.isFinite(water) ||
        water <= 0 ||
        water > 100000 ||
        !Number.isFinite(sugar) ||
        sugar < 0 ||
        sugar > 100000
      )
        throw Error(
          "Enter a positive total-fluid goal and a valid total-sugar reference.",
        );
      const value = (key: "caffeine" | "sodium" | "potassium") => {
        const g = updated.find((g) => g.key === key)!;
        if (g.amount === null)
          throw Error(`${goalLabels[key]} needs an amount.`);
        return g.amount;
      };
      if (
        settings.profile &&
        settings.profile.status !== "medical" &&
        (settings.profile.age < 18 ||
          ["pregnant", "nursing"].includes(settings.profile.status))
      ) {
        const cap = calculateTargets(settings.profile, settings).caffeine;
        if (value("caffeine") > cap)
          throw Error(
            `Your profile uses a caffeine limit of ${cap} mg or lower.`,
          );
      }
      const alcohol = updated.find((g) => g.key === "alcohol")!;
      setBusy(true);
      await saveSettings({
        ...settings,
        water,
        sugar,
        caffeine: value("caffeine"),
        sodium: value("sodium"),
        potassium: value("potassium"),
        drinkGoals: updated,
        ...(alcoholAllowed(settings) && alcohol.amount !== null
          ? {
              alcohol: {
                limit: alcohol.amount,
                grams: settings.alcohol?.grams ?? 14,
                freeDays: settings.alcohol?.freeDays ?? [],
              },
            }
          : {}),
      });
      router.back();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Page
      footer={
        <Button title="Save goals" busy={busy} onPress={() => void save()} />
      }
    >
      <T muted>
        Targets fill toward a goal. Limits show how much is left. Optional goals
        stay blank until you choose them.
      </T>
      <Input
        numeric
        label="Total-fluid goal (ml; used for reminders)"
        value={fluid}
        onChangeText={setFluid}
      />
      <T size={12} muted>
        Your existing fluid goal is preserved. Plain water has its own goal
        below.
      </T>
      {goals
        .filter((g) => g.key !== "alcohol" || alcoholAllowed(settings))
        .map((g) => (
          <View key={g.key} style={{ gap: 10, paddingVertical: 8 }}>
            <Input
              numeric
              label={`${goalLabels[g.key]} ${g.kind} (${g.unit}${g.key === "plain_water" ? "" : " from drinks"})`}
              value={values[g.key]}
              onChangeText={(v) => setValues((s) => ({ ...s, [g.key]: v }))}
              placeholder="Not set"
            />
            {!["plain_water", "caffeine", "added_sugar"].includes(g.key) ? (
              <Host matchContents>
                <Switch
                  label={`Show ${goalLabels[g.key]} on Home`}
                  value={g.visible}
                  onValueChange={(visible) =>
                    setGoals((gs) =>
                      gs.map((x) => (x.key === g.key ? { ...x, visible } : x)),
                    )
                  }
                />
              </Host>
            ) : null}
          </View>
        ))}
      <T size={13} muted>
        Food also contributes calcium, vitamin D and potassium. These cards only
        show what is recorded from drinks. Alcohol is measured in standard
        drinks ({settings.alcohol?.grams ?? 14} g alcohol each).
      </T>
      <Input
        numeric
        label="Total-sugar reference (g; existing comparison and recipe tools)"
        value={totalSugar}
        onChangeText={setTotalSugar}
      />
      <ErrorText error={error} />
    </Page>
  );
}
export { ErrorBoundary } from "../components/route-error";

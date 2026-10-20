import React, { useState } from "react";
import { View, Pressable } from "react-native";
import { router, Redirect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useStore } from "../state/store";
import {
  Page,
  T,
  Glass,
  Button,
  Row,
  Input,
  ErrorText,
} from "../components/ui";
export default function Onboarding() {
  const store = useStore(),
    safe = useSafeAreaInsets(),
    [step, setStep] = useState(0),
    [settings, setSettings] = useState(store.settings),
    [water, setWater] = useState(String(store.settings.water)),
    [sugar, setSugar] = useState(String(store.settings.sugar)),
    [caffeine, setCaffeine] = useState(String(store.settings.caffeine)),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  if (store.settings.onboarded) return <Redirect href="/" />;
  async function finish() {
    const w = Number(water),
      s = Number(sugar),
      c = Number(caffeine);
    if (![w, s, c].every((n) => Number.isFinite(n) && n > 0 && n <= 100000)) {
      setError("Enter positive daily targets below 100,000.");
      return;
    }
    setBusy(true);
    try {
      await store.saveSettings({
        ...settings,
        water: w,
        sugar: s,
        caffeine: c,
        onboarded: true,
      });
      router.replace("/");
    } catch {
      setError("Could not save your preferences. Try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <View style={{ flex: 1, paddingTop: safe.top, backgroundColor: "white" }}>
      <Page
        footer={
          <Button
            title={
              step === 0
                ? "Get started"
                : step === 1
                  ? "Continue"
                  : "Start tracking"
            }
            onPress={() => (step < 2 ? setStep(step + 1) : void finish())}
            busy={busy}
          />
        }
      >
        {step === 0 ? (
          <View style={{ paddingTop: 40, gap: 28, alignItems: "center" }}>
            <Glass size={110} fraction={0.6} />
            <View style={{ width: "100%", gap: 16, paddingTop: 20 }}>
              <T size={44} bold>
                Know what{"\n"}you drink
              </T>
              <T size={18} muted>
                Water, coffee, soda, anything.{"\n"}See what is in it.
              </T>
              <T size={14} muted>
                Free. No account required. Your history stays on this phone.
              </T>
            </View>
          </View>
        ) : step === 1 ? (
          <View style={{ gap: 20, paddingTop: 25 }}>
            <T size={30} bold>
              What matters to you?
            </T>
            <T muted>
              Choose the focus for your home screen. You can change it later.
            </T>
            {(["water", "sugar", "caffeine"] as const).map((f) => (
              <Row
                key={f}
                title={
                  f === "water"
                    ? "Hydration"
                    : f === "sugar"
                      ? "Sugar"
                      : "Caffeine"
                }
                detail={
                  f === "water"
                    ? "Daily amount"
                    : f === "sugar"
                      ? "Daily limit"
                      : "Intake and estimated clearance"
                }
                value={settings.focus === f ? "✓" : ""}
                onPress={() => setSettings((s) => ({ ...s, focus: f }))}
              />
            ))}
          </View>
        ) : (
          <View style={{ gap: 22, paddingTop: 25 }}>
            <T size={30} bold>
              Your daily targets
            </T>
            <T muted>
              Start with these editable tracking goals, or enter your own.
            </T>
            <Input
              label="Fluid intake (ml)"
              value={water}
              onChangeText={setWater}
              numeric
            />
            <Input
              label="Total sugar limit (g)"
              value={sugar}
              onChangeText={setSugar}
              numeric
            />
            <Input
              label="Caffeine limit (mg)"
              value={caffeine}
              onChangeText={setCaffeine}
              numeric
            />
            <T size={13} muted>
              These are starting values, not personalized recommendations.
              Targets cover drinks; food also contributes. Follow any targets
              provided by your clinician.
            </T>
            <ErrorText error={error} />
          </View>
        )}
        {step > 0 ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => setStep(step - 1)}
            style={{ padding: 12 }}
          >
            <T muted>‹ Back</T>
          </Pressable>
        ) : null}
      </Page>
    </View>
  );
}

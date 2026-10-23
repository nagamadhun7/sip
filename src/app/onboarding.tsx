import { AccessiblePressable as Pressable } from "../components/accessible-pressable";
import React, { useState } from "react";
import { View } from "react-native";
import { router, Redirect, useLocalSearchParams } from "expo-router";
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
import { calculateTargets, profileFlags, UserProfile } from "../lib/tracking";
export default function Onboarding() {
  const params = useLocalSearchParams<{ edit?: string }>();
  const store = useStore(),
    safe = useSafeAreaInsets(),
    [step, setStep] = useState(params.edit ? 1 : 0),
    [age, setAge] = useState(
      store.settings.profile ? String(store.settings.profile.age) : "",
    ),
    [weight, setWeight] = useState(
      store.settings.profile ? String(store.settings.profile.weight_kg) : "",
    ),
    [sex, setSex] = useState<UserProfile["sex"]>(
      store.settings.profile?.sex ?? "unspecified",
    ),
    [status, setStatus] = useState<UserProfile["status"]>(
      store.settings.profile?.status ?? "standard",
    ),
    [settings, setSettings] = useState(store.settings),
    [water, setWater] = useState(String(store.settings.water)),
    [sugar, setSugar] = useState(String(store.settings.sugar)),
    [caffeine, setCaffeine] = useState(String(store.settings.caffeine)),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  if (store.settings.onboarded && !params.edit) return <Redirect href="/" />;
  async function finish() {
    const w = Number(water),
      s = Number(sugar),
      c = Number(caffeine);
    if (
      w <= 0 ||
      ![w, s, c].every((n) => Number.isFinite(n) && n >= 0 && n <= 100000)
    ) {
      setError("Enter positive daily targets below 100,000.");
      return;
    }
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(settings.bedtime)) {
      setError("Enter bedtime as HH:MM.");
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
        profile: { age: Number(age), weight_kg: Number(weight), sex, status },
        makerProfile: profileFlags(
          { age: Number(age), weight_kg: Number(weight), sex, status },
          settings,
        ),
      });
      if (params.edit) router.back();
      else router.replace("/");
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
            onPress={() => {
              if (step === 0) setStep(1);
              else if (step === 1) {
                try {
                  const profile = {
                    age: Number(age),
                    weight_kg: Number(weight),
                    sex,
                    status,
                  };
                  const targets = calculateTargets(profile, settings);
                  setSettings((s) => ({ ...s, ...targets, profile }));
                  setWater(String(targets.water));
                  setSugar(String(targets.sugar));
                  setCaffeine(String(targets.caffeine));
                  setError("");
                  setStep(2);
                } catch (e) {
                  setError((e as Error).message);
                }
              } else void finish();
            }}
            busy={busy}
          />
        }
      >
        {step === 0 ? (
          <View style={{ paddingTop: 40, gap: 28, alignItems: "center" }}>
            <Glass size={110} fraction={0} />
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
            <Input
              label="Age (years)"
              value={age}
              onChangeText={setAge}
              numeric
            />
            <Input
              label="Weight (kg)"
              value={weight}
              onChangeText={setWeight}
              numeric
            />
            <T muted>Sex used for target estimates</T>
            {(["female", "male", "unspecified"] as const).map((value) => (
              <Row
                key={value}
                title={value === "unspecified" ? "Prefer not to say" : value}
                value={sex === value ? "✓" : ""}
                onPress={() => setSex(value)}
              />
            ))}
            <T muted>Status</T>
            {(["standard", "pregnant", "nursing", "medical"] as const).map(
              (value) => (
                <Row
                  key={value}
                  title={
                    value === "medical" ? "I follow a medical plan" : value
                  }
                  value={status === value ? "✓" : ""}
                  onPress={() => setStatus(value)}
                />
              ),
            )}
            <Input
              label="Bedtime (HH:MM)"
              value={settings.bedtime}
              onChangeText={(bedtime) =>
                setSettings((s) => ({ ...s, bedtime }))
              }
            />
            <ErrorText error={error} />
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
              Calculated from your saved profile. Review or enter your own
              targets.
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
              These editable estimates allocate 80% of age/sex water reference
              intake to drinks. Caffeine considers weight and status. Targets
              cover drinks; food also contributes. Follow any targets provided
              by your clinician.
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

export { ErrorBoundary } from "../components/route-error";

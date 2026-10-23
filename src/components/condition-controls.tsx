import React, { useState } from "react";
import { View, Linking } from "react-native";
import { router } from "expo-router";
import { useStore } from "../state/store";
import {
  helperLabels,
  applyHelper,
  helperReason,
  type TrackingHelper,
} from "../features/conditions";
import { T, Button, ErrorText } from "./ui";
export function ConditionControls() {
  const { settings, saveSettings } = useStore();
  const [choice, setChoice] = useState<TrackingHelper>(
      settings.trackingHelper ?? "none",
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <View style={{ gap: 12 }}>
      <T size={13} muted>
        Tracking helpers, not medical advice. These totals cover drinks only.
        Use limits agreed with your care team where relevant.
      </T>
      {Object.entries(helperLabels).map(([key, label]) => (
        <Button
          secondary
          key={key}
          disabled={busy}
          title={`${choice === key ? "Selected: " : ""}${label}`}
          onPress={() => setChoice(key as TrackingHelper)}
        />
      ))}
      <Button
        title="Apply tracking helper"
        busy={busy}
        onPress={async () => {
          setBusy(true);
          setError("");
          try {
            await saveSettings(applyHelper(settings, choice));
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      />
      <T size={13}>{helperReason(settings)}</T>
      <Button
        secondary
        title="Edit my limits"
        onPress={() => router.push("/targets")}
      />
      <Button
        secondary
        title="Pregnancy caffeine source · ACOG"
        onPress={() =>
          void Linking.openURL(
            "https://www.acog.org/womens-health/experts-and-stories/ask-acog/how-much-coffee-can-i-drink-while-pregnant",
          )
        }
      />
      <Button
        secondary
        title="Individual kidney plans · NIDDK"
        onPress={() =>
          void Linking.openURL(
            "https://www.niddk.nih.gov/health-information/kidney-disease/chronic-kidney-disease-ckd/healthy-eating-adults-chronic-kidney-disease",
          )
        }
      />
      <ErrorText error={error} />
    </View>
  );
}

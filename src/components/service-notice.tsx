import React from "react";
import { View } from "react-native";
import { useStore } from "../state/store";
import { T, Button } from "./ui";
export function ServiceNotice() {
  const store = useStore();
  if (!store.serviceError) return null;
  return (
    <View
      accessibilityRole="alert"
      style={{ padding: 16, backgroundColor: "#FFF4EC" }}
    >
      <T>{store.serviceError}</T>
      <Button
        secondary
        title="Reload saved data"
        onPress={() => void store.reload()}
      />
    </View>
  );
}

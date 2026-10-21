import React, { useRef, useState } from "react";
import { FlatList, View, Pressable, StyleSheet } from "react-native";
import { router } from "expo-router";
import { DrinkIcon } from "../components/drink-icon";
import { useStore } from "../state/store";
import { T, Button, ErrorText } from "../components/ui";
import { id, formatVolume } from "../lib/model";
import type { Drink } from "../lib/model";
export default function MyDrinks() {
  const store = useStore(),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [pending, setPending] = useState("");
  const lock = useRef(false);
  async function log(drink: Drink) {
    if (lock.current) return;
    lock.current = true;
    setPending(drink.id);
    setError("");
    try {
      await store.saveEntry({
        id: id(),
        drink,
        ml: drink.serving,
        at: new Date().toISOString(),
      });
      setNotice(
        `${drink.name} · ${formatVolume(drink.serving, store.settings.units)} logged to Today.`,
      );
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not log this drink. Please retry.",
      );
    } finally {
      lock.current = false;
      setPending("");
    }
  }
  return (
    <FlatList
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ padding: 24, gap: 16, paddingBottom: 40 }}
      data={store.library}
      keyExtractor={(d) => d.id}
      ListHeaderComponent={
        <View style={{ gap: 16 }}>
          <T size={14} muted>
            Save recipes here, then log the right amount in one tap.
          </T>
          <Button
            title="Drink maker"
            onPress={() => router.push("/drink-maker")}
          />
          <ErrorText error={error} />
          {notice ? <T size={13}>{notice}</T> : null}
        </View>
      }
      ListEmptyComponent={
        <T muted>
          No saved drinks yet. Make one in Lab or save a custom drink.
        </T>
      }
      renderItem={({ item }) => (
        <View
          style={{
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderColor: "#E8EBED",
            paddingVertical: 14,
            gap: 10,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <DrinkIcon drink={item} size={36} />
            <View style={{ flex: 1, gap: 3 }}>
              <T bold>{item.name}</T>
              <T size={12} muted>
                {formatVolume(item.serving, store.settings.units)} ·{" "}
                {item.recipe ? "Estimated recipe" : item.source}
              </T>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Log ${item.name}`}
              disabled={!!pending}
              onPress={() => void log(item)}
              style={{ padding: 12 }}
            >
              <T bold style={{ color: "#14436F" }}>
                {pending === item.id ? "Saving…" : "Log"}
              </T>
            </Pressable>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Edit ${item.name}`}
            onPress={() =>
              router.push(
                item.recipe
                  ? { pathname: "/drink-maker", params: { recipe: item.id } }
                  : { pathname: "/drink", params: { drink: item.id } },
              )
            }
          >
            <T size={13} muted>
              Edit {item.recipe ? "in Lab" : "drink"} ›
            </T>
          </Pressable>
        </View>
      )}
    />
  );
}

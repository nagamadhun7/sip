import { callService } from "../drink-maker/client";
import type { Drink } from "../lib/model";
import { alcoholAllowed, isAlcohol } from "../features/alcohol";
import { CompareDrinks } from "../components/compare-drinks";
import { DrinkIcon } from "../components/drink-icon";
import React, { useState } from "react";
import { View, FlatList } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { AccessiblePressable as Pressable } from "../components/accessible-pressable";
import { useStore } from "../state/store";
import { id, formatVolume } from "../lib/model";
import { T, Input, Row, Button } from "../components/ui";
import { catalogDrinks } from "../lib/tracking";
import { LogInput } from "../components/log-input";
export default function Add() {
  const params = useLocalSearchParams<{ mode?: string }>();
  const [autoVoice, setAutoVoice] = useState(params.mode === "voice");
  const [tab, setTab] = useState<"Note" | "Drinks" | "More">("Note");
  const { library, catalog, containers, saveEntry, saveDrink, settings } =
      useStore(),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [query, setQuery] = useState(""),
    [usda, setUsda] = useState<Drink[]>([]),
    [lookupBusy, setLookupBusy] = useState(false);
  const list = catalogDrinks(library, catalog).filter(
    (d) =>
      (!isAlcohol(d) || alcoholAllowed(settings)) &&
      d.name.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <FlatList
      keyboardShouldPersistTaps="handled"
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: 24, paddingBottom: 40 }}
      style={{ backgroundColor: "white" }}
      data={tab === "Drinks" ? list : []}
      keyExtractor={(d) => d.id}
      ListHeaderComponent={
        <View style={{ gap: 20, marginBottom: 20 }}>
          <View style={{ flexDirection: "row", gap: 24, marginBottom: 6 }}>
            {(["Note", "Drinks", "More"] as const).map((label) => (
              <Pressable
                key={label}
                accessibilityRole="tab"
                accessibilityState={{ selected: tab === label }}
                onPress={() => setTab(label)}
                style={{
                  paddingVertical: 12,
                  borderBottomWidth: tab === label ? 2 : 0,
                  borderColor: "#252525",
                }}
              >
                <T size={18} bold={tab === label} muted={tab !== label}>
                  {label}
                </T>
              </Pressable>
            ))}
          </View>
          {tab === "Note" ? (
            <>
              <T size={28} bold>
                What did you drink?
              </T>
              {params.mode === "voice" ? (
                <T muted>
                  Speak your drinks, then check the amounts before saving.
                </T>
              ) : null}
              <LogInput
                autoStartVoice={autoVoice}
                onAutoStartHandled={() => setAutoVoice(false)}
              />
            </>
          ) : null}
          {tab === "More" ? (
            <>
              <CompareDrinks />
              <Button
                secondary
                title="Photograph a drink"
                onPress={() =>
                  router.push({ pathname: "/scan", params: { recognize: "1" } })
                }
              />
            </>
          ) : null}
          {tab === "Drinks" ? (
            <Input
              label="Search drinks"
              value={query}
              onChangeText={setQuery}
              placeholder="Water, coffee, your recipes…"
            />
          ) : null}
          {tab === "Drinks" ? (
            <View style={{ gap: 10 }}>
              <Button
                secondary
                title="Search USDA catalog"
                busy={lookupBusy}
                disabled={query.trim().length < 2}
                onPress={() => {
                  setLookupBusy(true);
                  setNotice("");
                  setUsda([]);
                  void callService<{ drinks: Drink[] }>("/drink-catalog", {
                    query,
                  })
                    .then((result) => {
                      const drinks = result.drinks.filter(
                        (d) => !isAlcohol(d) || alcoholAllowed(settings),
                      );
                      setUsda(drinks);
                      if (!drinks.length)
                        setNotice(
                          "No USDA drinks with measured liquid servings found. Try a brand name or enter the label.",
                        );
                    })
                    .catch((e) => setNotice(e.message))
                    .finally(() => setLookupBusy(false));
                }}
              />
              {usda.map((drink) => (
                <Row
                  key={drink.id}
                  title={drink.name}
                  detail="USDA · review label before logging"
                  onPress={() => {
                    void saveDrink(drink)
                      .then(() =>
                        router.push({
                          pathname: "/drink",
                          params: { drink: drink.id },
                        }),
                      )
                      .catch(() =>
                        setNotice("Could not save this drink. Try again."),
                      );
                  }}
                />
              ))}
            </View>
          ) : null}
          {tab === "More" ? (
            <>
              <View style={{ flexDirection: "row", gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Button
                    secondary
                    title="Scan barcode"
                    onPress={() => router.push("/scan")}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Button
                    secondary
                    title="Custom drink"
                    onPress={() =>
                      router.push({
                        pathname: "/drink",
                        params: { custom: "1" },
                      })
                    }
                  />
                </View>
              </View>
              <Row
                title="Drink maker"
                detail="Goal or Lab"
                onPress={() => router.push("/drink-maker")}
              />
              <Row
                title="My drinks"
                detail="Saved drinks and recipes"
                onPress={() => router.push("/my-drinks")}
              />
            </>
          ) : null}
          {notice ? <T>{notice}</T> : null}
          {tab === "Drinks" ? (
            <>
              {containers.map((c) => (
                <Row
                  key={c.id}
                  title={c.name}
                  leading={<DrinkIcon type="my-bottle" size={28} />}
                  detail={formatVolume(c.ml, settings.units)}
                  onPress={
                    busy
                      ? undefined
                      : async () => {
                          setBusy(true);
                          try {
                            const drink = [...library, ...catalog].find(
                              (d) => d.id === c.drink_id,
                            );
                            if (!drink)
                              throw Error(
                                "This container needs its drink selected again.",
                              );
                            await saveEntry({
                              id: id(),
                              drink,
                              ml: c.ml,
                              at: new Date().toISOString(),
                            });
                            setNotice(`${c.name} logged.`);
                          } catch (e) {
                            setNotice((e as Error).message);
                          } finally {
                            setBusy(false);
                          }
                        }
                  }
                />
              ))}
              {library.length ? (
                <T size={13} muted>
                  Your saved drinks and everyday drinks
                </T>
              ) : null}
            </>
          ) : null}
        </View>
      }
      renderItem={({ item }) => (
        <View>
          <Row
            title={item.name}
            detail={item.source}
            leading={<DrinkIcon drink={item} size={30} />}
            onPress={
              busy
                ? undefined
                : async () => {
                    setBusy(true);
                    try {
                      await saveEntry({
                        id: id(),
                        drink: item,
                        ml: item.serving,
                        at: new Date().toISOString(),
                      });
                      setNotice(`${item.name} logged.`);
                    } catch (e) {
                      setNotice((e as Error).message);
                    } finally {
                      setBusy(false);
                    }
                  }
            }
          />
          <Button
            secondary
            title={`Edit ${item.name}`}
            onPress={() =>
              router.push({ pathname: "/drink", params: { drink: item.id } })
            }
          />
        </View>
      )}
      ListEmptyComponent={
        tab === "Drinks" ? (
          <View style={{ gap: 16, paddingTop: 24 }}>
            <T>No drinks match “{query}”.</T>
            <Button
              title="Create this drink"
              onPress={() =>
                router.push({
                  pathname: "/drink",
                  params: { custom: "1", name: query },
                })
              }
            />
          </View>
        ) : undefined
      }
    />
  );
}

export { ErrorBoundary } from "../components/route-error";

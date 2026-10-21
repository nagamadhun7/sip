import { alcoholAllowed, isAlcohol } from "../features/alcohol";
import { CompareDrinks } from "../components/compare-drinks";
import { DrinkIcon } from "../components/drink-icon";
import React, { useState } from "react";
import { View, FlatList } from "react-native";
import { router } from "expo-router";
import { useStore } from "../state/store";
import { id, formatVolume } from "../lib/model";
import { T, Input, Row, Button } from "../components/ui";
import { catalogDrinks } from "../lib/tracking";
import { LogInput } from "../components/log-input";
export default function Add() {
  const { library, catalog, containers, saveEntry, settings } = useStore(),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [query, setQuery] = useState("");
  const list = catalogDrinks(library, catalog).filter((d) =>
    (!isAlcohol(d)||alcoholAllowed(settings))&&d.name.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <FlatList
      keyboardShouldPersistTaps="handled"
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: 24, paddingBottom: 40 }}
      data={list}
      keyExtractor={(d) => d.id}
      ListHeaderComponent={
        <View style={{ gap: 20, marginBottom: 20 }}>
          <T size={28} bold>
            What did you drink?
          </T>
          <LogInput />
          <CompareDrinks />
          <Button secondary title="Photograph a drink" onPress={()=>router.push({pathname:"/scan",params:{recognize:"1"}})} />
          <Input
            label="Search drinks"
            value={query}
            onChangeText={setQuery}
            placeholder="Water, coffee, your recipes…"
          />
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
                  router.push({ pathname: "/drink", params: { custom: "1" } })
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
          {notice ? <T>{notice}</T> : null}
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
      }
    />
  );
}

export { ErrorBoundary } from "../components/route-error";

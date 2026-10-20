import React, { useState } from "react";
import { View, FlatList } from "react-native";
import { router } from "expo-router";
import { useStore } from "../state/store";
import { drinks } from "../data/drinks";
import { T, Input, Row, Button } from "../components/ui";
export default function Add() {
  const { library } = useStore(),
    [query, setQuery] = useState("");
  const list = [...library, ...drinks].filter((d) =>
    d.name.toLowerCase().includes(query.toLowerCase()),
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
          <Row title="Drink maker" detail="Goal or Lab" onPress={()=>router.push("/drink-maker")}/>
          <Row title="My drinks" detail="Saved drinks and recipes" onPress={()=>router.push("/my-drinks")}/>
          {library.length ? (
            <T size={13} muted>
              Your saved drinks and everyday drinks
            </T>
          ) : null}
        </View>
      }
      renderItem={({ item }) => (
        <Row
          title={item.name}
          detail={item.source}
          dot={item.color}
          onPress={() =>
            router.push({ pathname: "/drink", params: { drink: item.id } })
          }
        />
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

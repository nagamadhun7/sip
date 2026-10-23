import React, { useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { useStore } from "../state/store";
import { T, Input, Button, Row, ErrorText } from "./ui";
import { compareDrink, compareKeys } from "../features/comparison";
import { catalogDrinks } from "../lib/tracking";
export function CompareDrinks() {
  const store = useStore(),
    [open, setOpen] = useState(false),
    [side, setSide] = useState<0 | 1>(0),
    [query, setQuery] = useState(""),
    [amount, setAmount] = useState(["", ""]);
  const list = catalogDrinks(store.library, store.catalog),
    ids = store.settings.comparison ?? ["", ""];
  const picked = ids.map((id) => list.find((d) => d.id === id));
  const checked = picked.map((d, i) => {
    try {
      return {
        result: d
          ? compareDrink(
              d,
              Number(amount[i] || d.serving),
              store.entries,
              store.settings,
            )
          : null,
        error: "",
      };
    } catch (e) {
      return { result: null, error: (e as Error).message };
    }
  });
  const results = checked.map((r) => r.result),
    error = checked
      .map((r) => r.error)
      .filter(Boolean)
      .join(" ");
  return (
    <View style={{ gap: 12 }}>
      <Button
        secondary
        title={open ? "Close comparison" : "Compare two drinks"}
        onPress={() => setOpen(!open)}
      />
      {open ? (
        <>
          <T muted>Choose portions in ml. Comparing never logs a drink.</T>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
            {[0, 1].map((i) => (
              <Button
                key={i}
                secondary
                title={`${i === side ? "Choosing " : ""}${i === 0 ? "first" : "second"}: ${picked[i]?.name ?? "Choose drink"}`}
                onPress={() => setSide(i as 0 | 1)}
              />
            ))}
          </View>
          <Button
            secondary
            title={`Scan ${side === 0 ? "first" : "second"} drink`}
            onPress={() =>
              router.push({
                pathname: "/scan",
                params: { compare: String(side) },
              })
            }
          />
          <Input
            label="Find a drink to compare"
            value={query}
            onChangeText={setQuery}
          />
          {query ? (
            list
              .filter((d) => d.name.toLowerCase().includes(query.toLowerCase()))
              .map((d) => (
                <Row
                  key={d.id}
                  title={d.name}
                  onPress={() => {
                    const next = [...ids] as [string, string];
                    next[side] = d.id;
                    void store
                      .saveSettings({ ...store.settings, comparison: next })
                      .then(
                        () => {
                          setQuery("");
                          setSide(side === 0 ? 1 : 0);
                        },
                        (e) => setQuery((e as Error).message),
                      );
                  }}
                />
              ))
          ) : (
            <T size={12} muted>
              Search your local drinks or scan a barcode.
            </T>
          )}
          {picked.map((d, i) =>
            d ? (
              <Input
                key={i}
                numeric
                label={`${i === 0 ? "First" : "Second"} portion (ml)`}
                value={amount[i] || String(d.serving)}
                onChangeText={(value) =>
                  setAmount((a) => a.map((v, j) => (i === j ? value : v)))
                }
              />
            ) : null,
          )}
          {picked.every(Boolean) ? (
            <View style={{ gap: 10 }}>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
                {picked.map((d, i) => (
                  <View key={i} style={{ flex: 1, minWidth: 140, gap: 8 }}>
                    <T bold>{d!.name}</T>
                    {compareKeys.map((k) => (
                      <T key={k}>
                        {k}:{" "}
                        {!results[i]
                          ? "Enter a valid portion"
                          : results[i]?.values[k] === null
                            ? "not listed"
                            : `${+(results[i]?.values[k] ?? 0).toFixed(1)} ${k === "sugar" ? "g" : k === "calories" ? "kcal" : "mg"}`}
                      </T>
                    ))}
                  </View>
                ))}
              </View>
              {results.map((r, i) => (
                <T key={i} size={13}>
                  {r?.sentence}
                </T>
              ))}
            </View>
          ) : (
            <T>Choose two drinks to see the comparison.</T>
          )}
          <ErrorText error={error} />
        </>
      ) : null}
    </View>
  );
}

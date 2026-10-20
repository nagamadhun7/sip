import React, { createContext, use, useEffect, useState } from "react";
import { ActivityIndicator, Text, View, Pressable } from "react-native";
import { Drink, Entry, Settings, defaults } from "../lib/model";
import * as storage from "../lib/database";
type State = Awaited<ReturnType<typeof storage.load>>;
type Store = State & {
  saveEntry: (e: Entry) => Promise<void>;
  saveEntries: (entries: Entry[]) => Promise<void>;
  removeEntry: (id: string) => Promise<void>;
  saveDrink: (d: Drink) => Promise<void>;
  saveSettings: (s: Settings) => Promise<void>;
  erase: () => Promise<void>;
  saveContainer: (c: import("../lib/tracking").Container) => Promise<void>;
  undo: () => Promise<void>;
};
const Context = createContext<Store | null>(null);
export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State>({
      entries: [],
      catalog: [],
      containers: [],
      undoLabel: "",
      library: [],
      settings: defaults,
    }),
    [ready, setReady] = useState(false),
    [error, setError] = useState("");
  const hydrate = async () => {
    try {
      const loaded = await storage.load();
      setState(loaded);
      setReady(true);
    } catch {
      setError(
        "Could not open your drink database. Your records have not been changed.",
      );
    }
  };
  useEffect(() => {
    let active = true;
    void storage.load().then(
      (loaded) => {
        if (active) {
          setState(loaded);
          setReady(true);
        }
      },
      () => {
        if (active)
          setError(
            "Could not open your drink database. Your records have not been changed.",
          );
      },
    );
    return () => {
      active = false;
    };
  }, []);
  const value: Store = {
    ...state,
    saveEntries: async (entries) => {
      await storage.putEntries(entries);
      await hydrate();
    },
    saveEntry: async (e) => {
      await storage.putEntry(e);
      await hydrate();
    },
    removeEntry: async (key) => {
      await storage.deleteEntry(key);
      await hydrate();
    },
    saveDrink: async (d) => {
      await storage.putDrink(d);
      await hydrate();
    },
    saveSettings: async (settings) => {
      await storage.putSettings(settings);
      await hydrate();
    },
    saveContainer: async (c) => {
      await storage.putContainer(c);
      await hydrate();
    },
    undo: async () => {
      await storage.undoLastChange();
      await hydrate();
    },
    erase: async () => {
      await storage.erase();
      await hydrate();
    },
  };
  if (!ready)
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          padding: 32,
          gap: 20,
        }}
      >
        {error ? (
          <>
            <Text>{error}</Text>
            <Pressable
              onPress={() => {
                setError("");
                void hydrate();
              }}
            >
              <Text>Try again</Text>
            </Pressable>
          </>
        ) : (
          <ActivityIndicator accessibilityLabel="Loading your drinks" />
        )}
      </View>
    );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useStore() {
  const s = use(Context);
  if (!s) throw Error("Store missing");
  return s;
}

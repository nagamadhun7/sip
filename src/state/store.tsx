import React, { createContext, use, useEffect, useState } from "react";
import { ActivityIndicator, Text, View, Pressable } from "react-native";
import { Drink, Entry, Settings, defaults } from "../lib/model";
import * as storage from "../lib/database";
type State = { entries: Entry[]; library: Drink[]; settings: Settings };
type Store = State & {
  saveEntry: (e: Entry) => Promise<void>;
  saveEntries: (entries: Entry[]) => Promise<void>;
  removeEntry: (id: string) => Promise<void>;
  saveDrink: (d: Drink) => Promise<void>;
  saveSettings: (s: Settings) => Promise<void>;
  erase: () => Promise<void>;
};
const Context = createContext<Store | null>(null);
export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State>({
      entries: [],
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
      setState((s) => ({
        ...s,
        entries: [...entries, ...s.entries].sort((a, b) =>
          b.at.localeCompare(a.at),
        ),
      }));
    },
    saveEntry: async (e) => {
      await storage.putEntry(e);
      setState((s) => ({
        ...s,
        entries: [e, ...s.entries.filter((v) => v.id !== e.id)].sort((a, b) =>
          b.at.localeCompare(a.at),
        ),
      }));
    },
    removeEntry: async (id) => {
      await storage.deleteEntry(id);
      setState((s) => ({
        ...s,
        entries: s.entries.filter((e) => e.id !== id),
      }));
    },
    saveDrink: async (d) => {
      await storage.putDrink(d);
      setState((s) => ({
        ...s,
        library: [d, ...s.library.filter((v) => v.id !== d.id)],
      }));
    },
    saveSettings: async (settings) => {
      await storage.putSettings(settings);
      setState((s) => ({ ...s, settings }));
    },
    erase: async () => {
      await storage.erase();
      setState({ entries: [], library: [], settings: defaults });
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

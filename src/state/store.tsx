import { AccessiblePressable as Pressable } from "../components/accessible-pressable";
import { setLocale } from "../features/locale";
import { requireAlcoholAccess } from "../features/alcohol";
import React, {
  createContext,
  use,
  useEffect,
  useState,
  useCallback,
} from "react";
import {
  ActivityIndicator,
  Text,
  View,
  
  AppState,
} from "react-native";
import { Drink, Entry, Settings, defaults } from "../lib/model";
import * as storage from "../lib/database";
import { setReminders } from "../lib/reminders";
import * as Notifications from "expo-notifications";
import {
  syncHealth,
  authorizeHealth,
  setHealthEnabled,
  stopHealth,
} from "../health/service";
type State = Awaited<ReturnType<typeof storage.load>>;
type Store = State & {
  saveEntry: (e: Entry) => Promise<void>;
  saveEntries: (entries: Entry[]) => Promise<void>;
  saveJournalEntries: (entries: Entry[]) => Promise<void>;
  removeEntry: (id: string) => Promise<void>;
  saveDrink: (d: Drink) => Promise<void>;
  saveSettings: (s: Settings) => Promise<void>;
  erase: () => Promise<void>;
  saveContainer: (c: import("../lib/tracking").Container) => Promise<void>;
  undo: () => Promise<void>;
  serviceError: string;
  reload: () => Promise<void>;
  connectHealth: () => Promise<void>;
  syncHealth: () => Promise<void>;
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
  const hydrate = useCallback(async () => {
    try {
      const loaded = await storage.load();
      setLocale(loaded.settings.locale??"en-US");
      setState(loaded);
      setError("");
      setReady(true);
    } catch {
      setError(
        "Could not open your drink database. Your records have not been changed.",
      );
    }
  }, []);
  useEffect(() => {
    let active = true;
    void storage.load().then(
      (loaded) => {
        if (active) {
          setLocale(loaded.settings.locale??"en-US");
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
  const entriesKey = JSON.stringify(state.entries);
  const reminderKey = JSON.stringify([
    state.entries,
    state.settings.reminders,
    state.settings.reminderPreferences,
    state.settings.reminderHours,
    state.settings.situation,
    state.settings.bedtime,
    state.settings.water,
  ]);
  useEffect(() => {
    if (!ready) return;
    void storage
      .load()
      .then((latest) => setReminders(latest.settings, latest.entries, false))
      .catch((e) => setError((e as Error).message));
  }, [ready, reminderKey]);
  useEffect(() => {
    if (!ready || !state.settings.healthSync) return;
    void syncHealth().then(hydrate, () => hydrate());
  }, [ready, entriesKey, state.settings.healthSync, hydrate]);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (status) => {
      if (status === "active") {
        void syncHealth().then(hydrate, hydrate);
        void storage
          .load()
          .then((latest) =>
            setReminders(latest.settings, latest.entries, false),
          )
          .catch((e) => setError((e as Error).message));
      }
    });
    return () => sub.remove();
  }, [hydrate]);
  const value: Store = {
    ...state,
    serviceError: error,
    reload: hydrate,
    saveEntries: async (entries) => {
      requireAlcoholAccess(entries,state.settings);
      await storage.putEntries(entries);
      await hydrate();
    },
    saveJournalEntries: async (entries) => {
      requireAlcoholAccess(entries,state.settings);
      await storage.putJournalEntries(entries);
      await hydrate();
    },
    saveEntry: async (e) => {
      requireAlcoholAccess([e],state.settings);
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
      if (settings.healthSync === false) setHealthEnabled(false);
      await storage.putSettings(settings);
      await hydrate();
    },
    connectHealth: async () => {
      await authorizeHealth();
      const latest = await storage.load();
      await storage.putSettings({ ...latest.settings, healthSync: true });
      try {
        await syncHealth();
      } finally {
        await hydrate();
      }
    },
    syncHealth: async () => {
      try {
        await syncHealth();
      } finally {
        await hydrate();
      }
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
      await stopHealth();
      await setReminders({ ...state.settings, reminders: false }, [], false);
      Notifications.clearLastNotificationResponse();
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

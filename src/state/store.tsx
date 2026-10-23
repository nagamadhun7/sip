import {
  configureWeatherService,
  fetchWeather,
  automaticBlocked,
} from "../features/hydration-adjustments";
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
import { ActivityIndicator, Text, View, AppState } from "react-native";
import { Drink, Entry, Settings, defaults, localDay } from "../lib/model";
import * as storage from "../lib/database";
import { setReminders } from "../lib/reminders";
import * as Notifications from "expo-notifications";
import {
  syncHealth,
  authorizeHealth,
  setHealthEnabled,
  stopHealth,
} from "../health/service";
import { callService } from "../drink-maker/client";
if (!__DEV__) configureWeatherService((body) => callService("/weather", body));
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
      setLocale(loaded.settings.locale ?? "en-US");
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
          setLocale(loaded.settings.locale ?? "en-US");
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
  const refreshWeather = useCallback(async () => {
    const { settings } = await storage.load();
    const a = settings.hydrationAdjustments;
    if (!a?.enabled || !a.city || automaticBlocked(settings)) return;
    if (
      a.weather?.city === a.city.name &&
      a.weather.day === localDay() &&
      Date.now() - Date.parse(a.weather.fetched_at) < 3600000
    )
      return;
    try {
      const weather = await fetchWeather(a);
      const latest = await storage.load();
      if (
        latest.settings.hydrationAdjustments?.city?.name !== a.city.name ||
        !latest.settings.hydrationAdjustments.enabled
      )
        return;
      await storage.putSettings({
        ...latest.settings,
        hydrationAdjustments: {
          ...latest.settings.hydrationAdjustments,
          weather,
          weather_error: undefined,
        },
      });
    } catch {
      const latest = await storage.load();
      if (latest.settings.hydrationAdjustments?.city?.name !== a.city.name)
        return;
      await storage.putSettings({
        ...latest.settings,
        hydrationAdjustments: {
          ...latest.settings.hydrationAdjustments!,
          weather_error:
            "Weather could not refresh. No previous-day forecast is used. Retry in Hot weather and exercise.",
        },
      });
    }
    await hydrate();
  }, [hydrate]);
  const weatherKey = JSON.stringify([
    state.settings.hydrationAdjustments?.enabled,
    state.settings.hydrationAdjustments?.city,
    state.settings.trackingHelper,
    state.settings.profile?.status,
  ]);
  useEffect(() => {
    if (!ready) return;
    void Promise.resolve()
      .then(refreshWeather)
      .catch(() => {});
    const timer = setInterval(
      () => void refreshWeather().catch(() => {}),
      3600000,
    );
    return () => clearInterval(timer);
  }, [ready, weatherKey, refreshWeather]);
  const entriesKey = JSON.stringify(state.entries);
  const reminderKey = JSON.stringify([
    state.entries,
    state.settings.reminders,
    state.settings.reminderPreferences,
    state.settings.reminderHours,
    state.settings.situation,
    state.settings.hydrationAdjustments,
    state.settings.trackingHelper,
    state.settings.profile?.status,
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
        void refreshWeather().catch(() => {});
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
  }, [hydrate, refreshWeather]);
  const value: Store = {
    ...state,
    serviceError: error,
    reload: hydrate,
    saveEntries: async (entries) => {
      requireAlcoholAccess(entries, state.settings);
      await storage.putEntries(entries);
      await hydrate();
    },
    saveJournalEntries: async (entries) => {
      requireAlcoholAccess(entries, state.settings);
      await storage.putJournalEntries(entries);
      await hydrate();
    },
    saveEntry: async (e) => {
      requireAlcoholAccess([e], state.settings);
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

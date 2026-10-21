import * as storage from "../lib/database";
import { nativeHealth } from "./native";
import { reconcileHealth } from "./sync";
let queue: Promise<unknown> = Promise.resolve();
let enabled = true;
export const setHealthEnabled = (value: boolean) => {
  enabled = value;
};
export async function stopHealth() {
  enabled = false;
  await queue.catch(() => {});
}
export async function authorizeHealth() {
  await nativeHealth(true);
}
export function syncHealth() {
  const task = queue
    .catch(() => {})
    .then(async () => {
      const state = await storage.load();
      if (!state.settings.healthSync) return;
      enabled = true;
      try {
        const adapter = await nativeHealth();
        const check = () => {
          if (!enabled) throw Error("Health sync was disconnected.");
        };
        await reconcileHealth(
          state.entries,
          await storage.healthLinks(),
          {
            ...adapter,
            write: async (entry) => {
              check();
              return adapter.write(entry);
            },
            remove: async (key, ids) => {
              check();
              return adapter.remove(key, ids);
            },
            read: async () => {
              check();
              return adapter.read();
            },
          },
          storage.saveHealthLink,
          storage.removeHealthLink,
          storage.importHealthEntry,
        );
        const latest = await storage.load();
        await storage.putSettings({
          ...latest.settings,
          healthLastSync: new Date().toISOString(),
          healthLastError: "",
        });
      } catch (e) {
        const latest = await storage.load();
        await storage.putSettings({
          ...latest.settings,
          healthLastError: (e as Error).message,
        });
        throw e;
      }
    });
  queue = task;
  return task;
}

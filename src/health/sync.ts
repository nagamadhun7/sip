import type { Entry } from "../lib/model.ts";
export type Link = { signature: string; ids: string[]; origin: string };
export type RemoteWater = {
  id: string;
  ml: number;
  at: string;
  source: string;
};
export interface HealthAdapter {
  platform: "ios" | "android";
  write: (entry: Entry) => Promise<string[]>;
  remove: (entryId: string, ids: string[]) => Promise<void>;
  read: () => Promise<RemoteWater[]>;
}
export const healthSignature = (e: Entry) =>
  JSON.stringify([
    e.at,
    e.ml,
    e.drink.nutrition,
    e.drink.missingNutrition ?? [],
  ]);
export async function reconcileHealth(
  entries: Entry[],
  links: Map<string, Link>,
  adapter: HealthAdapter,
  save: (id: string, value: Link) => Promise<void>,
  remove: (id: string) => Promise<void>,
  importEntry: (e: Entry) => Promise<void>,
) {
  const ids = new Set(entries.map((e) => e.id));
  for (const [key, link] of links)
    if (link.origin === "local" && !ids.has(key)) {
      await adapter.remove(key, link.ids);
      await remove(key);
    }
  for (const entry of entries) {
    if (entry.health) continue;
    const signature = healthSignature(entry),
      old = links.get(entry.id);
    if (old?.signature === signature) continue;
    await save(entry.id, {
      signature: "pending:" + signature,
      ids: old?.ids ?? [],
      origin: "local",
    });
    await adapter.remove(entry.id, old?.ids ?? []);
    const written = await adapter.write(entry);
    await save(entry.id, { signature, ids: written, origin: "local" });
  }
  for (const water of await adapter.read()) {
    if (
      !Number.isFinite(water.ml) ||
      water.ml <= 0 ||
      water.ml > 10000 ||
      !Number.isFinite(Date.parse(water.at)) ||
      Date.parse(water.at) > Date.now() + 60000
    )
      continue;
    const key = `health:${adapter.platform}:${water.id}`,
      signature = JSON.stringify([water.at, water.ml]);
    const old = links.get(key);
    if (old && (old.signature === signature || !ids.has(key))) continue;
    const entry: Entry = {
      id: key,
      health: { platform: adapter.platform, id: water.id },
      at: water.at,
      ml: water.ml,
      drink: {
        id: key,
        name: water.source,
        serving: water.ml,
        color: "#6FAEE8",
        source: water.source + " · hydration record; nutrition not listed",
        nutrition: {
          sugar: null,
          caffeine: null,
          calories: null,
          sodium: null,
          potassium: null,
        },
      },
    };
    await importEntry(entry);
    await save(key, { signature, ids: [water.id], origin: "external" });
  }
}

import { defaultReminderPreferences } from "./reminder-plan";
import * as SQLite from "expo-sqlite";
import { Drink, Entry, Settings, defaults, validateEntry } from "./model";
import { drinks as seeds } from "../data/drinks";
import ingredientData from "../data/ingredients.json";
import { ingredients as liveIngredients } from "../drink-maker/core";
import type { Container } from "./tracking";
let promise: Promise<SQLite.SQLiteDatabase> | undefined;
export function db() {
  return (promise ??= (async () => {
    const d = await SQLite.openDatabaseAsync("sip-v1.db");
    await d.execAsync(`PRAGMA journal_mode=WAL;
CREATE TABLE IF NOT EXISTS records(id TEXT PRIMARY KEY NOT NULL,at TEXT NOT NULL,payload TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS records_at ON records(at);
CREATE TABLE IF NOT EXISTS library(id TEXT PRIMARY KEY NOT NULL,payload TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS preferences(id INTEGER PRIMARY KEY CHECK(id=1),payload TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS catalog(id TEXT PRIMARY KEY NOT NULL,payload TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS notification_ledger(id TEXT PRIMARY KEY NOT NULL,at INTEGER NOT NULL,payload TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS action_receipts(id TEXT PRIMARY KEY NOT NULL);
CREATE TABLE IF NOT EXISTS health_links(id TEXT PRIMARY KEY NOT NULL,payload TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS health_pending(id TEXT PRIMARY KEY NOT NULL);
CREATE TABLE IF NOT EXISTS ingredients(id TEXT PRIMARY KEY NOT NULL,payload TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS containers(id TEXT PRIMARY KEY NOT NULL,payload TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS undo_change(id INTEGER PRIMARY KEY CHECK(id=1),payload TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS profile(id INTEGER PRIMARY KEY CHECK(id=1),payload TEXT NOT NULL);
PRAGMA user_version=2;`);
    await d.withExclusiveTransactionAsync(async (tx) => {
      for (const ingredient of ingredientData.ingredients)
        await tx.runAsync(
          "INSERT OR IGNORE INTO ingredients(id,payload) VALUES(?,?)",
          ingredient.id,
          JSON.stringify(ingredient),
        );
      for (const drink of seeds)
        await tx.runAsync(
          "INSERT OR IGNORE INTO catalog(id,payload) VALUES(?,?)",
          drink.id,
          JSON.stringify(drink),
        );
      await tx.runAsync(
        "INSERT OR IGNORE INTO preferences(id,payload) VALUES(1,?)",
        JSON.stringify({
          ...defaults,
          reminderPreferences: defaultReminderPreferences,
        }),
      );
    });
    return d;
  })().catch((e) => {
    promise = undefined;
    throw e;
  }));
}
type Undo = { before: Entry[]; ids: string[]; label: string };
export async function load() {
  const d = await db();
  const [rows, library, catalog, containers, pref, undo, profile] =
    await Promise.all([
      d.getAllAsync<{ payload: string }>(
        "SELECT payload FROM records ORDER BY at DESC",
      ),
      d.getAllAsync<{ payload: string }>("SELECT payload FROM library"),
      d.getAllAsync<{ payload: string }>("SELECT payload FROM catalog"),
      d.getAllAsync<{ payload: string }>("SELECT payload FROM containers"),
      d.getFirstAsync<{ payload: string }>(
        "SELECT payload FROM preferences WHERE id=1",
      ),
      d.getFirstAsync<{ payload: string }>(
        "SELECT payload FROM undo_change WHERE id=1",
      ),
      d.getFirstAsync<{ payload: string }>(
        "SELECT payload FROM profile WHERE id=1",
      ),
    ]);
  const savedIngredients = await d.getAllAsync<{ payload: string }>(
    "SELECT payload FROM ingredients",
  );
  liveIngredients.splice(
    0,
    liveIngredients.length,
    ...savedIngredients.map((r) => JSON.parse(r.payload)),
  );
  const settings = {
    ...defaults,
    reminderPreferences: defaultReminderPreferences,
    ...(pref ? JSON.parse(pref.payload) : {}),
    ...(profile ? { profile: JSON.parse(profile.payload) } : {}),
  } as Settings;
  if (!pref || !JSON.parse(pref.payload).reminderPreferences)
    await d.runAsync(
      "INSERT OR REPLACE INTO preferences(id,payload) VALUES(1,?)",
      JSON.stringify(settings),
    );
  return {
    entries: rows.map((r) => JSON.parse(r.payload) as Entry),
    library: library.map((r) => JSON.parse(r.payload) as Drink),
    catalog: catalog.map((r) => JSON.parse(r.payload) as Drink),
    containers: containers.map((r) => JSON.parse(r.payload) as Container),
    settings,
    undoLabel: undo ? (JSON.parse(undo.payload) as Undo).label : "",
  };
}
export async function changeEntries(entries: Entry[], remove: string[] = []) {
  entries.forEach(validateEntry);
  const d = await db();
  await d.withExclusiveTransactionAsync(async (tx) => {
    const ids = [...new Set([...entries.map((e) => e.id), ...remove])],
      before: Entry[] = [];
    for (const key of ids) {
      const row = await tx.getFirstAsync<{ payload: string }>(
        "SELECT payload FROM records WHERE id=?",
        key,
      );
      if (row) before.push(JSON.parse(row.payload));
    }
    await tx.runAsync(
      "INSERT OR REPLACE INTO undo_change(id,payload) VALUES(1,?)",
      JSON.stringify({
        before,
        ids,
        label: remove.length
          ? "Entry deleted"
          : before.length
            ? "Entry edited"
            : "Drinks added",
      } satisfies Undo),
    );
    for (const key of remove)
      await tx.runAsync("DELETE FROM records WHERE id=?", key);
    for (const e of entries)
      await tx.runAsync(
        "INSERT OR REPLACE INTO records(id,at,payload) VALUES(?,?,?)",
        e.id,
        e.at,
        JSON.stringify(e),
      );
  });
}
export const putEntry = (e: Entry) => changeEntries([e]);
export const putEntries = (e: Entry[]) => changeEntries(e);
export const deleteEntry = (id: string) => changeEntries([], [id]);
export async function undoLastChange() {
  const d = await db();
  await d.withExclusiveTransactionAsync(async (tx) => {
    const row = await tx.getFirstAsync<{ payload: string }>(
      "SELECT payload FROM undo_change WHERE id=1",
    );
    if (!row) return;
    const undo = JSON.parse(row.payload) as Undo;
    for (const key of undo.ids)
      await tx.runAsync("DELETE FROM records WHERE id=?", key);
    for (const e of undo.before)
      await tx.runAsync(
        "INSERT INTO records(id,at,payload) VALUES(?,?,?)",
        e.id,
        e.at,
        JSON.stringify(e),
      );
    await tx.runAsync("DELETE FROM undo_change");
  });
}
export async function putDrink(d: Drink) {
  await (
    await db()
  ).runAsync(
    "INSERT OR REPLACE INTO library(id,payload) VALUES(?,?)",
    d.id,
    JSON.stringify(d),
  );
}
export async function putContainer(c: Container) {
  if (!c.name.trim() || !Number.isFinite(c.ml) || c.ml <= 0 || c.ml > 10000)
    throw Error("Name the container and enter a valid amount.");
  await (
    await db()
  ).runAsync(
    "INSERT OR REPLACE INTO containers(id,payload) VALUES(?,?)",
    c.id,
    JSON.stringify(c),
  );
}
export async function putSettings(s: Settings) {
  const d = await db();
  await d.withExclusiveTransactionAsync(async (tx) => {
    await tx.runAsync(
      "INSERT OR REPLACE INTO preferences(id,payload) VALUES(1,?)",
      JSON.stringify(s),
    );
    if (s.profile)
      await tx.runAsync(
        "INSERT OR REPLACE INTO profile(id,payload) VALUES(1,?)",
        JSON.stringify(s.profile),
      );
  });
}
export async function erase() {
  const d = await db();
  await d.withExclusiveTransactionAsync(async (tx) => {
    for (const table of [
      "records",
      "library",
      "preferences",
      "containers",
      "profile",
      "undo_change",
      "notification_ledger",
      "action_receipts",
      "health_links",
      "health_pending",
    ])
      await tx.runAsync(`DELETE FROM ${table}`);
    await tx.runAsync(
      "INSERT INTO preferences(id,payload) VALUES(1,?)",
      JSON.stringify({
        ...defaults,
        reminderPreferences: defaultReminderPreferences,
      }),
    );
  });
}

export async function notificationLedger() {
  return (await db()).getAllAsync<{ id: string; at: number; payload: string }>(
    "SELECT * FROM notification_ledger",
  );
}
export async function rememberNotifications(
  items: import("./reminder-plan").Reminder[],
) {
  const d = await db();
  await d.withExclusiveTransactionAsync(async (tx) => {
    await tx.runAsync("DELETE FROM notification_ledger WHERE at>?", Date.now());
    for (const r of items)
      await tx.runAsync(
        "INSERT OR REPLACE INTO notification_ledger(id,at,payload) VALUES(?,?,?)",
        r.id,
        r.at,
        JSON.stringify(r),
      );
    await tx.runAsync(
      "DELETE FROM notification_ledger WHERE at<?",
      Date.now() - 7 * 86400000,
    );
  });
}
export async function actionHandled(key: string) {
  return !!(await (
    await db()
  ).getFirstAsync("SELECT id FROM action_receipts WHERE id=?", key));
}
export async function markActionHandled(key: string) {
  await (
    await db()
  ).runAsync("INSERT OR IGNORE INTO action_receipts(id) VALUES(?)", key);
}
export async function healthLinks() {
  const rows = await (
    await db()
  ).getAllAsync<{ id: string; payload: string }>(
    "SELECT id,payload FROM health_links",
  );
  return new Map(
    rows.map((r) => [
      r.id,
      JSON.parse(r.payload) as {
        signature: string;
        ids: string[];
        origin: string;
      },
    ]),
  );
}
export async function saveHealthLink(
  id: string,
  value: { signature: string; ids: string[]; origin: string },
) {
  await (
    await db()
  ).runAsync(
    "INSERT OR REPLACE INTO health_links(id,payload) VALUES(?,?)",
    id,
    JSON.stringify(value),
  );
}
export async function removeHealthLink(id: string) {
  await (await db()).runAsync("DELETE FROM health_links WHERE id=?", id);
}

export async function importHealthEntry(e: Entry) {
  validateEntry(e);
  await (
    await db()
  ).runAsync(
    "INSERT OR REPLACE INTO records(id,at,payload) VALUES(?,?,?)",
    e.id,
    e.at,
    JSON.stringify(e),
  );
}

import * as SQLite from "expo-sqlite";
import { Drink, Entry, Settings, defaults, validateEntry } from "./model";
let promise: Promise<SQLite.SQLiteDatabase> | undefined;
export function db() {
  return (promise ??= (async () => {
    const d = await SQLite.openDatabaseAsync("sip-v1.db");
    await d.execAsync(
      `PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS records(id TEXT PRIMARY KEY NOT NULL, at TEXT NOT NULL, payload TEXT NOT NULL); CREATE INDEX IF NOT EXISTS records_at ON records(at); CREATE TABLE IF NOT EXISTS library(id TEXT PRIMARY KEY NOT NULL,payload TEXT NOT NULL); CREATE TABLE IF NOT EXISTS preferences(id INTEGER PRIMARY KEY CHECK(id=1),payload TEXT NOT NULL); PRAGMA user_version=1;`,
    );
    return d;
  })().catch((error)=>{promise=undefined;throw error}));
}
export async function load() {
  const d = await db();
  const [rows, library, pref] = await Promise.all([
    d.getAllAsync<{ payload: string }>(
      "SELECT payload FROM records ORDER BY at DESC",
    ),
    d.getAllAsync<{ payload: string }>("SELECT payload FROM library"),
    d.getFirstAsync<{ payload: string }>(
      "SELECT payload FROM preferences WHERE id=1",
    ),
  ]);
  return {
    entries: rows.map((r) => JSON.parse(r.payload) as Entry),
    library: library.map((r) => JSON.parse(r.payload) as Drink),
    settings: {
      ...defaults,
      ...(pref ? JSON.parse(pref.payload) : {}),
    } as Settings,
  };
}
export async function putEntry(e: Entry) {
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
export async function deleteEntry(id: string) {
  await (await db()).runAsync("DELETE FROM records WHERE id=?", id);
}
export async function putDrink(drink: Drink) {
  await (
    await db()
  ).runAsync(
    "INSERT OR REPLACE INTO library(id,payload) VALUES(?,?)",
    drink.id,
    JSON.stringify(drink),
  );
}
export async function putSettings(s: Settings) {
  await (
    await db()
  ).runAsync(
    "INSERT OR REPLACE INTO preferences(id,payload) VALUES(1,?)",
    JSON.stringify(s),
  );
}
export async function erase() {
  const d = await db();
  await d.withExclusiveTransactionAsync(async (transaction) => {
    await transaction.runAsync("DELETE FROM records");
    await transaction.runAsync("DELETE FROM library");
    await transaction.runAsync("DELETE FROM preferences");
  });
}

export async function putEntries(entries: Entry[]) {
  entries.forEach(validateEntry);
  const d = await db();
  await d.withExclusiveTransactionAsync(async (transaction) => {
    for (const e of entries)
      await transaction.runAsync(
        "INSERT OR REPLACE INTO records(id,at,payload) VALUES(?,?,?)",
        e.id,
        e.at,
        JSON.stringify(e),
      );
  });
}

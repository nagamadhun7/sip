import { z } from "zod";
import type { Drink, Entry } from "../lib/model.ts";
import type { Container } from "../lib/tracking.ts";
export type ParsedLog = { drink_id: string; amount_ml: number; at: string };
export const logSchema = z
  .object({
    drinks: z
      .array(
        z
          .object({
            drink_id: z.string().max(150),
            amount_ml: z.number().finite().positive().max(10000),
            at: z.string().datetime({ offset: true }),
          })
          .strict(),
      )
      .max(20),
    message: z.string().max(160),
  })
  .strict();
export const parseInputSchema = z
  .object({
    text: z.string().trim().min(2).max(1000),
    now: z.string().datetime({ offset: true }),
    timezone_offset: z.number().int().min(-840).max(840),
    catalog: z
      .array(
        z
          .object({
            id: z.string().max(150),
            name: z.string().max(150),
            serving: z.number().finite().nonnegative().max(10000),
          })
          .strict(),
      )
      .min(1)
      .max(200),
  })
  .strict();
export type ParseInput = z.infer<typeof parseInputSchema>;
function timeFromText(text: string, now: Date) {
  const at = new Date(now);
  if (/\byesterday\b/i.test(text)) at.setDate(at.getDate() - 1);
  const clock = text.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i);
  if (clock) {
    let h = Number(clock[1]);
    const m = Number(clock[2] ?? 0);
    if (m > 59 || h > 23 || (clock[3] && h > 12))
      throw Error("Check the drink time.");
    if (clock[3]) h = (h % 12) + (clock[3].toLowerCase() === "pm" ? 12 : 0);
    at.setHours(h, m, 0, 0);
  }
  if (at.getTime() > now.getTime() + 60000)
    throw Error(
      "The drink time is in the future. Edit the time before logging.",
    );
  return at.toISOString();
}
function boundary(text: string, name: string) {
  return new RegExp(
    "(?:^|[^a-z])" +
      name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") +
      "(?:$|[^a-z])",
    "i",
  ).test(text);
}
export function parseLocal(
  text: string,
  catalog: Drink[],
  containers: Container[] = [],
  now = new Date(),
): ParsedLog[] | null {
  if (
    /\b(pizza|meal|medicine|supplement|extract|powder|pill|ignore|instructions|system|detox|blood pressure)\b/i.test(
      text,
    )
  )
    return null;
  const clauses = text
    .toLowerCase()
    .replace(/\b(one|a|an)\b/g, "1")
    .replace(/\btwo\b/g, "2")
    .split(/\s*(?:\r?\n|,|;|\band\b|\bthen\b)\s*/)
    .filter(Boolean);
  if (!clauses.length || clauses.length > 20) return null;
  const result: ParsedLog[] = [];
  for (const clause of clauses) {
    const container = containers.find((c) => boundary(clause, c.name));
    const candidates = catalog
      .filter(
        (d) =>
          boundary(clause, d.name) ||
          (d.id === "water" && boundary(clause, "water")) ||
          (d.id === "coffee" && boundary(clause, "coffee")),
      )
      .sort((a, b) => b.name.length - a.name.length);
    const d = container
      ? catalog.find((d) => d.id === container.drink_id)
      : candidates[0];
    if (!d) return null;
    const clean = clause
      .replace(/\bat\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?\b/gi, "")
      .replace(
        /\b(today|yesterday|just|now|had|drank|i|logged|please|log)\b/g,
        "",
      )
      .replace(
        /\d+(?:\.\d+)?\s*(?:ml|milliliters?|millilitres?|l|liters?|litres?|fl\s*oz|oz|ounces?|cups?|shots?|bottles?|glasses?|cans?)?\b/g,
        "",
      )
      .replace(
        new RegExp(d.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "ig"),
        "",
      )
      .replace(
        container
          ? new RegExp(
              container.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
              "ig",
            )
          : /^$/,
        "",
      )
      .replace(/\b(water|coffee|of)\b/g, "")
      .trim();
    if (clean) return null;
    const portionText = clause.replace(
      /\bat\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?\b/gi,
      "",
    );
    const amount = portionText.match(
      /(\d+(?:\.\d+)?)\s*(ml|milliliters?|millilitres?|l|liters?|litres?|fl\s*oz|oz|ounces?)\b/,
    );
    const count = portionText.match(
      /(?:^|\s)(\d+(?:\.\d+)?)\s*(cups?|shots?|bottles?|glasses?|cans?)?\b/,
    );
    const ml = amount
      ? Number(amount[1]) *
        (/^(l|liter|litre)/.test(amount[2])
          ? 1000
          : /oz|ounce/.test(amount[2])
            ? 29.5735295625
            : 1)
      : (container?.ml ?? d.serving) * (count ? Number(count[1]) : 1);
    if (!Number.isFinite(ml) || ml <= 0 || ml > 10000) return null;
    result.push({
      drink_id: d.id,
      amount_ml: ml,
      at: timeFromText(clause, now),
    });
  }
  return result;
}
export function validateParsed(
  value: unknown,
  catalog: Pick<Drink, "id">[],
  now = new Date(),
): ParsedLog[] {
  const data = logSchema.parse(value);
  const ids = new Set(catalog.map((d) => d.id));
  return data.drinks
    .filter((p) => ids.has(p.drink_id))
    .map((p) => {
      const time = Date.parse(p.at);
      if (time > now.getTime() + 60000 || time < now.getTime() - 31 * 86400000)
        throw Error("Check the parsed drink time before logging.");
      return p;
    });
}
export function entriesFromParsed(
  parsed: ParsedLog[],
  catalog: Drink[],
  newId: () => string,
): Entry[] {
  return parsed.map((p) => {
    const drink = catalog.find((d) => d.id === p.drink_id);
    if (!drink) throw Error("This drink is no longer in your database.");
    return {
      id: newId(),
      drink: structuredClone(drink),
      ml: p.amount_ml,
      at: p.at,
    };
  });
}

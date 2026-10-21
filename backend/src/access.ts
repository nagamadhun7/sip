import { json } from "./service.ts";
import type { Dependencies, Usage } from "./service.ts";
export async function accessStatus(deps: Omit<Dependencies, "generate">) {
  let pro = false;
  try {
    pro = await deps.isPro();
  } catch {
    return json({ message: "Could not verify your subscription. Retry." }, 503);
  }
  const day = deps.now().toISOString().slice(0, 10),
    month = day.slice(0, 7),
    usage = await deps.store.get<Usage>("usage");
  return json({
    pro,
    daily_used: usage?.day === day ? usage.daily : 0,
    daily_limit: pro ? (deps.proDaily ?? 10) : (deps.freeDaily ?? 3),
    monthly_used: usage?.month === month ? usage.monthly : 0,
    monthly_limit: pro ? null : (deps.freeMonthly ?? 3),
  });
}

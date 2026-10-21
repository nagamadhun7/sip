import { accessStatus } from "./access";
import { handleParse, generateParsing } from "./parsing";
import type { Dependencies } from "./service";
import { DurableObject } from "cloudflare:workers";
import type { CacheValue } from "./service";
import { handleMaker, generateOpenAI, json } from "./service";
import { foodLookup } from "./lookup";
interface Env {
  FDC_API_KEY?: string;
  MAKER_USERS: DurableObjectNamespace<MakerUser>;
  OPENAI_API_KEY: string;
  OPENAI_MODEL: string;
  SUPABASE_URL: string;
  SUPABASE_PUBLISHABLE_KEY: string;
  REVENUECAT_SECRET_KEY?: string;
  FREE_MONTHLY_USES: string;
  FREE_DAILY_LIMIT: string;
  PRO_DAILY_LIMIT: string;
}
export class MakerUser extends DurableObject<Env> {
  private tail: Promise<unknown> = Promise.resolve();
  fetch(request: Request) {
    const next = this.tail.then(() => this.handle(request));
    this.tail = next.catch(() => {});
    return next;
  }
  async alarm() {
    const cached = await this.ctx.storage.list<CacheValue>({
      prefix: "cache:",
    });
    const expired = [...cached]
      .filter(([, value]) => value.expires <= Date.now())
      .map(([key]) => key);
    for (let start = 0; start < expired.length; start += 128)
      await this.ctx.storage.delete(expired.slice(start, start + 128));
    if (cached.size > expired.length)
      await this.ctx.storage.setAlarm(Date.now() + 86400000);
  }
  private async handle(request: Request) {
    const user = request.headers.get("X-Verified-User");
    if (!user) return json({ message: "Authentication required." }, 401);
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return json({ message: "Invalid JSON." }, 400);
    }
    const env = this.env;
    if (new URL(request.url).pathname === "/food-lookup") {
      const day = new Date().toISOString().slice(0, 10);
      const usage = await this.ctx.storage.get<{ day: string; count: number }>(
        "lookup-usage",
      );
      const count = usage?.day === day ? usage.count : 0;
      if (count >= 100)
        return json(
          { message: "Daily lookup limit reached. Enter the label manually." },
          429,
        );
      await this.ctx.storage.put("lookup-usage", { day, count: count + 1 });
      return foodLookup(
        (body as { barcode?: unknown })?.barcode,
        env.FDC_API_KEY,
      );
    }
    const deps: Dependencies = {
      store: {
        get: async <T>(key: string) => this.ctx.storage.get<T>(key),
        put: async (key, value) => {
          await this.ctx.storage.put(key, value);
          if (
            key.startsWith("cache:") &&
            (await this.ctx.storage.getAlarm()) === null
          )
            await this.ctx.storage.setAlarm(Date.now() + 86400000);
        },
      },
      now: () => new Date(),
      freeMonthly: Number(env.FREE_MONTHLY_USES) || 3,
      freeDaily: Number(env.FREE_DAILY_LIMIT) || 3,
      proDaily: Number(env.PRO_DAILY_LIMIT) || 10,
      isPro: async () => {
        if (!env.REVENUECAT_SECRET_KEY) return false;
        const r = await fetch(
          "https://api.revenuecat.com/v1/subscribers/" +
            encodeURIComponent(user),
          {
            headers: { Authorization: "Bearer " + env.REVENUECAT_SECRET_KEY },
            signal: AbortSignal.timeout(6000),
          },
        );
        if (!r.ok) throw Error("Billing unavailable");
        const d = (await r.json()) as {
          subscriber?: {
            entitlements?: Record<string, { expires_date?: string | null }>;
          };
        };
        const pro = d.subscriber?.entitlements?.pro;
        return (
          !!pro &&
          (pro.expires_date === null ||
            (!!pro.expires_date && Date.parse(pro.expires_date) > Date.now()))
        );
      },
      generate: (input) =>
        generateOpenAI(input, env.OPENAI_API_KEY, env.OPENAI_MODEL),
    };
    if (new URL(request.url).pathname === "/parse-drinks")
      return handleParse(body, {
        ...deps,
        generate: (input) =>
          generateParsing(input, env.OPENAI_API_KEY, env.OPENAI_MODEL),
      });
    if (new URL(request.url).pathname === "/access") return accessStatus(deps);
    return handleMaker(body, deps);
  }
}
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/health") return json({ ok: true });
    if (
      !["/drink-maker", "/food-lookup", "/parse-drinks", "/access"].includes(
        url.pathname,
      ) ||
      request.method !== "POST"
    )
      return json({ message: "Not found." }, 404);
    if (Number(request.headers.get("Content-Length") ?? 0) > 50000)
      return json({ message: "Request too large." }, 413);
    if (
      !env.SUPABASE_URL ||
      !env.SUPABASE_PUBLISHABLE_KEY ||
      (["/drink-maker", "/parse-drinks"].includes(url.pathname) &&
        !env.OPENAI_API_KEY)
    )
      return json(
        {
          code: "NOT_CONFIGURED",
          message: "Goal mode is not configured yet. Lab works offline.",
        },
        503,
      );
    const auth = request.headers.get("Authorization");
    if (!auth?.startsWith("Bearer "))
      return json({ message: "Sign in is required." }, 401);
    let user: string;
    try {
      const result = await fetch(
        env.SUPABASE_URL.replace(/\/$/, "") + "/auth/v1/user",
        {
          headers: {
            Authorization: auth,
            apikey: env.SUPABASE_PUBLISHABLE_KEY,
          },
          signal: AbortSignal.timeout(6000),
        },
      );
      if (!result.ok)
        return json({ message: "Your session expired. Please retry." }, 401);
      const data = (await result.json()) as { id?: string };
      if (!data.id) return json({ message: "Invalid session." }, 401);
      user = data.id;
    } catch {
      return json(
        { message: "Could not verify your session. Please retry." },
        503,
      );
    }
    const text = await request.text();
    if (new TextEncoder().encode(text).length > 50000)
      return json({ message: "Request too large." }, 413);
    const headers = new Headers({
      "Content-Type": "application/json",
      "X-Verified-User": user,
    });
    return env.MAKER_USERS.get(env.MAKER_USERS.idFromName(user)).fetch(
      new Request("https://maker.internal" + url.pathname, {
        method: "POST",
        headers,
        body: text,
      }),
    );
  },
};

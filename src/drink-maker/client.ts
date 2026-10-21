import { connectionMessage } from "../features/errors";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import Constants, { ExecutionEnvironment } from "expo-constants";
import type { MakerRequest, Recipe } from "./core";
import { recipeSchema } from "./core";
const authURL = process.env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
const publicKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serverURL = process.env.EXPO_PUBLIC_DRINK_MAKER_URL?.replace(/\/$/, "");
type Session = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user: { id: string };
};
let inFlight: Promise<Session> | null = null;
async function fetchJSON(url: string, init: RequestInit) {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(45000),
  }).catch(e=>{throw new MakerError(connectionMessage(e),"OFFLINE");});
  const data = await response
    .json()
    .catch(() => ({ message: "The server returned an unreadable response." }));
  if (!response.ok)
    throw new MakerError(
      data.message ?? data.msg ?? "Request failed. Please retry.",
      data.code ?? String(response.status),
      !!data.paywall,
    );
  return data;
}
export class MakerError extends Error {
  constructor(
    message: string,
    public code: string,
    public paywall = false,
  ) {
    super(message);
  }
}
export async function makerSession(): Promise<Session> {
  if (inFlight) return inFlight;
  inFlight = (async () => {
    if (!authURL || !publicKey || (!authURL.startsWith("https://") && !__DEV__))
      throw new MakerError(
        "Goal mode needs its server connection configured. Lab works offline.",
        "NOT_CONFIGURED",
      );
    const saved = await SecureStore.getItemAsync("sip-maker-session");
    const session: Session | null = saved ? JSON.parse(saved) : null;
    if (session && session.expires_at > Date.now() / 1000 + 60) return session;
    const body = session ? { refresh_token: session.refresh_token } : {};
    const data = await fetchJSON(
      authURL +
        (session
          ? "/auth/v1/token?grant_type=refresh_token"
          : "/auth/v1/signup"),
      {
        method: "POST",
        headers: { apikey: publicKey!, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    if (!data.user?.id || !data.access_token || !data.refresh_token)
      throw new MakerError(
        "Could not start your private AI session. Please retry.",
        "AUTH_FAILED",
      );
    const result: Session = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at:
        data.expires_at ??
        Math.floor(Date.now() / 1000) + (data.expires_in ?? 3600),
      user: { id: data.user.id },
    };
    await SecureStore.setItemAsync("sip-maker-session", JSON.stringify(result));
    return result;
  })().finally(() => {
    inFlight = null;
  });
  return inFlight;
}
export type MakerResponse = {
  recipe: Recipe;
  cached: boolean;
  usage: {
    daily: number;
    monthly: number;
    monthly_limit: number | null;
    pro: boolean;
  };
};
export async function requestRecipe(
  input: MakerRequest,
  signal: AbortSignal,
): Promise<MakerResponse> {
  if (!serverURL || (!serverURL.startsWith("https://") && !__DEV__))
    throw new MakerError(
      "Goal mode needs its server connection configured. Lab works offline.",
      "NOT_CONFIGURED",
    );
  const session = await makerSession();
  if (signal.aborted) throw new MakerError("Request cancelled.", "CANCELLED");
  const timeout = AbortSignal.timeout(45000);
  const combined = AbortSignal.any([signal, timeout]);
  const response = await fetch(serverURL + "/drink-maker", {
    method: "POST",
    signal: combined,
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + session.access_token,
    },
    body: JSON.stringify(input),
  });
  const result = await response
    .json()
    .catch(() => ({ message: "Could not read the recipe response." }));
  if (!response.ok) {
    if (response.status === 401) {
      await SecureStore.setItemAsync(
        "sip-maker-session",
        JSON.stringify({ ...session, expires_at: 0 }),
      );
    }
    throw new MakerError(
      result.message ?? "Could not make a drink. Please retry.",
      result.code ?? String(response.status),
      !!result.paywall,
    );
  }
  return {
    recipe: recipeSchema.parse(result.recipe),
    cached: result.cached === true,
    usage: result.usage,
  };
}
let purchasesReady = false;
export async function purchases() {
  const key =
    Platform.OS === "ios"
      ? process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY
      : process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY;
  if (!key)
    throw new MakerError(
      "Subscriptions are not configured in this build. Lab remains free.",
      "NOT_CONFIGURED",
    );
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient)
    throw new MakerError(
      "Store purchases require a native development or store build. Lab remains free.",
      "NATIVE_BUILD_REQUIRED",
    );
  const sdk = (await import("react-native-purchases")).default;
  if (!purchasesReady) {
    const session = await makerSession();
    sdk.configure({ apiKey: key, appUserID: session.user.id });
    purchasesReady = true;
  }
  return sdk;
}

export async function callService<T>(
  path: string,
  body: unknown,
  signal?: AbortSignal,
): Promise<T> {
  if (!serverURL || (!serverURL.startsWith("https://") && !__DEV__))
    throw new MakerError(
      "This feature needs its server connection configured. Manual logging works offline.",
      "NOT_CONFIGURED",
    );
  const session = await makerSession();
  const r = await fetch(serverURL + path, {
    method: "POST",
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(45000)])
      : AbortSignal.timeout(45000),
    headers: {
      Authorization: "Bearer " + session.access_token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  }).catch(e=>{throw new MakerError(connectionMessage(e),"OFFLINE");});
  const result = await r.json().catch(()=>({message:"The service returned an unreadable response. Retry."}));
  if (!r.ok)
    throw new MakerError(
      result.message ?? "The request failed. Retry.",
      result.code ?? String(r.status),
      !!result.paywall,
    );
  return result;
}

import { AccessiblePressable as Pressable } from "../components/accessible-pressable";
import React, { useEffect, useState } from "react";
import { Linking } from "react-native";
import { router } from "expo-router";
import type { PurchasesPackage } from "react-native-purchases";
import { useStore } from "../state/store";
import type { Settings } from "../lib/model";
import { callService, purchases } from "../drink-maker/client";
import { Page, T, Button, ErrorText } from "../components/ui";
export default function Pro() {
  const store = useStore();
  const [packages, setPackages] = useState<PurchasesPackage[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  async function refreshAccess() {
    const access = await callService<
      Omit<NonNullable<Settings["aiAccess"]>, "fetched_at">
    >("/access", {});
    if (
      !Number.isFinite(access.daily_limit) ||
      !Number.isFinite(access.daily_used) ||
      !Number.isFinite(access.monthly_used)
    )
      throw Error("Could not read your allowance. Retry.");
    await store.saveSettings({
      ...store.settings,
      aiAccess: { ...access, fetched_at: new Date().toISOString() },
    });
    return access;
  }
  async function load() {
    setLoading(true);
    setError("");
    try {
      const sdk = await purchases();
      const offerings = await sdk.getOfferings();
      setPackages(offerings.current?.availablePackages ?? []);
      if (!offerings.current?.availablePackages.length)
        setError(
          "Subscriptions are not available in the store yet. Lab remains free.",
        );
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not load subscriptions. Please retry.",
      );
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    let active = true;
    void purchases()
      .then((sdk) => sdk.getOfferings())
      .then(
        (result) => {
          if (active) {
            setPackages(result.current?.availablePackages ?? []);
            if (!result.current?.availablePackages.length)
              setError(
                "Subscriptions are not available in the store yet. Lab remains free.",
              );
          }
        },
        (e) => {
          if (active)
            setError(
              e instanceof Error ? e.message : "Could not load subscriptions.",
            );
        },
      )
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  async function buy(p: PurchasesPackage) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const sdk = await purchases();
      const info = await sdk.purchasePackage(p);
      if (info.customerInfo.entitlements.active.pro) {
        const access = await refreshAccess();
        if (access.pro) router.back();
        else
          setError(
            "Purchase confirmed. Pro verification is still processing; check your allowance again shortly.",
          );
      } else
        setError(
          "The purchase is still processing. Retry after the store confirms it.",
        );
    } catch (e) {
      if (!(e as { userCancelled?: boolean }).userCancelled)
        setError(
          e instanceof Error ? e.message : "Could not complete the purchase.",
        );
    } finally {
      setBusy(false);
    }
  }
  async function restore() {
    setBusy(true);
    setError("");
    try {
      const sdk = await purchases();
      const info = await sdk.restorePurchases();
      if (info.entitlements.active.pro) {
        const access = await refreshAccess();
        if (access.pro) router.back();
        else
          setError(
            "Purchase restored. Pro verification is still processing; check your allowance again shortly.",
          );
      } else
        setError(
          "No active Sip Pro subscription was found for this store account.",
        );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not restore purchases.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Page>
      <T size={32} bold>
        Sip Pro
      </T>
      <T>
        More AI matches and recipe suggestions, with a daily limit. Lab, saved
        drinks and logging stay free.
      </T>
      <T size={13} muted>
        Free accounts have a limited monthly AI allowance. Cached repeats do not
        use that allowance.
      </T>
      {store.settings.aiAccess ? (
        <>
          <T>
            {store.settings.aiAccess.pro ? "Pro" : "Free"} ·{" "}
            {Math.max(
              0,
              store.settings.aiAccess.daily_limit -
                store.settings.aiAccess.daily_used,
            )}{" "}
            AI uses left today
            {store.settings.aiAccess.monthly_limit !== null
              ? ` · ${Math.max(0, store.settings.aiAccess.monthly_limit - store.settings.aiAccess.monthly_used)} left this month`
              : ""}
          </T>
          <T size={12} muted>
            Checked{" "}
            {new Date(store.settings.aiAccess.fetched_at).toLocaleString()}.
            Limits reset at UTC day/month boundaries.
          </T>
        </>
      ) : null}
      <Button
        secondary
        title="Check AI allowance"
        disabled={busy}
        onPress={() =>
          void refreshAccess().catch((e) => setError((e as Error).message))
        }
      />
      {packages.map((p) => (
        <Button
          key={p.identifier}
          title={`${p.product.title} · ${p.product.priceString}${p.product.subscriptionPeriod ? " / " + ({ P1M: "month", P1Y: "year", P1W: "week" }[p.product.subscriptionPeriod] ?? p.product.subscriptionPeriod) : ""}`}
          disabled={busy}
          onPress={() => void buy(p)}
        />
      ))}
      <ErrorText error={error} />
      <Button
        secondary
        title={loading ? "Loading store…" : "Reload store options"}
        disabled={loading || busy}
        onPress={() => void load()}
      />
      <Button
        secondary
        title="Restore purchases"
        disabled={loading || busy}
        onPress={() => void restore()}
      />
      <T size={12} muted>
        Subscriptions renew automatically unless cancelled in your Apple or
        Google account settings. The store confirmation shows the billing period
        and final price before purchase.
      </T>
      <Pressable onPress={() => router.push("/privacy")}>
        <T size={13} muted>
          Privacy
        </T>
      </Pressable>
      <Pressable
        onPress={() =>
          void Linking.openURL(
            "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/",
          )
        }
      >
        <T size={13} muted>
          Apple standard terms
        </T>
      </Pressable>
    </Page>
  );
}

export { ErrorBoundary } from "../components/route-error";

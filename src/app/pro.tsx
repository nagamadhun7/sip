import React, { useEffect, useState } from "react";
import { Pressable, Linking } from "react-native";
import { router } from "expo-router";
import type { PurchasesPackage } from "react-native-purchases";
import { purchases } from "../drink-maker/client";
import { Page, T, Button, ErrorText } from "../components/ui";
export default function Pro() {
  const [packages, setPackages] = useState<PurchasesPackage[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
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
      if (info.customerInfo.entitlements.active.pro) router.back();
      else
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
      if (info.entitlements.active.pro) router.back();
      else
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
        More AI recipe suggestions in Goal mode, with a daily limit. Lab, saved
        drinks and logging stay free.
      </T>
      <T size={13} muted>
        Free accounts have a limited monthly AI allowance. Cached repeats do not
        use that allowance.
      </T>
      {packages.map((p) => (
        <Button
          key={p.identifier}
          title={`${p.product.title} · ${p.product.priceString}${p.product.subscriptionPeriod ? " / " + p.product.subscriptionPeriod : ""}`}
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

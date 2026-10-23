import React, { useState } from "react";
import { Alert, Linking } from "react-native";
import { router } from "expo-router";
import { useStore } from "../state/store";
import { Page, T, Button, ErrorText } from "../components/ui";
import { setReminders } from "../lib/reminders";
export default function Privacy() {
  const store = useStore(),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function erase() {
    setBusy(true);
    try {
      await setReminders({
        ...store.settings,
        reminders: false,
        cravingNudges: undefined,
      });
      await store.erase();
      router.dismissAll();
      router.replace("/onboarding");
    } catch {
      setError("Could not delete all data. Please retry.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Page>
      <T>
        USDA catalog search sends your product search phrase to USDA through our
        server when requested. Bundled catalog drinks work offline. Your logs
        and daily notes are not sent with catalog searches.
      </T>
      <T size={25} bold>
        Your Sip data
      </T>
      <T>
        Drink history, custom drinks, pinned favorites, daily notes and
        preferences are stored in a local SQLite database. The free tracker does
        not require sign-in and does not upload your drink history to a server.
      </T>
      <T>
        Drink-time patterns are calculated on this device from completed-day
        logs. Optional pattern nudges use local notifications; no drink history
        is sent for this analysis. Notification text can appear on your lock
        screen according to device settings.
      </T>
      <T size={20} bold>
        Weather and tracking helpers
      </T>
      <T>
        Conditions, diet preferences, exercise logs and adjustment rules stay in
        SQLite. Optional city search sends the city query and enabled weather
        refresh sends selected city coordinates, not GPS location, drink logs or
        health profile. Production requests pass through our authenticated
        weather server to Open-Meteo. The server caches responses for an hour
        and keeps daily lookup counts under your anonymous account ID.
        Development builds can contact Open-Meteo directly. Providers receive
        standard connection information. Forecasts are cached on this device and
        refreshed while Sip is active. Tracking helpers are not medical advice.
      </T>
      <Button
        secondary
        title="Open-Meteo privacy policy"
        onPress={() =>
          void Linking.openURL("https://open-meteo.com/en/privacy")
        }
      />
      <T size={20} bold>
        Barcode lookup
      </T>
      <T>
        Only the barcode number is sent to Open Food Facts when you look up a
        product. Its server receives standard connection information, such as
        your IP address. Camera images are processed on the device for barcode
        detection and are not uploaded.
      </T>
      <Button
        secondary
        title="Open Food Facts privacy policy"
        onPress={() =>
          void Linking.openURL("https://world.openfoodfacts.org/privacy")
        }
      />
      <T size={20} bold>
        Drink maker and Pro
      </T>
      <T>
        Lab and common typed drink matching run offline. Complex typed
        descriptions and custom-drink text are sent to the recipe service and
        OpenAI when you request a match or recipe. Voice uses the device speech
        service and then the same matching flow. Goal sends your request,
        remaining limits, bedtime, focus, age band, pregnancy/nursing status and
        dietary filters to the recipe server and OpenAI when you tap Generate.
        Your drink history is not sent. The server caches recipes for 30 days
        using a hash of the request and context and keeps usage counters under
        an anonymous account ID. OpenAI requests disable response storage;
        provider abuse monitoring retention can still apply.
      </T>
      <T>
        Goal creates an anonymous session stored securely on this device. Pro
        uses RevenueCat and your platform store with that account ID to verify
        purchases. Deleting local tracker data does not cancel a subscription or
        delete server usage records. Manage subscriptions in your store
        settings.
      </T>
      <T size={20} bold>
        Nutrition sources
      </T>
      <T>
        Everyday drinks use generic estimates; ingredients, brands and brewing
        change the results. Review the numbers before saving. Scanned product
        data is provided by Open Food Facts, a community database under the Open
        Database License. It may be incomplete or incorrect. Unknown nutrients
        remain blank and are flagged in your totals.
      </T>
      <Button
        secondary
        title="Open Food Facts and data license"
        onPress={() =>
          void Linking.openURL("https://world.openfoodfacts.org/terms-of-use")
        }
      />
      <T size={20} bold>
        Permissions, Health and backups
      </T>
      <T>
        Camera permission scans barcodes and photographs drinks or labels.
        Requested drink recognition sends the image to the recipe server and
        OpenAI; images are not retained in the server cache. Recognition
        estimates the drink and size, never nutrition. Label photos stay in app
        storage. Optional Health sync writes known drink nutrients and fluid
        intake to Apple Health or Health Connect, and imports hydration records
        into SQLite. Sync does not send Health data to the recipe server. You
        can disconnect in Settings and manage permissions in Health. Deleting a
        synced entry propagates to samples Sip wrote; records from other apps
        are not deleted. Notifications are optional. Your operating system may
        include app data in device backups according to your backup settings.
        Exported files go only to the destination you choose in the share sheet.
      </T>
      <T size={20} bold>
        Crash reporting
      </T>
      <T>
        When configured, Sentry receives app version, error types and stack
        traces to diagnose crashes. We remove user identity, request bodies,
        breadcrumbs, notes, photos and Health/profile context. No advertising,
        session replay or performance profiling is enabled.
      </T>
      <T size={20} bold>
        Delete your data
      </T>
      <T>
        This erases all drink history, saved drinks and settings on this device
        and cancels reminders. Export any records you want to keep first. Device
        backups and previously exported files are managed separately.
      </T>
      <ErrorText error={error} />
      <Button
        danger
        title="Delete all Sip data"
        busy={busy}
        onPress={() =>
          Alert.alert(
            "Delete all Sip data?",
            "All history, saved drinks and settings on this device will be erased. This cannot be undone.",
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Delete all data",
                style: "destructive",
                onPress: () => void erase(),
              },
            ],
          )
        }
      />
    </Page>
  );
}

export { ErrorBoundary } from "../components/route-error";

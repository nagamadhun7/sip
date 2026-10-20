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
      await setReminders({ ...store.settings, reminders: false });
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
      <T size={25} bold>
        Your Sip data
      </T>
      <T>
        Drink history, custom drinks and preferences are stored in a local
        SQLite database. The free tracker does not require sign-in and does not
        upload your drink history to a server.
      </T>
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
        Lab runs offline. Goal sends your request, remaining limits, bedtime,
        focus, age band, pregnancy/nursing status and dietary filters to the
        recipe server and OpenAI when you tap Generate. Your drink history is
        not sent. The server caches recipes for 30 days using a hash of the
        request and context and keeps usage counters under an anonymous account
        ID. OpenAI requests disable response storage; provider abuse monitoring
        retention can still apply.
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
        Permissions and backups
      </T>
      <T>
        Camera permission is used only to scan barcodes. Notifications are
        optional. Your operating system may include app data in device backups
        according to your backup settings. Exported files go only to the
        destination you choose in the share sheet.
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

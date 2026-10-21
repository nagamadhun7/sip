import { useEffect } from "react";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { useStore } from "../state/store";
import { actionHandled, markActionHandled } from "../lib/database";
import { defaultReminderPreferences } from "../lib/reminder-plan";
let queue: Promise<unknown> = Promise.resolve();
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});
export function NotificationActions() {
  const store = useStore();
  useEffect(() => {
    function handle(response: Notifications.NotificationResponse) {
      queue = queue
        .catch(() => {})
        .then(async () => {
          const n = response.notification,
            action = response.actionIdentifier,
            key = n.request.identifier + ":" + action;
          if (await actionHandled(key)) return;
          const p = {
            ...defaultReminderPreferences,
            ...store.settings.reminderPreferences,
          };
          if (action === "SNOOZE") {
            await store.saveSettings({
              ...store.settings,
              reminderPreferences: {
                ...p,
                snoozed_until: Date.now() + p.snooze_minutes * 60000,
              },
            });
          } else if (action === "LOG") {
            const data = n.request.content.data ?? {},
              drink = [...store.library, ...store.catalog].find(
                (d) => d.id === data.drink_id,
              ),
              entryId = "notification:" + n.request.identifier;
            if (drink && typeof data.ml === "number" && data.ml > 0) {
              if (!store.entries.some((e) => e.id === entryId))
                await store.saveEntry({
                  id: entryId,
                  drink,
                  ml: data.ml,
                  at: new Date().toISOString(),
                });
            } else router.push("/add");
          } else router.push("/add");
          await markActionHandled(key);
        })
        .catch(() => {});
    }
    void Notifications.getLastNotificationResponseAsync().then((r) => {
      if (r) handle(r);
    });
    const listener =
      Notifications.addNotificationResponseReceivedListener(handle);
    return () => listener.remove();
  }, [store]);
  return null;
}

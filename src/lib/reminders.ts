import * as Notifications from "expo-notifications";
import { AndroidImportance } from "expo-notifications";
import { Platform } from "react-native";
import { Settings, Entry, localDay } from "./model";
import { planReminders } from "./reminder-plan";
import { notificationLedger, rememberNotifications } from "./database";
let sequence: Promise<unknown> = Promise.resolve();
export async function requestReminderPermission() {
  if (Platform.OS === "android")
    await Notifications.setNotificationChannelAsync("hydration", {
      name: "Drink reminders",
      importance: AndroidImportance.DEFAULT,
    });
  let permission = await Notifications.getPermissionsAsync();
  if (!permission.granted)
    permission = await Notifications.requestPermissionsAsync();
  if (!permission.granted)
    throw Error(
      "Enable notifications in device Settings to receive reminders.",
    );
}
export function setReminders(
  settings: Settings,
  entries: Entry[] = [],
  ask = true,
) {
  const run = sequence
    .catch(() => {})
    .then(async () => {
      if (settings.reminders && ask) await requestReminderPermission();
      const scheduled = await Notifications.getAllScheduledNotificationsAsync();
      for (const n of scheduled)
        if ((n.identifier.startsWith("sip:")||n.content.title==="Time for a sip?"))
          await Notifications.cancelScheduledNotificationAsync(n.identifier);
      if (!settings.reminders) {
        await rememberNotifications([]);
        return;
      }
      if (!(await Notifications.getPermissionsAsync()).granted) return;
      await Notifications.setNotificationCategoryAsync("sip-drink", [
        {
          identifier: "LOG",
          buttonTitle: "Log drink",
          options: { opensAppToForeground: true },
        },
        {
          identifier: "SNOOZE",
          buttonTitle: "Snooze",
          options: { opensAppToForeground: true },
        },
      ]);
      const now = new Date(),
        ledger = await notificationLedger(),
        past: Record<string, number> = {};
      for (const row of ledger)
        if (row.at <= now.getTime()) {
          const day = localDay(new Date(row.at));
          past[day] = (past[day] ?? 0) + 1;
        }
      const plan = planReminders(settings, entries, now, past);
      await rememberNotifications(plan);
      for (const r of plan)
        await Notifications.scheduleNotificationAsync({
          identifier: r.id,
          content: {
            title: r.kind === "caffeine" ? "Caffeine check" : "Time for a sip?",
            body: r.body,
            sound: "default",
            categoryIdentifier: "sip-drink",
            data: {
              kind: r.kind,
              drink_id: r.drink_id ?? null,
              ml: r.ml ?? null,
            },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: new Date(r.at),
            channelId: "hydration",
          },
        });
    });
  sequence = run;
  return run;
}

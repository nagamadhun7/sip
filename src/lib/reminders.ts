import * as Notifications from "expo-notifications";
import { AndroidImportance } from "expo-notifications";
import { Platform } from "react-native";
import { Settings } from "./model";
export async function setReminders(settings: Settings) {
  if (!settings.reminders) {
    await Notifications.cancelAllScheduledNotificationsAsync();
    return;
  }
  if (Platform.OS === "android")
    await Notifications.setNotificationChannelAsync("hydration", {
      name: "Hydration reminders",
      importance: AndroidImportance.DEFAULT,
    });
  const status = await Notifications.getPermissionsAsync();
  if (!status.granted) {
    const permission = await Notifications.requestPermissionsAsync();
    if (!permission.granted)
      throw Error(
        "Notifications are disabled. Enable them in device Settings to receive reminders.",
      );
  }
  await Notifications.cancelAllScheduledNotificationsAsync();
  for (const hour of settings.reminderHours) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Time for a sip?",
        body: "Check in with your day and log your next drink.",
        sound: "default",
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute: 0,
        channelId: "hydration",
      },
    });
  }
}

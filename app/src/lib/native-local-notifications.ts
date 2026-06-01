import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";

import { supportsNativeLocalNotifications } from "@/lib/native-platform";
import { storage } from "@/lib/storage";

const CHANNELS = [
  {
    id: "diabeaters_push",
    name: "Push notifications",
    description: "Messages, alerts, and activity from other users",
    importance: 4,
    visibility: 1,
  },
  {
    id: "diabeaters_general",
    name: "General reminders",
    description: "App reminders and check-ins",
    importance: 4,
    visibility: 1,
  },
  {
    id: "diabeaters_exercise",
    name: "Exercise",
    description: "Workout start, during, and recovery reminders",
    importance: 4,
    visibility: 1,
  },
  {
    id: "diabeaters_scenarios",
    name: "Scenarios",
    description: "Sick day, travel, alcohol, and pump alerts",
    importance: 4,
    visibility: 1,
  },
  {
    id: "diabeaters_appointments",
    name: "Appointments",
    description: "Upcoming appointment reminders",
    importance: 3,
    visibility: 1,
  },
] as const;

export type NativeNotificationChannelId = (typeof CHANNELS)[number]["id"];

let channelsReady = false;

export async function ensureNativeNotificationChannels(): Promise<void> {
  if (!supportsNativeLocalNotifications() || Capacitor.getPlatform() !== "android") return;
  if (channelsReady) return;
  try {
    for (const ch of CHANNELS) {
      await LocalNotifications.createChannel(ch);
    }
    channelsReady = true;
  } catch {
    // ignore — scheduling may still work on older API levels
  }
}

/**
 * Request OS notification permission when the user has enabled notifications in-app.
 * Returns true when local notifications may be scheduled.
 */
export async function ensureNativeLocalNotificationPermission(): Promise<boolean> {
  if (!supportsNativeLocalNotifications()) return false;
  const settings = storage.getNotificationSettings();
  if (!settings.enabled) return false;

  await ensureNativeNotificationChannels();

  try {
    const perm = await LocalNotifications.requestPermissions();
    if (Capacitor.getPlatform() === "android") {
      return perm.display === "granted";
    }
    return perm.display === "granted";
  } catch {
    return false;
  }
}

export async function checkNativeLocalNotificationPermission(): Promise<boolean> {
  if (!supportsNativeLocalNotifications()) return false;
  try {
    const perm = await LocalNotifications.checkPermissions();
    return perm.display === "granted";
  } catch {
    return false;
  }
}

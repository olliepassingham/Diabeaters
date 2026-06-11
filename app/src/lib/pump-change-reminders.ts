import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";

import {
  allPumpChangeNotificationIds,
  notificationIdForPumpChange,
  upcomingPumpChangeReminderSlots,
} from "@/lib/pump-change-reminder-schedule";
import { ensureNativeLocalNotificationPermission } from "@/lib/native-local-notifications";
import { supportsNativeLocalNotifications } from "@/lib/native-platform";
import { storage } from "@/lib/storage";

function androidChannel(): { channelId?: string } {
  return Capacitor.getPlatform() === "android" ? { channelId: "diabeaters_general" } : {};
}

export async function cancelAllPumpChangeReminders(): Promise<void> {
  if (!supportsNativeLocalNotifications()) return;
  try {
    const ids = allPumpChangeNotificationIds().map((id) => ({ id }));
    if (ids.length > 0) await LocalNotifications.cancel({ notifications: ids });
  } catch {
    // ignore
  }
}

export async function reschedulePumpChangeReminders(): Promise<void> {
  if (!supportsNativeLocalNotifications()) return;

  const notif = storage.getNotificationSettings();
  if (!notif.enabled || notif.pumpChangeReminders === false) {
    await cancelAllPumpChangeReminders();
    return;
  }

  const ok = await ensureNativeLocalNotificationPermission();
  if (!ok) return;

  storage.autoAdvanceActiveItemDates();

  const now = new Date();
  try {
    const ids = allPumpChangeNotificationIds(now).map((id) => ({ id }));
    if (ids.length > 0) await LocalNotifications.cancel({ notifications: ids });
  } catch {
    // ignore
  }

  const notifications = upcomingPumpChangeReminderSlots(now).map((slot) => ({
    id: notificationIdForPumpChange(slot.supplyId, slot.dueDayKey),
    title: slot.title,
    body: slot.body,
    schedule: { at: slot.at },
    extra: {
      kind: "pump_change_reminder",
      supply_id: slot.supplyId,
      pump_change_kind: slot.kind,
      deep_link: "/supplies",
      due_day_key: slot.dueDayKey,
    },
    ...androidChannel(),
  }));

  if (notifications.length === 0) return;
  try {
    await LocalNotifications.schedule({ notifications });
  } catch {
    // ignore
  }
}

import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";

import {
  allBedtimeNotificationIds,
  bedtimeReminderCopy,
  DEFAULT_BEDTIME_REMINDER_TIME,
  notificationIdForBedtimeDay,
  upcomingBedtimeReminderSlots,
} from "@/lib/bedtime-reminder-schedule";
import { shouldReceiveBedtimeCheckReminders } from "@/lib/bedtime-reminder-eligibility";
import { ensureNativeLocalNotificationPermission } from "@/lib/native-local-notifications";
import { supportsNativeLocalNotifications } from "@/lib/native-platform";
import { storage } from "@/lib/storage";

function androidChannel(): { channelId?: string } {
  return Capacitor.getPlatform() === "android" ? { channelId: "diabeaters_general" } : {};
}

export async function rescheduleBedtimeReminders(
  options?: { hasCarerLink?: boolean; cloudCommunityProfile?: boolean },
): Promise<void> {
  if (!supportsNativeLocalNotifications()) return;

  const settings = storage.getNotificationSettings();
  const time = settings.bedtimeReminderTime || DEFAULT_BEDTIME_REMINDER_TIME;

  if (
    !shouldReceiveBedtimeCheckReminders({
      hasCarerLink: options?.hasCarerLink,
      cloudCommunityProfile: options?.cloudCommunityProfile,
    }) ||
    !settings.enabled ||
    settings.bedtimeCheckReminders === false
  ) {
    await cancelAllBedtimeReminders(time);
    return;
  }

  const ok = await ensureNativeLocalNotificationPermission();
  if (!ok) return;

  const now = new Date();

  try {
    const ids = allBedtimeNotificationIds(time, now).map((id) => ({ id }));
    if (ids.length > 0) await LocalNotifications.cancel({ notifications: ids });
  } catch {
    // ignore
  }

  const { title, body } = bedtimeReminderCopy();
  const notifications = upcomingBedtimeReminderSlots(time, now).map(({ dayKey, at }) => ({
    id: notificationIdForBedtimeDay(dayKey),
    title,
    body,
    schedule: { at },
    extra: {
      kind: "bedtime_reminder",
      deep_link: "/scenarios/bedtime",
      day_key: dayKey,
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

export async function cancelAllBedtimeReminders(
  time: string = DEFAULT_BEDTIME_REMINDER_TIME,
): Promise<void> {
  if (!supportsNativeLocalNotifications()) return;
  try {
    const ids = allBedtimeNotificationIds(time).map((id) => ({ id }));
    if (ids.length > 0) await LocalNotifications.cancel({ notifications: ids });
  } catch {
    // ignore
  }
}

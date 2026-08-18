import { isAndroidDevice, isIosDevice } from "@/lib/native-platform";
import { LocalNotifications } from "@capacitor/local-notifications";

import {
  checkNativeLocalNotificationPermission,
  ensureNativeNotificationChannels,
} from "@/lib/native-local-notifications";
import { supportsNativeLocalNotifications } from "@/lib/native-platform";
import { registerNotificationActionTypes } from "@/lib/notification-actions";
import { storage } from "@/lib/storage";

/** Id used by the removed "helpful check-ins" local notification — cancel on boot so old installs do not keep firing. */
const LEGACY_HELPFUL_CHECKIN_NOTIFICATION_ID = 770000001;

export async function cancelLegacyHelpfulCheckInNotification(): Promise<void> {
  if (!supportsNativeLocalNotifications()) return;
  try {
    await LocalNotifications.cancel({ notifications: [{ id: LEGACY_HELPFUL_CHECKIN_NOTIFICATION_ID }] });
  } catch {
    /* ignore */
  }
}

function hashToInt32(input: string): number {
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) + h) ^ input.charCodeAt(i);
  }
  return Math.abs(h) % 2_000_000_000;
}

export async function showNativeSystemNotificationNow(params: {
  title: string;
  body: string;
  /** Android expanded text. */
  largeBody?: string | null;
  summaryText?: string | null;
  inboxList?: string[] | null;
  /** Deep link path like `/sick-day#sickday-checklist` */
  deepLink?: string | null;
  /** Dedupe key to avoid spamming the same alert repeatedly */
  tag?: string | null;
  channelId?: string;
  actionTypeId?: string;
}): Promise<{ shown: boolean; permission?: "granted" | "denied" }> {
  if (!supportsNativeLocalNotifications()) return { shown: false };

  const settings = storage.getNotificationSettings();
  if (!settings.enabled) return { shown: false };

  await ensureNativeNotificationChannels();
  await registerNotificationActionTypes();

  const granted = await checkNativeLocalNotificationPermission();
  if (!granted) return { shown: false, permission: "denied" };

  const id = hashToInt32(params.tag?.trim() || `${params.title}|${params.body}`);
  const at = new Date(Date.now() + 1_000);

  const notification = {
    id,
    title: params.title,
    body: params.body,
    schedule: { at },
    channelId: params.channelId ?? "diabeaters_general",
    extra: {
      deep_link: params.deepLink ?? null,
      tag: params.tag ?? null,
    },
    ...(params.largeBody ? { largeBody: params.largeBody } : {}),
    ...(params.summaryText ? { summaryText: params.summaryText } : {}),
    ...(params.inboxList && params.inboxList.length > 0 ? { inboxList: params.inboxList.slice(0, 5) } : {}),
    ...(params.actionTypeId ? { actionTypeId: params.actionTypeId } : {}),
    ...(isAndroidDevice() ? { iconColor: "#D97706" } : {}),
    ...(isIosDevice() ? { sound: "default" as const } : {}),
  };

  try {
    await LocalNotifications.schedule({
      notifications: [notification],
    });
    return { shown: true, permission: "granted" };
  } catch {
    return { shown: false, permission: "granted" };
  }
}

/** @deprecated Use {@link showNativeSystemNotificationNow} */
export const showIosSystemNotificationNow = showNativeSystemNotificationNow;

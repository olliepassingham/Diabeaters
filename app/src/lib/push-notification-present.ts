import type { PushNotificationSchema } from "@capacitor/push-notifications";
import { LocalNotifications } from "@capacitor/local-notifications";

import {
  checkNativeLocalNotificationPermission,
  ensureNativeNotificationChannels,
} from "@/lib/native-local-notifications";
import { extraForPushNotificationDeepLink } from "@/lib/push-notification-deep-link";
import { getNativePushPlatform } from "@/lib/native-platform";
import { HYPO_CHECK_IN_ACTION_TYPE, registerNotificationActionTypes } from "@/lib/notification-actions";
import { storage } from "@/lib/storage";

function hashToInt32(input: string): number {
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) + h) ^ input.charCodeAt(i);
  }
  return Math.abs(h) % 2_000_000_000;
}

/** Extract display strings from a Capacitor push payload (incl. custom data fallbacks). */
export function titleBodyFromPushNotification(notification: PushNotificationSchema): {
  title: string;
  body: string;
} {
  const data =
    notification.data && typeof notification.data === "object"
      ? (notification.data as Record<string, unknown>)
      : {};
  const aps =
    data.aps && typeof data.aps === "object" ? (data.aps as Record<string, unknown>) : null;
  const alert = aps?.alert;
  let alertTitle = "";
  let alertBody = "";
  if (alert && typeof alert === "object" && !Array.isArray(alert)) {
    const a = alert as Record<string, unknown>;
    alertTitle = typeof a.title === "string" ? a.title : "";
    alertBody = typeof a.body === "string" ? a.body : "";
  } else if (typeof alert === "string") {
    alertBody = alert;
  }

  const title =
    notification.title?.trim() ||
    alertTitle.trim() ||
    (typeof data.title === "string" ? data.title.trim() : "") ||
    "Diabeaters";
  const body =
    notification.body?.trim() ||
    alertBody.trim() ||
    (typeof data.body === "string" ? data.body.trim() : "") ||
    "You have a new notification";

  return { title, body };
}

/**
 * When the app is open, iOS often lists remote pushes in Notification Centre without playing a sound.
 * Re-post as a local notification with an explicit default sound (Capacitor local handler always allows sound).
 */
export async function presentAudiblePushNotificationFromRemote(
  notification: PushNotificationSchema,
): Promise<void> {
  if (getNativePushPlatform() !== "ios") return;

  const settings = storage.getNotificationSettings();
  if (!settings.enabled || !settings.pushNotifications) return;

  await ensureNativeNotificationChannels();
  const granted = await checkNativeLocalNotificationPermission();
  if (!granted) return;

  const { title, body } = titleBodyFromPushNotification(notification);
  const id = hashToInt32(notification.id?.trim() || `${title}|${body}`);
  const extra = extraForPushNotificationDeepLink(notification);
  const actionTypeId = extra.kind === "hypo_check_in" ? HYPO_CHECK_IN_ACTION_TYPE : undefined;

  try {
    if (actionTypeId) await registerNotificationActionTypes();
    await LocalNotifications.schedule({
      notifications: [
        {
          id,
          title,
          body,
          sound: "default",
          schedule: { at: new Date(Date.now() + 300) },
          ...(actionTypeId ? { actionTypeId } : {}),
          extra,
        },
      ],
    });
  } catch (e) {
    console.warn("[push_notification_present] schedule failed:", e);
  }
}

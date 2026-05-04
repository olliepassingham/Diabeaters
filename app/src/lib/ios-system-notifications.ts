import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";

import { storage } from "@/lib/storage";

/** Id used by the removed "helpful check-ins" local notification — cancel on boot so old installs do not keep firing. */
const LEGACY_HELPFUL_CHECKIN_NOTIFICATION_ID = 770000001;

export async function cancelLegacyHelpfulCheckInNotification(): Promise<void> {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "ios") return;
  try {
    await LocalNotifications.cancel({ notifications: [{ id: LEGACY_HELPFUL_CHECKIN_NOTIFICATION_ID }] });
  } catch {
    /* ignore */
  }
}

function hashToInt32(input: string): number {
  // Simple stable hash (djb2-ish) for notification IDs.
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) + h) ^ input.charCodeAt(i);
  }
  // Ensure positive, within LocalNotifications id range.
  return Math.abs(h) % 2_000_000_000;
}

export async function showIosSystemNotificationNow(params: {
  title: string;
  body: string;
  /** Deep link path like `/sick-day#sickday-checklist` */
  deepLink?: string | null;
  /** Dedupe key to avoid spamming the same alert repeatedly */
  tag?: string | null;
}): Promise<{ shown: boolean; permission?: "granted" | "denied" }> {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "ios") return { shown: false };

  const settings = storage.getNotificationSettings();
  if (!settings.enabled) return { shown: false };

  // Avoid surprising permission prompts: the app banner handles prompting.
  let perm: { display?: string } | null = null;
  try {
    perm = await (LocalNotifications as any).checkPermissions?.();
  } catch {
    perm = null;
  }
  if (perm?.display && perm.display !== "granted") {
    return { shown: false, permission: "denied" };
  }

  // If checkPermissions isn't available, fall back to requesting, but only once the user has explicitly enabled.
  if (!perm) {
    const req = await LocalNotifications.requestPermissions();
    if (req.display !== "granted") return { shown: false, permission: "denied" };
  }

  const id = hashToInt32(params.tag?.trim() || `${params.title}|${params.body}`);
  const at = new Date(Date.now() + 1_000);

  try {
    await LocalNotifications.schedule({
      notifications: [
        {
          id,
          title: params.title,
          body: params.body,
          schedule: { at },
          extra: {
            deep_link: params.deepLink ?? null,
            tag: params.tag ?? null,
          },
        },
      ],
    });
    return { shown: true, permission: "granted" };
  } catch {
    return { shown: false, permission: "granted" };
  }
}

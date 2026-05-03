import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";

import { storage } from "@/lib/storage";

/** Fixed id so schedule/cancel never stacks multiple helpful check-ins. */
export const HELPFUL_CHECKIN_NOTIFICATION_ID = 770000001;

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

const HELPFUL_CHECKIN_BODIES = [
  "You can ask Diabeaters about anything T1D.",
  "Got a question for clinic? Diabeaters can help you prepare.",
  "Sick day, travel, exercise — Diabeaters has guides ready when you need them.",
  "Need a quick reference? Open Diabeaters.",
] as const;

function helpfulCheckInBodyForDate(d: Date): string {
  const start = new Date(d.getFullYear(), 0, 0).getTime();
  const day = Math.floor((d.getTime() - start) / 86_400_000);
  return HELPFUL_CHECKIN_BODIES[Math.abs(day) % HELPFUL_CHECKIN_BODIES.length]!;
}

function nextCheckInWindowLocal(from: Date): Date {
  const target = new Date(from.getTime() + 24 * 60 * 60 * 1000);
  let h = target.getHours();
  if (h < 10) {
    target.setHours(10, 0, 0, 0);
  } else if (h > 20) {
    target.setDate(target.getDate() + 1);
    target.setHours(10, 0, 0, 0);
  }
  return target;
}

export async function cancelHelpfulCheckIn(): Promise<void> {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "ios") return;
  try {
    await LocalNotifications.cancel({ notifications: [{ id: HELPFUL_CHECKIN_NOTIFICATION_ID }] });
  } catch {
    /* ignore */
  }
}

/**
 * Schedules a single optional iOS local notification (opt-in via notification settings).
 * Tap opens `/?ask=1` (handled on the dashboard).
 */
export async function scheduleHelpfulCheckIn(when: Date): Promise<{ scheduled: boolean }> {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "ios") return { scheduled: false };

  const settings = storage.getNotificationSettings();
  if (!settings.enabled || !settings.helpfulCheckInsEnabled) return { scheduled: false };

  let perm: { display?: string } | null = null;
  try {
    perm = await (LocalNotifications as any).checkPermissions?.();
  } catch {
    perm = null;
  }
  if (perm?.display && perm.display !== "granted") {
    return { scheduled: false };
  }
  if (!perm) {
    const req = await LocalNotifications.requestPermissions();
    if (req.display !== "granted") return { scheduled: false };
  }

  const at = when.getTime() <= Date.now() + 60_000 ? new Date(Date.now() + 120_000) : when;
  const body = helpfulCheckInBodyForDate(at);

  try {
    await LocalNotifications.cancel({ notifications: [{ id: HELPFUL_CHECKIN_NOTIFICATION_ID }] });
    await LocalNotifications.schedule({
      notifications: [
        {
          id: HELPFUL_CHECKIN_NOTIFICATION_ID,
          title: "Diabeaters",
          body,
          schedule: { at },
          extra: {
            deep_link: "/?ask=1",
            tag: "helpful_check_in",
          },
        },
      ],
    });
    return { scheduled: true };
  } catch {
    return { scheduled: false };
  }
}

export async function rescheduleHelpfulCheckInOnBackground(): Promise<void> {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "ios") return;
  const settings = storage.getNotificationSettings();
  if (!settings.enabled || !settings.helpfulCheckInsEnabled) return;
  const when = nextCheckInWindowLocal(new Date());
  await scheduleHelpfulCheckIn(when);
}

export async function cancelHelpfulCheckInOnForeground(): Promise<void> {
  await cancelHelpfulCheckIn();
}


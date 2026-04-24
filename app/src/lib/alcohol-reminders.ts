import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";

import { storage, type AlcoholReminder, type AlcoholReminderKind, type AlcoholSession } from "@/lib/storage";

function notificationId(sessionId: string, kind: AlcoholReminderKind): number {
  // Stable-ish numeric id for Capacitor local notifications.
  const hex = (sessionId + kind).replace(/-/g, "").slice(0, 8);
  const n = Number.parseInt(hex, 16);
  return Number.isFinite(n) ? (n % 2_000_000_000) : Math.floor(Math.random() * 1_000_000_000);
}

function buildNotificationBody(kind: AlcoholReminderKind): { title: string; body: string } {
  if (kind === "bedtime_check") {
    return {
      title: "Alcohol: bedtime check",
      body: "Check glucose before sleep. Consider a snack if you’re trending down. Don’t treat lows with alcohol.",
    };
  }
  if (kind === "overnight_check") {
    return {
      title: "Alcohol: overnight check",
      body: "Delayed lows can happen after drinking. Recheck glucose and treat lows as taught by your team.",
    };
  }
  return {
    title: "Alcohol: next‑morning review",
    body: "Quick check-in: how did overnight go? Log what happened so next time is safer.",
  };
}

function upcomingReminders(session: AlcoholSession, nowMs: number): AlcoholReminder[] {
  return session.reminders.filter((r) => {
    const t = new Date(r.atIso).getTime();
    if (!Number.isFinite(t)) return false;
    return t > nowMs;
  });
}

export async function cancelAlcoholReminders(sessionId: string): Promise<void> {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "ios") return;
  try {
    await LocalNotifications.cancel({
      notifications: [
        { id: notificationId(sessionId, "bedtime_check") },
        { id: notificationId(sessionId, "overnight_check") },
        { id: notificationId(sessionId, "morning_review") },
      ],
    });
  } catch {
    // ignore
  }
}

export async function scheduleAlcoholReminders(session: AlcoholSession): Promise<void> {
  const settings = storage.getNotificationSettings();
  if (!settings.enabled) return;
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "ios") return;

  const perm = await LocalNotifications.requestPermissions();
  if (perm.display !== "granted") return;

  const nowMs = Date.now();
  const upcoming = upcomingReminders(session, nowMs);
  if (upcoming.length === 0) return;

  // Cancel previous schedule for this session and recreate.
  await cancelAlcoholReminders(session.id);

  const notifications = upcoming
    .map((r) => {
      const at = new Date(r.atIso);
      const t = at.getTime();
      if (!Number.isFinite(t) || t <= nowMs) return null;
      const copy = buildNotificationBody(r.kind);
      return {
        id: notificationId(session.id, r.kind),
        title: copy.title,
        body: copy.body,
        schedule: { at },
        extra: { alcohol_session_id: session.id, kind: r.kind },
      };
    })
    .filter(Boolean) as Array<{
      id: number;
      title: string;
      body: string;
      schedule: { at: Date };
      extra: { alcohol_session_id: string; kind: AlcoholReminderKind };
    }>;

  if (notifications.length === 0) return;
  await LocalNotifications.schedule({ notifications });
}


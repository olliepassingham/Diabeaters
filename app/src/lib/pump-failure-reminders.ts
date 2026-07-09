import { LocalNotifications } from "@capacitor/local-notifications";

import { ensureNativeLocalNotificationPermission } from "@/lib/native-local-notifications";
import { androidNotificationChannel, supportsNativeLocalNotifications } from "@/lib/native-platform";
import { storage, type PumpFailureReminderKind, type PumpFailureSession } from "@/lib/storage";

function notificationId(sessionId: string, kind: PumpFailureReminderKind): number {
  const hex = (sessionId + kind).replace(/-/g, "").slice(0, 8);
  const n = Number.parseInt(hex, 16);
  return Number.isFinite(n) ? (n % 2_000_000_000) : Math.floor(Math.random() * 1_000_000_000);
}

function androidChannel(): { channelId?: string } {
  return androidNotificationChannel("diabeaters_scenarios");
}

function copyFor(kind: PumpFailureReminderKind): { title: string; body: string } {
  if (kind === "bg_recheck_60m") return { title: "Pump failure: recheck glucose", body: "Recheck glucose now (1 hour). If still rising/high, follow your clinic’s pump failure plan." };
  if (kind === "bg_recheck_120m") return { title: "Pump failure: recheck glucose", body: "Recheck glucose now (2 hours). Consider site/set change and urgent advice if you’re not improving." };
  if (kind === "ketone_recheck_120m") return { title: "Pump failure: recheck ketones", body: "If you have ketone strips, recheck ketones now (2 hours). Seek urgent help if moderate/large or vomiting." };
  return { title: "Pump failure: next‑morning review", body: "Quick check-in: did you stabilise overnight? Tap to review and plan for next time." };
}

export async function cancelPumpFailureReminders(sessionId: string): Promise<void> {
  if (!supportsNativeLocalNotifications()) return;
  try {
    await LocalNotifications.cancel({
      notifications: [
        { id: notificationId(sessionId, "bg_recheck_60m") },
        { id: notificationId(sessionId, "bg_recheck_120m") },
        { id: notificationId(sessionId, "ketone_recheck_120m") },
        { id: notificationId(sessionId, "morning_review") },
      ],
    });
  } catch {
    // ignore
  }
}

export async function schedulePumpFailureReminders(session: PumpFailureSession): Promise<void> {
  try {
    if (!supportsNativeLocalNotifications()) return;
    const settings = storage.getNotificationSettings();
    if (!settings.enabled) return;

    const ok = await ensureNativeLocalNotificationPermission();
    if (!ok) return;

    const nowMs = Date.now();
    const upcoming = session.reminders.filter((r) => {
      const t = new Date(r.atIso).getTime();
      return Number.isFinite(t) && t > nowMs;
    });
    if (upcoming.length === 0) return;

    await cancelPumpFailureReminders(session.id);

    const notifications = upcoming
      .map((r) => {
        const at = new Date(r.atIso);
        const t = at.getTime();
        if (!Number.isFinite(t) || t <= nowMs) return null;
        const copy = copyFor(r.kind);
        return {
          id: notificationId(session.id, r.kind),
          title: copy.title,
          body: copy.body,
          schedule: { at },
          extra: { pump_failure_session_id: session.id, kind: r.kind },
          ...androidChannel(),
        };
      })
      .filter(Boolean) as Array<{
        id: number;
        title: string;
        body: string;
        schedule: { at: Date };
        extra: { pump_failure_session_id: string; kind: PumpFailureReminderKind };
      }>;

    if (notifications.length === 0) return;
    await LocalNotifications.schedule({ notifications });
  } catch {
    // Non-blocking: pump failure mode should still start/end even if scheduling fails.
  }
}

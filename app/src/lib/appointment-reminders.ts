import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";

import type { Appointment } from "@/lib/storage";
import { storage } from "@/lib/storage";

function notificationIdForAppointment(id: string): number {
  // Stable-ish numeric id for Capacitor local notifications.
  const hex = id.replace(/-/g, "").slice(0, 8);
  const n = Number.parseInt(hex, 16);
  return Number.isFinite(n) ? (n % 2_000_000_000) : Math.floor(Math.random() * 1_000_000_000);
}

function parseLocalDateTime(date: string, time?: string): Date | null {
  if (!date) return null;
  const t = (time || "09:00").trim();
  const iso = `${date}T${t.length === 5 ? t : "09:00"}:00`;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function rescheduleAppointmentReminders(appointments: Appointment[]): Promise<void> {
  const settings = storage.getNotificationSettings();
  if (!settings.enabled || !settings.appointmentReminders) return;
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "ios") return;

  const perm = await LocalNotifications.requestPermissions();
  if (perm.display !== "granted") return;

  const now = new Date();
  const upcoming = appointments.filter((a) => !a.isCompleted);

  // Cancel and recreate to keep it simple and consistent.
  const ids = upcoming.map((a) => ({ id: notificationIdForAppointment(a.id) }));
  try {
    await LocalNotifications.cancel({ notifications: ids });
  } catch {
    // ignore
  }

  const notifications = upcoming
    .map((a) => {
      const scheduledAt = parseLocalDateTime(a.date, a.time);
      if (!scheduledAt) return null;
      const remindAt = new Date(scheduledAt.getTime() - 24 * 60 * 60 * 1000);
      if (remindAt <= now) return null;

      const timeLabel = a.time ? a.time : "time not set";
      return {
        id: notificationIdForAppointment(a.id),
        title: "Appointment reminder",
        body: `${a.title}${a.time ? ` · ${timeLabel}` : ""}`,
        schedule: { at: remindAt },
        extra: { appointment_id: a.id },
      };
    })
    .filter(Boolean) as Array<{
      id: number;
      title: string;
      body: string;
      schedule: { at: Date };
      extra: { appointment_id: string };
    }>;

  if (notifications.length === 0) return;
  await LocalNotifications.schedule({ notifications });
}


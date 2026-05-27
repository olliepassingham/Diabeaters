import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";

import {
  allAppointmentNotificationIds,
  appointmentReminderTimes,
  notificationIdForAppointment,
  parseAppointmentScheduledAt,
  reminderCopy,
  type AppointmentReminderKind,
} from "@/lib/appointment-reminder-schedule";
import type { Appointment } from "@/lib/storage";
import { storage } from "@/lib/storage";

type ScheduledNotification = {
  id: number;
  title: string;
  body: string;
  schedule: { at: Date };
  extra: { appointment_id: string; reminder_kind: AppointmentReminderKind };
};

function buildReminder(
  a: Appointment,
  kind: AppointmentReminderKind,
  remindAt: Date,
  now: Date,
): ScheduledNotification | null {
  if (remindAt <= now) return null;
  const { title, body } = reminderCopy(a, kind);
  return {
    id: notificationIdForAppointment(a.id, kind),
    title,
    body,
    schedule: { at: remindAt },
    extra: { appointment_id: a.id, reminder_kind: kind },
  };
}

export async function rescheduleAppointmentReminders(appointments: Appointment[]): Promise<void> {
  const settings = storage.getNotificationSettings();
  if (!settings.enabled || !settings.appointmentReminders) return;
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "ios") return;

  const perm = await LocalNotifications.requestPermissions();
  if (perm.display !== "granted") return;

  const now = new Date();
  const upcoming = appointments.filter((a) => !a.isCompleted && !a.deletedAt);

  const ids = upcoming.flatMap((a) =>
    allAppointmentNotificationIds(a.id).map((id) => ({ id })),
  );
  try {
    if (ids.length > 0) await LocalNotifications.cancel({ notifications: ids });
  } catch {
    // ignore
  }

  const notifications: ScheduledNotification[] = [];

  for (const a of upcoming) {
    const scheduledAt = parseAppointmentScheduledAt(a.date, a.time);
    if (!scheduledAt || scheduledAt <= now) continue;

    const { eveningBefore, twoHoursBefore } = appointmentReminderTimes(scheduledAt);

    const evening = buildReminder(a, "evening_before", eveningBefore, now);
    const twoHours = buildReminder(a, "two_hours_before", twoHoursBefore, now);

    if (evening) notifications.push(evening);
    if (twoHours) notifications.push(twoHours);
  }

  if (notifications.length === 0) return;
  await LocalNotifications.schedule({ notifications });
}

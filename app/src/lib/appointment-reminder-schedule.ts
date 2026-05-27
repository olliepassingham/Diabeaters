import type { Appointment } from "@/lib/storage";

/** Local time on the calendar day before the appointment. */
export const APPOINTMENT_EVENING_REMINDER_HOUR = 18;

export type AppointmentReminderKind = "evening_before" | "two_hours_before";

const DEFAULT_APPOINTMENT_TIME = "09:00";
const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

/** @deprecated Legacy single 24h-before local notification id (cancel on reschedule). */
export type LegacyAppointmentReminderKind = "legacy_24h";

export function parseAppointmentScheduledAt(date: string, time?: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;

  let hh = 9;
  let mm = 0;
  const t = (time || DEFAULT_APPOINTMENT_TIME).trim();
  const tm = /^(\d{1,2}):(\d{2})$/.exec(t);
  if (tm) {
    hh = Number(tm[1]);
    mm = Number(tm[2]);
  }

  const d = new Date(year, month - 1, day, hh, mm, 0, 0);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function eveningBeforeReminderAt(scheduledAt: Date): Date {
  const d = new Date(scheduledAt);
  d.setDate(d.getDate() - 1);
  d.setHours(APPOINTMENT_EVENING_REMINDER_HOUR, 0, 0, 0);
  return d;
}

export function twoHoursBeforeReminderAt(scheduledAt: Date): Date {
  return new Date(scheduledAt.getTime() - TWO_HOURS_MS);
}

export function appointmentReminderTimes(scheduledAt: Date): {
  eveningBefore: Date;
  twoHoursBefore: Date;
} {
  return {
    eveningBefore: eveningBeforeReminderAt(scheduledAt),
    twoHoursBefore: twoHoursBeforeReminderAt(scheduledAt),
  };
}

function baseNotificationId(appointmentId: string): number {
  const hex = appointmentId.replace(/-/g, "").slice(0, 8);
  const n = Number.parseInt(hex, 16);
  return Number.isFinite(n) ? n % 2_000_000_000 : Math.floor(Math.random() * 1_000_000_000);
}

export function notificationIdForAppointment(
  appointmentId: string,
  kind: AppointmentReminderKind | LegacyAppointmentReminderKind,
): number {
  const base = baseNotificationId(appointmentId);
  switch (kind) {
    case "legacy_24h":
      return base;
    case "evening_before":
      return (base * 4 + 1) % 2_000_000_000;
    case "two_hours_before":
      return (base * 4 + 2) % 2_000_000_000;
  }
}

export function allAppointmentNotificationIds(appointmentId: string): number[] {
  return [
    notificationIdForAppointment(appointmentId, "legacy_24h"),
    notificationIdForAppointment(appointmentId, "evening_before"),
    notificationIdForAppointment(appointmentId, "two_hours_before"),
  ];
}

export function inAppReminderDedupeKey(a: Appointment, kind: AppointmentReminderKind): string {
  return `${a.id}|${a.date}|${a.time ?? ""}|${kind}`;
}

function timeLabel(a: Appointment): string {
  return a.time?.trim() ? a.time.trim() : DEFAULT_APPOINTMENT_TIME;
}

export function reminderCopy(
  a: Appointment,
  kind: AppointmentReminderKind,
): { title: string; body: string } {
  const when = timeLabel(a);
  if (kind === "evening_before") {
    return {
      title: "Appointment tomorrow",
      body: `${a.title} · ${when}`,
    };
  }
  return {
    title: "Appointment soon",
    body: `${a.title} · ${when} (in about 2 hours)`,
  };
}

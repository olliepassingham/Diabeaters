/**
 * Appointment reminder windows (evening before 18:00 UK + 2h before).
 * Shared by supporter appointment reminder Edge Functions.
 */

export const APPOINTMENT_EVENING_REMINDER_HOUR = 18;
export type AppointmentReminderKind = "evening_before" | "two_hours_before";

const DEFAULT_TIME = "09:00";
const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Previous calendar day as YYYY-MM-DD. */
function previousDateStr(dateStr: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null;
  const utc = new Date(Date.UTC(y, mo - 1, d));
  utc.setUTCDate(utc.getUTCDate() - 1);
  return `${utc.getUTCFullYear()}-${pad2(utc.getUTCMonth() + 1)}-${pad2(utc.getUTCDate())}`;
}

/** Wall-clock date/time in Europe/London (UK app default). */
export function parseScheduledLondon(date: string, time?: string | null): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return null;
  const t = (time?.trim() || DEFAULT_TIME);
  const tm = /^(\d{1,2}):(\d{2})$/.exec(t);
  if (!tm) return null;
  const hh = Number(tm[1]);
  const mm = Number(tm[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;

  try {
    const zdt = Temporal.ZonedDateTime.from(
      `${date}T${pad2(hh)}:${pad2(mm)}:00[Europe/London]`,
    );
    return new Date(zdt.epochMilliseconds);
  } catch {
    return null;
  }
}

export function eveningBeforeReminderLondon(date: string): Date | null {
  const prev = previousDateStr(date);
  if (!prev) return null;
  try {
    const zdt = Temporal.ZonedDateTime.from(
      `${prev}T${pad2(APPOINTMENT_EVENING_REMINDER_HOUR)}:00:00[Europe/London]`,
    );
    return new Date(zdt.epochMilliseconds);
  } catch {
    return null;
  }
}

export function twoHoursBeforeReminderAt(scheduledAt: Date): Date {
  return new Date(scheduledAt.getTime() - TWO_HOURS_MS);
}

export function appointmentReminderTimes(
  date: string,
  time: string | null | undefined,
  scheduledAtIso: string | null | undefined,
): { scheduledAt: Date; eveningBefore: Date; twoHoursBefore: Date } | null {
  const scheduledAt =
    (scheduledAtIso ? new Date(scheduledAtIso) : null) ??
    parseScheduledLondon(date, time);
  if (!scheduledAt || Number.isNaN(scheduledAt.getTime())) return null;

  const eveningBefore = eveningBeforeReminderLondon(date);
  if (!eveningBefore) return null;

  return {
    scheduledAt,
    eveningBefore,
    twoHoursBefore: twoHoursBeforeReminderAt(scheduledAt),
  };
}

export function reminderKindsDueNow(
  times: { scheduledAt: Date; eveningBefore: Date; twoHoursBefore: Date },
  now: Date,
): AppointmentReminderKind[] {
  const due: AppointmentReminderKind[] = [];
  if (now >= times.eveningBefore && now < times.scheduledAt) {
    due.push("evening_before");
  }
  if (now >= times.twoHoursBefore && now < times.scheduledAt) {
    due.push("two_hours_before");
  }
  return due;
}

export function supporterReminderDedupeKey(
  patientId: string,
  appointmentKey: string,
  date: string,
  time: string | null | undefined,
  kind: AppointmentReminderKind,
): string {
  return `${patientId}|${appointmentKey}|${date}|${time ?? ""}|${kind}`;
}

export function supporterReminderCopy(
  patientLabel: string,
  title: string,
  time: string | null | undefined,
  kind: AppointmentReminderKind,
): { title: string; body: string } {
  const when = time?.trim() || DEFAULT_TIME;
  const apt = title.trim() || "Appointment";
  if (kind === "evening_before") {
    return {
      title: "Appointment tomorrow",
      body: `${patientLabel} has ${apt} · ${when}`,
    };
  }
  return {
    title: "Appointment soon",
    body: `${patientLabel} has ${apt} · ${when} (in about 2 hours)`,
  };
}

export function prefsAllowSupporterAppointmentReminders(prefs: unknown): boolean {
  const p = (prefs && typeof prefs === "object" ? prefs : {}) as Record<string, unknown>;
  return p.supporter_appointment_reminders !== false;
}

export function prefsAllowAppointmentAlerts(prefs: unknown): {
  enabled: boolean;
  appointmentAlerts: boolean;
  inapp: boolean;
  push: boolean;
} {
  const p = (prefs && typeof prefs === "object" ? prefs : {}) as Record<string, unknown>;
  return {
    enabled: p.enabled !== false,
    appointmentAlerts: p.appointment_alerts !== false,
    inapp: p.inapp !== false,
    push: p.push === true,
  };
}

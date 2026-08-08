import { addDays, format, startOfDay } from "date-fns";

import { toBedtimeStreakDayKey } from "@/lib/bedtime-overnight-window";
import { storage } from "@/lib/storage";

export const DEFAULT_BEDTIME_REMINDER_TIME = "21:30";
export const BEDTIME_REMINDER_LOOKAHEAD_DAYS = 14;

export const BEDTIME_REMINDER_TIME_OPTIONS = [
  "19:00",
  "19:30",
  "20:00",
  "20:30",
  "21:00",
  "21:30",
  "22:00",
  "22:30",
  "23:00",
] as const;

export function parseBedtimeReminderTime(time: string): { hour: number; minute: number } | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
}

export function formatBedtimeReminderTimeLabel(time: string): string {
  const parsed = parseBedtimeReminderTime(time);
  if (!parsed) return time;
  const d = new Date();
  d.setHours(parsed.hour, parsed.minute, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function reminderAtOnDay(day: Date, time: string): Date | null {
  const parsed = parseBedtimeReminderTime(time);
  if (!parsed) return null;
  const d = startOfDay(day);
  d.setHours(parsed.hour, parsed.minute, 0, 0);
  return d;
}

export function hasBedtimeCheckOnDay(day: Date): boolean {
  const key = format(startOfDay(day), "yyyy-MM-dd");
  return storage.getBedtimeLogs().some((log) => toBedtimeStreakDayKey(log.date, log.hoursUntilSleep) === key);
}

export function hasBedtimeCheckToday(now: Date = new Date()): boolean {
  return hasBedtimeCheckOnDay(now);
}

/** True when local time is at or after today's reminder and the check is not done yet. */
export function isBedtimeReminderDueNow(time: string, now: Date = new Date()): boolean {
  if (hasBedtimeCheckOnDay(now)) return false;
  const at = reminderAtOnDay(now, time);
  if (!at) return false;
  return now >= at;
}

export function bedtimeInAppDedupeKey(dayKey: string): string {
  return `bedtime:${dayKey}`;
}

export function bedtimeReminderCopy(): { title: string; body: string } {
  return {
    title: "Bedtime check",
    body: "Ready for a quick bedtime check?",
  };
}

export function notificationIdForBedtimeDay(dayKey: string): number {
  let h = 1_884_729_301;
  for (let i = 0; i < dayKey.length; i++) {
    h = (h * 31 + dayKey.charCodeAt(i)) % 2_000_000_000;
  }
  return h;
}

export function upcomingBedtimeReminderSlots(
  time: string,
  now: Date = new Date(),
  days: number = BEDTIME_REMINDER_LOOKAHEAD_DAYS,
): Array<{ dayKey: string; at: Date }> {
  const parsed = parseBedtimeReminderTime(time);
  if (!parsed) return [];

  const slots: Array<{ dayKey: string; at: Date }> = [];
  const start = startOfDay(now);

  for (let i = 0; i < days; i++) {
    const day = addDays(start, i);
    const dayKey = format(day, "yyyy-MM-dd");
    if (hasBedtimeCheckOnDay(day)) continue;
    const at = reminderAtOnDay(day, time);
    if (!at || at <= now) continue;
    slots.push({ dayKey, at });
  }

  return slots;
}

export function allBedtimeNotificationIds(time: string, now: Date = new Date()): number[] {
  const ids = new Set<number>();
  for (let i = 0; i < BEDTIME_REMINDER_LOOKAHEAD_DAYS + 7; i++) {
    const dayKey = format(addDays(startOfDay(now), i), "yyyy-MM-dd");
    ids.add(notificationIdForBedtimeDay(dayKey));
  }
  for (const slot of upcomingBedtimeReminderSlots(time, now)) {
    ids.add(notificationIdForBedtimeDay(slot.dayKey));
  }
  return [...ids];
}

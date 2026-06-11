import { addDays, format, startOfDay } from "date-fns";

import { isPumpDeliveryMethod } from "@/lib/insulin-delivery-method";
import { storage, type Supply } from "@/lib/storage";

export const DEFAULT_PUMP_CHANGE_REMINDER_HOUR = 9;
export const DEFAULT_PUMP_CHANGE_REMINDER_MINUTE = 0;
export const PUMP_CHANGE_LOOKAHEAD_DAYS = 21;

export type PumpChangeKind = "infusion_set" | "reservoir";

export function notificationIdForPumpChange(supplyId: string, dueDayKey: string): number {
  const key = `pump_change:${supplyId}:${dueDayKey}`;
  let h = 1_902_441_017;
  for (let i = 0; i < key.length; i++) {
    h = (h * 31 + key.charCodeAt(i)) % 2_000_000_000;
  }
  return h;
}

export function pumpChangeLabel(kind: PumpChangeKind): string {
  return kind === "infusion_set" ? "infusion set" : "reservoir";
}

export function pumpChangeReminderCopy(kind: PumpChangeKind): { title: string; body: string } {
  const label = pumpChangeLabel(kind);
  return {
    title: kind === "infusion_set" ? "Infusion set change" : "Reservoir change",
    body: `Time to change your ${label}. Open Supply Tracker to log it.`,
  };
}

function reminderAtOnDueDay(dueDay: Date): Date {
  const d = startOfDay(dueDay);
  d.setHours(DEFAULT_PUMP_CHANGE_REMINDER_HOUR, DEFAULT_PUMP_CHANGE_REMINDER_MINUTE, 0, 0);
  return d;
}

/** Next local reminder time for a duration-tracked pump supply. */
export function nextPumpChangeReminderAt(supply: Supply, now: Date = new Date()): Date | null {
  if (supply.type !== "infusion_set" && supply.type !== "reservoir") return null;
  if (!supply.activeItemStartDate) return null;

  const info = storage.getActiveItemInfo(supply);
  if (!info) return null;

  const dueDay = addDays(startOfDay(now), Math.max(0, info.daysLeft));
  let at = reminderAtOnDueDay(dueDay);
  if (at <= now) {
    const fallback = new Date(now);
    fallback.setMinutes(fallback.getMinutes() + 10);
    return fallback;
  }
  return at;
}

export function upcomingPumpChangeReminderSlots(now: Date = new Date()): Array<{
  supplyId: string;
  kind: PumpChangeKind;
  dueDayKey: string;
  at: Date;
  title: string;
  body: string;
}> {
  const profile = storage.getProfile();
  if (!isPumpDeliveryMethod(profile?.insulinDeliveryMethod)) return [];

  const notif = storage.getNotificationSettings();
  if (!notif.enabled || notif.pumpChangeReminders === false) return [];

  const supplies = storage
    .getSupplies()
    .filter((s) => (s.type === "infusion_set" || s.type === "reservoir") && s.activeItemStartDate);

  const horizon = addDays(now, PUMP_CHANGE_LOOKAHEAD_DAYS);
  const slots: Array<{
    supplyId: string;
    kind: PumpChangeKind;
    dueDayKey: string;
    at: Date;
    title: string;
    body: string;
  }> = [];

  for (const s of supplies) {
    const kind = s.type as PumpChangeKind;
    const at = nextPumpChangeReminderAt(s, now);
    if (!at || at > horizon) continue;
    const dueDayKey = format(startOfDay(at), "yyyy-MM-dd");
    const copy = pumpChangeReminderCopy(kind);
    slots.push({
      supplyId: s.id,
      kind,
      dueDayKey,
      at,
      title: copy.title,
      body: copy.body,
    });
  }

  return slots;
}

export function allPumpChangeNotificationIds(now: Date = new Date()): number[] {
  const ids = new Set<number>();
  const supplies = storage
    .getSupplies()
    .filter((s) => s.type === "infusion_set" || s.type === "reservoir");
  for (const s of supplies) {
    for (let d = 0; d <= PUMP_CHANGE_LOOKAHEAD_DAYS; d++) {
      const dayKey = format(addDays(startOfDay(now), d), "yyyy-MM-dd");
      ids.add(notificationIdForPumpChange(s.id, dayKey));
    }
  }
  return [...ids];
}

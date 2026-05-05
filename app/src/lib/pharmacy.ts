import {
  PHARMACY_DAY_KEYS,
  type Pharmacy,
  type PharmacyDayKey,
  type PharmacyHoursDay,
} from "./storage";

/**
 * Pharmacy opening-hours helpers used by `PharmacyCard` and
 * `getSmartPrescriptionAdvice` to surface realistic "collect by" deadlines.
 *
 * Timezone (v1): everything is computed in the JavaScript `Date` instance's
 * local time. For UK users on UK devices this means Europe/London with BST
 * automatically applied. Bank holidays are not modelled — out of scope for v1.
 */

const FULL_DAY_LABELS: Record<PharmacyDayKey, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

const SHORT_DAY_LABELS: Record<PharmacyDayKey, string> = {
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
  sun: "Sun",
};

/** JS `Date#getDay()` returns 0=Sun..6=Sat; map back to our keys. */
const JS_DAY_TO_KEY: PharmacyDayKey[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

export function pharmacyDayKeyForDate(date: Date): PharmacyDayKey {
  return JS_DAY_TO_KEY[date.getDay()];
}

export function pharmacyDayLabel(key: PharmacyDayKey, style: "full" | "short" = "full"): string {
  return style === "short" ? SHORT_DAY_LABELS[key] : FULL_DAY_LABELS[key];
}

/** Parse `HH:mm` to total minutes, or null if invalid. */
function parseHHmm(value: string | undefined | null): number | null {
  if (!value) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const h = Number.parseInt(m[1], 10);
  const min = Number.parseInt(m[2], 10);
  if (!Number.isFinite(h) || !Number.isFinite(min)) return null;
  if (h < 0 || h > 24) return null;
  if (min < 0 || min > 59) return null;
  if (h === 24 && min !== 0) return null;
  return h * 60 + min;
}

function dateMinutes(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

/**
 * Continuous open intervals for the given weekday, expressed as `[startMin, endMin]` pairs
 * (closed-open: opens at start, shuts at end). An optional break splits the window.
 *
 * Returns an empty array if the day is closed or hours are missing/invalid.
 */
export function pharmacyOpenIntervalsForDay(
  day: PharmacyHoursDay | undefined,
): Array<{ start: number; end: number }> {
  if (!day || day.closed) return [];
  const open = parseHHmm(day.open);
  const close = parseHHmm(day.close);
  if (open == null || close == null) return [];
  if (close <= open) return [];

  const breakStart = parseHHmm(day.break?.start);
  const breakEnd = parseHHmm(day.break?.end);
  if (
    breakStart != null &&
    breakEnd != null &&
    breakEnd > breakStart &&
    breakStart > open &&
    breakEnd < close
  ) {
    return [
      { start: open, end: breakStart },
      { start: breakEnd, end: close },
    ];
  }
  return [{ start: open, end: close }];
}

/** True when `now` is inside any open interval on its weekday. */
export function isPharmacyOpenAt(p: Pharmacy, now: Date): boolean {
  const dayKey = pharmacyDayKeyForDate(now);
  const intervals = pharmacyOpenIntervalsForDay(p.hours[dayKey]);
  if (intervals.length === 0) return false;
  const m = dateMinutes(now);
  return intervals.some((iv) => m >= iv.start && m < iv.end);
}

function setLocalMinutes(date: Date, totalMinutes: number): Date {
  const out = new Date(date);
  out.setHours(0, 0, 0, 0);
  out.setMinutes(totalMinutes);
  return out;
}

function addLocalDays(date: Date, days: number): Date {
  const out = new Date(date);
  out.setDate(out.getDate() + days);
  return out;
}

function startOfLocalDay(date: Date): Date {
  const out = new Date(date);
  out.setHours(0, 0, 0, 0);
  return out;
}

/**
 * Next pharmacy opening at or after `now` (skipping closed days). Returns null when
 * no day in the next 14 days has any opening hours configured.
 */
export function nextPharmacyOpeningAt(p: Pharmacy, now: Date): Date | null {
  for (let offset = 0; offset < 14; offset++) {
    const target = addLocalDays(now, offset);
    const key = pharmacyDayKeyForDate(target);
    const intervals = pharmacyOpenIntervalsForDay(p.hours[key]);
    if (intervals.length === 0) continue;
    const m = offset === 0 ? dateMinutes(now) : 0;
    for (const iv of intervals) {
      if (m < iv.end) {
        const startMinutes = Math.max(m, iv.start);
        return setLocalMinutes(target, startMinutes);
      }
    }
  }
  return null;
}

/**
 * Latest open interval that ends at or before `deadline`. Used to suggest a realistic
 * "collect by" date when the natural deadline (today + days remaining) is on a closed
 * day. Returns null if no open day is found in the preceding 14 days.
 *
 * The returned `start` / `end` are absolute Dates pinned to local midnight + minutes.
 */
export function latestPharmacyWindowEndingBefore(
  p: Pharmacy,
  deadline: Date,
): { start: Date; end: Date } | null {
  for (let offset = 0; offset < 14; offset++) {
    const target = addLocalDays(deadline, -offset);
    const key = pharmacyDayKeyForDate(target);
    const intervals = pharmacyOpenIntervalsForDay(p.hours[key]);
    if (intervals.length === 0) continue;
    const lastIv = intervals[intervals.length - 1];
    const targetIsDeadlineDay =
      startOfLocalDay(target).getTime() === startOfLocalDay(deadline).getTime();
    const cutoff = targetIsDeadlineDay ? dateMinutes(deadline) : 24 * 60;
    if (lastIv.end <= cutoff) {
      return {
        start: setLocalMinutes(target, lastIv.start),
        end: setLocalMinutes(target, lastIv.end),
      };
    }
    if (lastIv.start < cutoff && cutoff < lastIv.end) {
      return {
        start: setLocalMinutes(target, lastIv.start),
        end: setLocalMinutes(target, cutoff),
      };
    }
    if (intervals.length > 1) {
      const earlier = intervals[0];
      if (earlier.end <= cutoff) {
        return {
          start: setLocalMinutes(target, earlier.start),
          end: setLocalMinutes(target, earlier.end),
        };
      }
    }
  }
  return null;
}

/** Has the user actually configured any opening hours? Avoids treating a half-empty record as usable. */
export function pharmacyHasAnyHours(p: Pharmacy | null | undefined): boolean {
  if (!p) return false;
  for (const key of PHARMACY_DAY_KEYS) {
    if (pharmacyOpenIntervalsForDay(p.hours[key]).length > 0) return true;
  }
  return false;
}

export function formatPharmacyHHmm(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * UK-friendly "today" line, e.g. "Open until 18:00", "Closed — opens Mon 09:00",
 * "Closed today". Returns null if no hours are configured at all.
 */
export function describePharmacyStatus(
  p: Pharmacy | null | undefined,
  now: Date = new Date(),
): { open: boolean; line: string } | null {
  if (!p || !pharmacyHasAnyHours(p)) return null;
  const todayKey = pharmacyDayKeyForDate(now);
  const intervals = pharmacyOpenIntervalsForDay(p.hours[todayKey]);
  const m = dateMinutes(now);

  const currentInterval = intervals.find((iv) => m >= iv.start && m < iv.end);
  if (currentInterval) {
    return { open: true, line: `Open until ${formatPharmacyHHmm(currentInterval.end)}` };
  }

  const nextOpen = nextPharmacyOpeningAt(p, now);
  if (!nextOpen) return { open: false, line: "Closed" };
  const nextKey = pharmacyDayKeyForDate(nextOpen);
  const nextMin = dateMinutes(nextOpen);
  const startOfToday = startOfLocalDay(now).getTime();
  const startOfNext = startOfLocalDay(nextOpen).getTime();
  if (startOfNext === startOfToday) {
    return { open: false, line: `Closed — opens ${formatPharmacyHHmm(nextMin)}` };
  }
  if (startOfNext === addLocalDays(startOfLocalDay(now), 1).getTime()) {
    return { open: false, line: `Closed — opens tomorrow ${formatPharmacyHHmm(nextMin)}` };
  }
  return {
    open: false,
    line: `Closed — opens ${pharmacyDayLabel(nextKey, "short")} ${formatPharmacyHHmm(nextMin)}`,
  };
}

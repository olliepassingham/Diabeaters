import { CGM_HISTORY_RETENTION_DAYS } from "@/lib/cgm/cgm-history-store";
import type { BedtimeLog } from "@/lib/storage";

/** Default assumed sleep duration when estimating overnight window. */
export const BEDTIME_DEFAULT_SLEEP_HOURS = 8;

export type BedtimeSleepWindow = {
  startMs: number;
  endMs: number;
  startIso: string;
  endIso: string;
  /** Hours from check to estimated sleep start (0 = at check time). */
  hoursUntilSleep: number;
};

/**
 * Estimate sleep window from a bedtime check: check time + "sleep in" offset → +8h asleep.
 */
export function computeBedtimeSleepWindow(
  log: Pick<BedtimeLog, "date" | "hoursUntilSleep">,
  sleepHours = BEDTIME_DEFAULT_SLEEP_HOURS,
): BedtimeSleepWindow | null {
  const checkMs = new Date(log.date).getTime();
  if (!Number.isFinite(checkMs)) return null;

  const hoursUntilSleep =
    typeof log.hoursUntilSleep === "number" && Number.isFinite(log.hoursUntilSleep)
      ? Math.max(0, log.hoursUntilSleep)
      : 0;

  const startMs = checkMs + hoursUntilSleep * 60 * 60 * 1000;
  const endMs = startMs + sleepHours * 60 * 60 * 1000;
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return null;

  return {
    startMs,
    endMs,
    startIso: new Date(startMs).toISOString(),
    endIso: new Date(endMs).toISOString(),
    hoursUntilSleep,
  };
}

/**
 * Calendar day a bedtime check counts toward for streaks / “already done tonight”.
 * Checks after midnight (before 5am local) still belong to the previous evening’s night —
 * so a late check before sleep does not break the streak.
 */
export const BEDTIME_STREAK_DAY_CUTOFF_HOUR = 5;

export function toBedtimeStreakDayKey(
  atIso: string,
  hoursUntilSleep?: number | null,
): string | null {
  const checkMs = new Date(atIso).getTime();
  if (!Number.isFinite(checkMs)) return null;

  const until =
    typeof hoursUntilSleep === "number" && Number.isFinite(hoursUntilSleep)
      ? Math.max(0, hoursUntilSleep)
      : 0;
  const sleepStart = new Date(checkMs + until * 60 * 60 * 1000);
  if (!Number.isFinite(sleepStart.getTime())) return null;

  if (sleepStart.getHours() < BEDTIME_STREAK_DAY_CUTOFF_HOUR) {
    sleepStart.setDate(sleepStart.getDate() - 1);
  }

  const y = sleepStart.getFullYear();
  const m = String(sleepStart.getMonth() + 1).padStart(2, "0");
  const d = String(sleepStart.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Most recent log whose estimated sleep window has fully ended (for morning review). */
export function findReviewableBedtimeLog(logs: BedtimeLog[], nowMs = Date.now()): BedtimeLog | null {
  const sorted = [...logs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  for (const log of sorted) {
    const window = computeBedtimeSleepWindow(log);
    if (!window) continue;
    if (window.endMs <= nowMs) return log;
  }
  return null;
}

/** Fallback when no bedtime log: last completed ~8h block ending at the most recent 7:00 local. */
export function inferCalendarSleepWindow(nowMs = Date.now()): BedtimeSleepWindow {
  const end = new Date(nowMs);
  end.setHours(7, 0, 0, 0);
  if (end.getTime() > nowMs) {
    end.setDate(end.getDate() - 1);
  }
  const start = new Date(end.getTime() - BEDTIME_DEFAULT_SLEEP_HOURS * 60 * 60 * 1000);
  return {
    startMs: start.getTime(),
    endMs: end.getTime(),
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    hoursUntilSleep: 0,
  };
}

export type OvernightReviewTarget = {
  log: BedtimeLog | null;
  window: BedtimeSleepWindow;
  /** Log-based window vs calendar estimate when no completed check exists. */
  source: "bedtime_log" | "calendar_fallback";
};

/**
 * Newest finished night first. Index 0 matches `resolveOvernightReviewTarget`.
 * Later entries are earlier completed bedtime checks whose sleep window still
 * falls inside the on-device CGM history (14 days). One check per night.
 */
export function listOvernightReviewNights(logs: BedtimeLog[], nowMs = Date.now()): OvernightReviewTarget[] {
  const latest = resolveOvernightReviewTarget(logs, nowMs);
  if (!latest) return [];

  const cutoff = nowMs - CGM_HISTORY_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const nights: OvernightReviewTarget[] = [latest];
  const seenDays = new Set<string>();
  if (latest.log) {
    const latestDay = toBedtimeStreakDayKey(latest.log.date, latest.log.hoursUntilSleep);
    if (latestDay) seenDays.add(latestDay);
  }

  const sorted = [...logs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  for (const log of sorted) {
    if (latest.log && log.id === latest.log.id) continue;
    const window = computeBedtimeSleepWindow(log);
    if (!window || window.endMs > nowMs || window.endMs <= cutoff) continue;
    const dayKey = toBedtimeStreakDayKey(log.date, log.hoursUntilSleep);
    if (dayKey && seenDays.has(dayKey)) continue;
    if (dayKey) seenDays.add(dayKey);
    nights.push({ log, window, source: "bedtime_log" });
  }
  return nights;
}

/** "Last night" for the newest review, otherwise a short weekday such as "Tue night". */
export function overnightNightTitle(nightIndex: number, window: BedtimeSleepWindow | null | undefined): string {
  if (nightIndex <= 0 || !window) return "Last night";
  const weekday = new Date(window.startMs).toLocaleDateString(undefined, { weekday: "short" });
  return `${weekday} night`;
}

/** Pick the best overnight window: prefer a completed bedtime check, else last calendar night. */
export function resolveOvernightReviewTarget(logs: BedtimeLog[], nowMs = Date.now()): OvernightReviewTarget | null {
  const log = findReviewableBedtimeLog(logs, nowMs);
  if (log) {
    const window = computeBedtimeSleepWindow(log);
    if (window && window.endMs <= nowMs) {
      return { log, window, source: "bedtime_log" };
    }
  }
  const calendar = inferCalendarSleepWindow(nowMs);
  if (calendar.endMs > nowMs) return null;
  return { log: null, window: calendar, source: "calendar_fallback" };
}

export function formatSleepWindowLabel(startMs: number, endMs: number): string {
  const fmt = (ms: number) =>
    new Date(ms).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${fmt(startMs)} – ${fmt(endMs)}`;
}

/** Local-hour morning window for the home Today card (after night hours, before noon). */
export const BEDTIME_MORNING_HOME_START_HOUR = 6;
export const BEDTIME_MORNING_HOME_END_HOUR = 12;
/** Don't surface a readiness score for a night that ended more than this long ago. */
export const BEDTIME_MORNING_HOME_MAX_AGE_MS = 18 * 60 * 60 * 1000;

export function isBedtimeMorningHomeWindow(nowMs = Date.now()): boolean {
  const hour = new Date(nowMs).getHours();
  return hour >= BEDTIME_MORNING_HOME_START_HOUR && hour < BEDTIME_MORNING_HOME_END_HOUR;
}

/**
 * Last night's bedtime check for the home Today card: only during local morning,
 * only when the sleep window has ended recently enough that "last night" still applies.
 */
export function findMorningHomeBedtimeLog(logs: BedtimeLog[], nowMs = Date.now()): BedtimeLog | null {
  if (!isBedtimeMorningHomeWindow(nowMs)) return null;
  const log = findReviewableBedtimeLog(logs, nowMs);
  if (!log) return null;
  const window = computeBedtimeSleepWindow(log);
  if (!window) return null;
  if (nowMs - window.endMs > BEDTIME_MORNING_HOME_MAX_AGE_MS) return null;
  return log;
}

export function bedtimeReadinessLabel(level: BedtimeLog["readinessLevel"]): string {
  switch (level) {
    case "steady":
      return "Steady";
    case "monitor":
      return "Monitor";
    case "alert":
      return "Alert";
  }
}

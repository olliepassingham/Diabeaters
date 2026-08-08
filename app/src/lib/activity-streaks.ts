import { addDays, format, startOfDay, subDays } from "date-fns";

import {
  filterActivityEvents,
  toActivityDayKey,
  type ActivityEvent,
  type ActivityKind,
} from "@/lib/activity-history";
import { toBedtimeStreakDayKey } from "@/lib/bedtime-overnight-window";
import { storage } from "@/lib/storage";

/** Tool categories that earn streaks and achievements (excludes hypos and reactive tools). */
export type StreakTrackKind =
  | "bedtime_check"
  | "exercise_session"
  | "supply_event"
  | "appointment"
  | "scenario_started"
  | "adviser_session"
  | "app_check_in";

export const STREAK_TRACK_KINDS: StreakTrackKind[] = [
  "bedtime_check",
  "exercise_session",
  "supply_event",
  "appointment",
  "scenario_started",
  "adviser_session",
  "app_check_in",
];

export type StreakStats = {
  kind: StreakTrackKind;
  current: number;
  best: number;
  /** Day keys in the active current streak (newest first). */
  currentRunDayKeys: string[];
};

function eventsForStreakKind(events: ActivityEvent[], kind: StreakTrackKind): ActivityEvent[] {
  if (kind === "supply_event") {
    return filterActivityEvents(events, "supply_event");
  }
  if (kind === "scenario_started") {
    return events.filter((e) => e.kind === "scenario_started" || e.kind === "scenario_ended");
  }
  return events.filter((e) => e.kind === kind);
}

/** Calendar days (yyyy-MM-dd) with at least one qualifying event for the streak kind. */
export function qualifyingDayKeysForKind(
  events: ActivityEvent[],
  kind: StreakTrackKind,
): Set<string> {
  if (kind === "app_check_in") {
    return new Set(storage.getAppCheckInDayKeys());
  }
  // Bedtime streaks follow “night belonging”, not strict calendar midnight.
  if (kind === "bedtime_check") {
    const keys = new Set<string>();
    for (const log of storage.getBedtimeLogs()) {
      const key = toBedtimeStreakDayKey(log.date, log.hoursUntilSleep);
      if (key) keys.add(key);
    }
    // Fallback for activity events that are not mirrored in bedtime logs (tests / imports).
    if (keys.size === 0) {
      for (const e of eventsForStreakKind(events, kind)) {
        const key = toActivityDayKey(e.at);
        if (key) keys.add(key);
      }
    }
    return keys;
  }
  const keys = new Set<string>();
  for (const e of eventsForStreakKind(events, kind)) {
    const key = toActivityDayKey(e.at);
    if (key) keys.add(key);
  }
  return keys;
}

function dayKeyFromDate(d: Date): string {
  return format(startOfDay(d), "yyyy-MM-dd");
}

function computeBestStreak(sortedDayKeys: string[]): number {
  if (sortedDayKeys.length === 0) return 0;
  let best = 1;
  let run = 1;
  for (let i = 1; i < sortedDayKeys.length; i++) {
    const prev = sortedDayKeys[i - 1]!;
    const cur = sortedDayKeys[i]!;
    const prevDate = startOfDay(new Date(`${prev}T12:00:00`));
    const curDate = startOfDay(new Date(`${cur}T12:00:00`));
    const expectedPrev = addDays(curDate, 1);
    if (dayKeyFromDate(expectedPrev) === prev) {
      run += 1;
      best = Math.max(best, run);
    } else {
      run = 1;
    }
  }
  return best;
}

function computeCurrentStreak(dayKeys: Set<string>, today: Date): { current: number; runKeys: string[] } {
  if (dayKeys.size === 0) return { current: 0, runKeys: [] };

  const todayKey = dayKeyFromDate(today);
  const yesterdayKey = dayKeyFromDate(subDays(today, 1));

  let cursorKey: string | null = null;
  if (dayKeys.has(todayKey)) {
    cursorKey = todayKey;
  } else if (dayKeys.has(yesterdayKey)) {
    cursorKey = yesterdayKey;
  } else {
    return { current: 0, runKeys: [] };
  }

  const runKeys: string[] = [];
  let current = 0;
  while (cursorKey && dayKeys.has(cursorKey)) {
    runKeys.push(cursorKey);
    current += 1;
    const d = startOfDay(new Date(`${cursorKey}T12:00:00`));
    cursorKey = dayKeyFromDate(subDays(d, 1));
  }

  return { current, runKeys };
}

export function computeStreakStats(
  events: ActivityEvent[],
  kind: StreakTrackKind,
  today: Date = new Date(),
): StreakStats {
  const dayKeys = qualifyingDayKeysForKind(events, kind);
  const sortedAsc = [...dayKeys].sort();
  const { current, runKeys } = computeCurrentStreak(dayKeys, today);
  const best = Math.max(computeBestStreak(sortedAsc), current);

  return {
    kind,
    current,
    best,
    currentRunDayKeys: runKeys,
  };
}

export function computeAllStreakStats(
  events: ActivityEvent[],
  today: Date = new Date(),
): StreakStats[] {
  return STREAK_TRACK_KINDS.map((kind) => computeStreakStats(events, kind, today));
}

/** Day keys where bedtime and exercise both qualify (for optional combo achievements). */
export function qualifyingBalancedDayKeys(events: ActivityEvent[]): Set<string> {
  const bedtime = qualifyingDayKeysForKind(events, "bedtime_check");
  const exercise = qualifyingDayKeysForKind(events, "exercise_session");
  const out = new Set<string>();
  for (const key of bedtime) {
    if (exercise.has(key)) out.add(key);
  }
  return out;
}

export function streakKindLabel(kind: StreakTrackKind): string {
  const labels: Record<StreakTrackKind, string> = {
    bedtime_check: "Bedtime",
    exercise_session: "Exercise",
    supply_event: "Supplies",
    appointment: "Clinic",
    scenario_started: "Guides",
    adviser_session: "Meal planner",
    app_check_in: "Showing up",
  };
  return labels[kind];
}

export function isStreakFilterKind(
  kind: ActivityKind | StreakTrackKind | "all",
): kind is StreakTrackKind {
  return kind !== "all" && (STREAK_TRACK_KINDS as readonly string[]).includes(kind);
}

/** Streak stats from a precomputed set of qualifying day keys (e.g. balanced combo days). */
export function computeStreakStatsFromDayKeys(
  dayKeys: Set<string>,
  kind: StreakTrackKind,
  today: Date = new Date(),
): StreakStats {
  const sortedAsc = [...dayKeys].sort();
  const { current, runKeys } = computeCurrentStreak(dayKeys, today);
  const best = Math.max(computeBestStreak(sortedAsc), current);

  return {
    kind,
    current,
    best,
    currentRunDayKeys: runKeys,
  };
}

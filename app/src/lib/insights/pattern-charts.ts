import { formatHourLabel } from "@/lib/insights/pattern-insights";

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export type ComparisonBucket = {
  /** Stable key for the bucket (hour-of-day start, or weekday index). */
  key: number;
  label: string;
  /** Count within the most recent period. */
  currentCount: number;
  /** Count within the equivalent-length period immediately before that. */
  previousCount: number;
};

export type WeeklyTrendPoint = {
  weekStartMs: number;
  label: string;
  hypoCount: number;
  exerciseCount: number;
};

function inWindow(ms: number, fromMs: number, toMs: number): boolean {
  return ms >= fromMs && ms < toMs;
}

function validTimes(dates: Date[]): number[] {
  return dates.map((d) => d.getTime()).filter((t) => Number.isFinite(t));
}

/**
 * Three-hour-of-day buckets (8 total, matching the granularity used by the
 * "pattern in your low times" insight) comparing the most recent `periodDays`
 * against the equivalent-length period immediately before it.
 */
export function computeHourlyHypoComparison(
  hypoDates: Date[],
  now: Date,
  periodDays = 30,
): ComparisonBucket[] {
  const nowMs = now.getTime();
  const periodMs = periodDays * DAY_MS;
  const currentFrom = nowMs - periodMs;
  const previousFrom = nowMs - 2 * periodMs;

  const buckets: ComparisonBucket[] = Array.from({ length: 8 }, (_, i) => {
    const startHour = i * 3;
    return {
      key: startHour,
      label: `${formatHourLabel(startHour)}–${formatHourLabel(startHour + 3)}`,
      currentCount: 0,
      previousCount: 0,
    };
  });

  for (const t of validTimes(hypoDates)) {
    const bucketIndex = Math.floor(new Date(t).getHours() / 3);
    const bucket = buckets[bucketIndex];
    if (!bucket) continue;
    if (inWindow(t, currentFrom, nowMs)) bucket.currentCount += 1;
    else if (inWindow(t, previousFrom, currentFrom)) bucket.previousCount += 1;
  }

  return buckets;
}

/**
 * Day-of-week buckets comparing the most recent `periodDays` (default 42,
 * matching the weekday-cluster insight) against the equivalent period before.
 */
export function computeWeekdayHypoComparison(
  hypoDates: Date[],
  now: Date,
  periodDays = 42,
): ComparisonBucket[] {
  const nowMs = now.getTime();
  const periodMs = periodDays * DAY_MS;
  const currentFrom = nowMs - periodMs;
  const previousFrom = nowMs - 2 * periodMs;

  const buckets: ComparisonBucket[] = WEEKDAY_NAMES.map((name, i) => ({
    key: i,
    label: name,
    currentCount: 0,
    previousCount: 0,
  }));

  for (const t of validTimes(hypoDates)) {
    const bucket = buckets[new Date(t).getDay()];
    if (!bucket) continue;
    if (inWindow(t, currentFrom, nowMs)) bucket.currentCount += 1;
    else if (inWindow(t, previousFrom, currentFrom)) bucket.previousCount += 1;
  }

  return buckets;
}

/** Start-of-week (Sunday, local time) for the calendar week containing `ms`. */
function startOfWeekMs(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d.getTime();
}

/**
 * Weekly hypo counts (with exercise-session counts alongside, for visual
 * correlation) over the last `weeks` calendar weeks, oldest first.
 */
export function computeWeeklyTrend(
  hypoDates: Date[],
  exerciseDates: Date[],
  now: Date,
  weeks = 12,
): WeeklyTrendPoint[] {
  const currentWeekStart = startOfWeekMs(now.getTime());
  const points: WeeklyTrendPoint[] = Array.from({ length: weeks }, (_, i) => {
    const weekStartMs = currentWeekStart - (weeks - 1 - i) * 7 * DAY_MS;
    const d = new Date(weekStartMs);
    return {
      weekStartMs,
      label: d.toLocaleDateString(undefined, { day: "numeric", month: "short" }),
      hypoCount: 0,
      exerciseCount: 0,
    };
  });

  const bucketFor = (ms: number): WeeklyTrendPoint | undefined => {
    const weekStartMs = startOfWeekMs(ms);
    return points.find((p) => p.weekStartMs === weekStartMs);
  };

  for (const t of validTimes(hypoDates)) {
    const bucket = bucketFor(t);
    if (bucket) bucket.hypoCount += 1;
  }
  for (const t of validTimes(exerciseDates)) {
    const bucket = bucketFor(t);
    if (bucket) bucket.exerciseCount += 1;
  }

  return points;
}

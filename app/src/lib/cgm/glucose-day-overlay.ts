import type { BgUnits } from "@/lib/cgm/types";
import { convertGlucoseValue } from "@/lib/cgm/units";
import type { CgmHistoryPoint } from "@/lib/cgm/cgm-history-store";

const MINUTES_PER_DAY = 24 * 60;

/** A single point on a day's line, minutes since local midnight (0–1440) and value in user units. */
export type OverlayPoint = { minuteOfDay: number; value: number };

export type GlucoseDaySeries = {
  /** Local calendar date, e.g. "2026-07-22". */
  dateKey: string;
  label: string;
  isMostRecent: boolean;
  /** Broken into separate runs wherever the gap between readings exceeds the gap threshold. */
  segments: OverlayPoint[][];
};

/** Which calendar days to include in the overlay. */
export type GlucoseDayKind = "all" | "weekdays" | "weekends";

export type GlucoseDayOverlayOptions = {
  days?: number;
  now?: Date;
  gapMinutes?: number;
  /** Inclusive start minute of day [0, 1440). Default 0. */
  minuteStart?: number;
  /** Exclusive end minute of day (0, 1440]. Default 1440. */
  minuteEnd?: number;
  /** Filter to weekdays, weekends, or all days. Default all. */
  dayKind?: GlucoseDayKind;
};

/** Preset time-of-day windows for the Patterns filters. */
export const GLUCOSE_TIME_WINDOWS = [
  { id: "all", label: "All day", minuteStart: 0, minuteEnd: MINUTES_PER_DAY },
  { id: "night", label: "Night", minuteStart: 0, minuteEnd: 6 * 60 },
  { id: "morning", label: "Morning", minuteStart: 6 * 60, minuteEnd: 12 * 60 },
  { id: "afternoon", label: "Afternoon", minuteStart: 12 * 60, minuteEnd: 18 * 60 },
  { id: "evening", label: "Evening", minuteStart: 18 * 60, minuteEnd: MINUTES_PER_DAY },
] as const;

export type GlucoseTimeWindowId = (typeof GLUCOSE_TIME_WINDOWS)[number]["id"];

export function glucoseTimeWindowById(id: GlucoseTimeWindowId): {
  minuteStart: number;
  minuteEnd: number;
} {
  return GLUCOSE_TIME_WINDOWS.find((w) => w.id === id) ?? GLUCOSE_TIME_WINDOWS[0];
}

function dateKeyFor(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function localMidnightMs(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function labelForDayOffset(dayOffsetFromToday: number, ms: number): string {
  if (dayOffsetFromToday === 0) return "Today";
  if (dayOffsetFromToday === 1) return "Yesterday";
  return new Date(ms).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

function matchesDayKind(midnightMs: number, dayKind: GlucoseDayKind): boolean {
  if (dayKind === "all") return true;
  const day = new Date(midnightMs).getDay(); // 0 Sun … 6 Sat
  const isWeekend = day === 0 || day === 6;
  return dayKind === "weekends" ? isWeekend : !isWeekend;
}

/**
 * Group local glucose history into one series per local calendar day, each
 * split into gap-broken segments (so periods the app wasn't open — and so we
 * have no reading — don't draw a false flat line) and positioned on a shared
 * 0–1440 minute-of-day axis for overlay plotting.
 *
 * Days with no readings at all (or none inside the optional time window) are
 * omitted. Returned oldest first, so a chart can paint older (more muted) days
 * first and the most recent day last/on top.
 */
export function buildGlucoseDayOverlay(
  points: CgmHistoryPoint[],
  units: BgUnits,
  options: GlucoseDayOverlayOptions = {},
): GlucoseDaySeries[] {
  const days = options.days ?? 7;
  const now = options.now ?? new Date();
  const gapMs = (options.gapMinutes ?? 20) * 60_000;
  const minuteStart = Math.max(0, Math.min(MINUTES_PER_DAY, options.minuteStart ?? 0));
  const minuteEnd = Math.max(minuteStart + 1, Math.min(MINUTES_PER_DAY, options.minuteEnd ?? MINUTES_PER_DAY));
  const dayKind = options.dayKind ?? "all";

  const todayMidnight = localMidnightMs(now.getTime());
  const earliestMidnight = todayMidnight - (days - 1) * 24 * 60 * 60 * 1000;

  const byDay = new Map<string, CgmHistoryPoint[]>();
  for (const point of points) {
    if (point.recordedAtMs < earliestMidnight || point.recordedAtMs > now.getTime()) continue;
    const midnightMs = localMidnightMs(point.recordedAtMs);
    if (!matchesDayKind(midnightMs, dayKind)) continue;
    const minuteOfDay = (point.recordedAtMs - midnightMs) / 60_000;
    if (minuteOfDay < minuteStart || minuteOfDay >= minuteEnd) continue;
    const key = dateKeyFor(point.recordedAtMs);
    const bucket = byDay.get(key);
    if (bucket) bucket.push(point);
    else byDay.set(key, [point]);
  }

  const series: GlucoseDaySeries[] = [];
  for (const [dateKey, dayPoints] of byDay) {
    const sorted = [...dayPoints].sort((a, b) => a.recordedAtMs - b.recordedAtMs);
    const midnightMs = localMidnightMs(sorted[0]!.recordedAtMs);
    const dayOffset = Math.round((todayMidnight - midnightMs) / (24 * 60 * 60 * 1000));

    const segments: OverlayPoint[][] = [];
    let current: OverlayPoint[] = [];
    let prevMs: number | null = null;
    for (const point of sorted) {
      if (prevMs != null && point.recordedAtMs - prevMs > gapMs) {
        if (current.length > 0) segments.push(current);
        current = [];
      }
      const minuteOfDay = Math.min(MINUTES_PER_DAY, (point.recordedAtMs - midnightMs) / 60_000);
      current.push({ minuteOfDay, value: convertGlucoseValue(point.valueMgDl, "mg/dL", units) });
      prevMs = point.recordedAtMs;
    }
    if (current.length > 0) segments.push(current);

    series.push({
      dateKey,
      label: labelForDayOffset(dayOffset, midnightMs),
      isMostRecent: dayOffset === 0,
      segments,
    });
  }

  return series.sort((a, b) => (a.dateKey < b.dateKey ? -1 : a.dateKey > b.dateKey ? 1 : 0));
}

/** Distinct local-calendar days represented in `series` (helper for empty/building-state copy). */
export function glucoseDayOverlayDayCount(series: GlucoseDaySeries[]): number {
  return series.length;
}

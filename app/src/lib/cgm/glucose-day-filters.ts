import {
  GLUCOSE_TIME_WINDOWS,
  glucoseTimeWindowById,
  type GlucoseDayKind,
  type GlucoseTimeWindowId,
} from "@/lib/cgm/glucose-day-overlay";

const STORAGE_KEY = "diabeater_glucose_day_filters_v1";

export type GlucoseDayRange = 3 | 7 | 14;

export type GlucoseDayFilters = {
  dayRange: GlucoseDayRange;
  timeWindowId: GlucoseTimeWindowId;
  dayKind: GlucoseDayKind;
};

export const DEFAULT_GLUCOSE_DAY_FILTERS: GlucoseDayFilters = {
  dayRange: 7,
  timeWindowId: "all",
  dayKind: "all",
};

const DAY_RANGES: GlucoseDayRange[] = [3, 7, 14];
const DAY_KINDS: GlucoseDayKind[] = ["all", "weekdays", "weekends"];
const TIME_WINDOW_IDS = GLUCOSE_TIME_WINDOWS.map((w) => w.id);

function isDayRange(value: unknown): value is GlucoseDayRange {
  return typeof value === "number" && (DAY_RANGES as number[]).includes(value);
}

function isTimeWindowId(value: unknown): value is GlucoseTimeWindowId {
  return typeof value === "string" && (TIME_WINDOW_IDS as string[]).includes(value);
}

function isDayKind(value: unknown): value is GlucoseDayKind {
  return typeof value === "string" && (DAY_KINDS as string[]).includes(value);
}

/** Read the last filters the user set on Your patterns (defaults if unset/corrupt). */
export function readGlucoseDayFilters(): GlucoseDayFilters {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_GLUCOSE_DAY_FILTERS };
    const parsed = JSON.parse(raw) as Partial<GlucoseDayFilters>;
    return {
      dayRange: isDayRange(parsed.dayRange) ? parsed.dayRange : DEFAULT_GLUCOSE_DAY_FILTERS.dayRange,
      timeWindowId: isTimeWindowId(parsed.timeWindowId)
        ? parsed.timeWindowId
        : DEFAULT_GLUCOSE_DAY_FILTERS.timeWindowId,
      dayKind: isDayKind(parsed.dayKind) ? parsed.dayKind : DEFAULT_GLUCOSE_DAY_FILTERS.dayKind,
    };
  } catch {
    return { ...DEFAULT_GLUCOSE_DAY_FILTERS };
  }
}

/** Persist glucose pattern filters so the home widget mirrors the Patterns page. */
export function writeGlucoseDayFilters(filters: GlucoseDayFilters): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
  } catch {
    // ignore quota
  }
}

const DAY_KIND_LABELS: Record<GlucoseDayKind, string> = {
  all: "All days",
  weekdays: "Weekdays",
  weekends: "Weekends",
};

/**
 * Compact subtitle for the home widget / chart chrome, e.g. "7 days · Morning".
 * Omits "All day" / "All days" so the default view stays short.
 */
export function formatGlucoseDayFiltersSummary(filters: GlucoseDayFilters): string {
  const parts: string[] = [`${filters.dayRange} days`];
  if (filters.timeWindowId !== "all") {
    const window = GLUCOSE_TIME_WINDOWS.find((w) => w.id === filters.timeWindowId);
    parts.push(window?.label ?? filters.timeWindowId);
  }
  if (filters.dayKind !== "all") {
    parts.push(DAY_KIND_LABELS[filters.dayKind]);
  }
  return parts.join(" · ");
}

/** Resolve minute window + day kind for `buildGlucoseDayOverlay`. */
export function glucoseDayFiltersToOverlayOptions(filters: GlucoseDayFilters) {
  const window = glucoseTimeWindowById(filters.timeWindowId);
  return {
    days: filters.dayRange,
    minuteStart: window.minuteStart,
    minuteEnd: window.minuteEnd,
    dayKind: filters.dayKind,
  };
}

import type { DexcomShareGlucoseEntry } from "@/lib/cgm/dexcom-share-client";
import { mapDexcomShareTrend } from "@/lib/cgm/dexcom-share-client";
import type { LiveCgmGlucoseEntry } from "@/lib/cgm/live-cgm-history";
import { libreTrendToExerciseTrend } from "@/lib/cgm/libre-link-up-client";
import type { BgUnits } from "@/lib/cgm/types";
import { convertGlucoseValue } from "@/lib/cgm/units";
import type { ExerciseBgTrend } from "@/lib/storage";

export type CgmHistoryRange = "3h" | "12h" | "24h";

export const CGM_HISTORY_RANGES: {
  id: CgmHistoryRange;
  label: string;
  minutes: number;
  maxCount: number;
}[] = [
  { id: "3h", label: "3 hours", minutes: 180, maxCount: 48 },
  { id: "12h", label: "12 hours", minutes: 720, maxCount: 144 },
  { id: "24h", label: "24 hours", minutes: 1440, maxCount: 288 },
];

export type CgmChartPoint = {
  recordedAt: string;
  timeMs: number;
  timeLabel: string;
  value: number;
  /** Display units (mmol or mg/dL) — same as `value`. */
  trend: ExerciseBgTrend | null;
  /** Original mg/dL for calculations (projection, etc.). */
  valueMgDl?: number;
  /** Fine Dexcom/Libre trend token before UI collapse (e.g. singleup). */
  rawTrend?: string | null;
};

export function dexcomEntriesToChartPoints(
  entries: DexcomShareGlucoseEntry[],
  units: BgUnits,
  range: CgmHistoryRange,
): CgmChartPoint[] {
  return liveCgmEntriesToChartPoints(
    entries.map((e) => ({ valueMgDl: e.valueMgDl, recordedAt: e.recordedAt, trend: e.trend })),
    units,
    range,
    mapDexcomShareTrend,
  );
}

export function liveCgmEntriesToChartPoints(
  entries: LiveCgmGlucoseEntry[],
  units: BgUnits,
  range: CgmHistoryRange,
  mapTrend: (trend: string | null) => ExerciseBgTrend | null,
): CgmChartPoint[] {
  const compactTime = range === "3h";
  return entries.map((entry) => {
    const timeMs = new Date(entry.recordedAt).getTime();
    const value =
      units === "mmol/L"
        ? convertGlucoseValue(entry.valueMgDl, "mg/dL", "mmol/L")
        : Math.round(entry.valueMgDl);
    return {
      recordedAt: entry.recordedAt,
      timeMs,
      timeLabel: formatChartTimeLabel(timeMs, compactTime),
      value,
      trend: mapTrend(entry.trend),
      valueMgDl: entry.valueMgDl,
      rawTrend: entry.trend,
    };
  });
}

export function liveCgmHistoryToChartPoints(
  entries: LiveCgmGlucoseEntry[],
  units: BgUnits,
  range: CgmHistoryRange,
): CgmChartPoint[] {
  return liveCgmEntriesToChartPoints(entries, units, range, (trend) => {
    return mapDexcomShareTrend(trend) ?? libreTrendToExerciseTrend(trend);
  });
}

function formatChartTimeLabel(timeMs: number, compact: boolean): string {
  const d = new Date(timeMs);
  if (compact) {
    return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  }
  // Avoid locale forms like "9 Aug at 16:58" which collide on narrow charts.
  const day = d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
  const time = d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  return `${day} ${time}`;
}

/** Clock-style x-axis labels, matching the Patterns overlay chart (`12am`, `6pm`). */
export function formatCgmHistoryAxisLabel(timeMs: number): string {
  const h = new Date(timeMs).getHours();
  if (h === 0) return "12am";
  if (h === 12) return "12pm";
  return h < 12 ? `${h}am` : `${h - 12}pm`;
}

/**
 * Even local-hour ticks across a history window.
 * 3h → hourly, 12h → every 2 hours, 24h → every 4 hours.
 */
export function buildCgmHistoryAxisTicks(startMs: number, endMs: number): number[] {
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    return Number.isFinite(startMs) ? [startMs] : [];
  }
  const spanHours = (endMs - startMs) / 3_600_000;
  const stepHours = spanHours <= 4 ? 1 : spanHours <= 16 ? 2 : 4;

  const cursor = new Date(startMs);
  cursor.setMinutes(0, 0, 0);
  const rem = cursor.getHours() % stepHours;
  if (rem !== 0) {
    cursor.setHours(cursor.getHours() + (stepHours - rem));
  }
  if (cursor.getTime() < startMs) {
    cursor.setHours(cursor.getHours() + stepHours);
  }

  const ticks: number[] = [];
  while (cursor.getTime() <= endMs) {
    ticks.push(cursor.getTime());
    cursor.setHours(cursor.getHours() + stepHours);
  }
  return ticks;
}

export function chartYDomain(points: CgmChartPoint[], units: BgUnits, extraValues: number[] = []): [number, number] {
  if (points.length === 0 && extraValues.length === 0) {
    return units === "mmol/L" ? [3, 12] : [54, 216];
  }
  const values = [...points.map((p) => p.value), ...extraValues];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = units === "mmol/L" ? 0.8 : 15;
  return [Math.max(0, min - pad), max + pad];
}

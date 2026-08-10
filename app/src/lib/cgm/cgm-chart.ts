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
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function chartYDomain(points: CgmChartPoint[], units: BgUnits): [number, number] {
  if (points.length === 0) {
    return units === "mmol/L" ? [3, 12] : [54, 216];
  }
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = units === "mmol/L" ? 0.8 : 15;
  return [Math.max(0, min - pad), max + pad];
}

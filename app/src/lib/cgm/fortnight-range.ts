import {
  CGM_HISTORY_RETENTION_DAYS,
  type CgmHistoryPoint,
} from "@/lib/cgm/cgm-history-store";
import type { BgUnits } from "@/lib/cgm/types";
import { convertGlucoseValue } from "@/lib/cgm/units";
import { computeGlucoseWindowSummary, type GlucoseWindowSummary } from "@/lib/cgm/window-summary";

/** Readings a 5-minute CGM would produce in a full day. */
export const FORTNIGHT_SAMPLES_PER_DAY = 288;

/**
 * Clinic-style reports use about 14 days with at least 70% of expected samples.
 * Thinner history would turn a handful of readings into a misleading percent.
 */
export const FORTNIGHT_MIN_COVERAGE = 0.7;

/** Those samples also have to be spread across the fortnight, not piled into a few days. */
export const FORTNIGHT_MIN_DISTINCT_DAYS = 10;

export function fortnightSampleMinimum(days: number = CGM_HISTORY_RETENTION_DAYS): number {
  return Math.round(days * FORTNIGHT_SAMPLES_PER_DAY * FORTNIGHT_MIN_COVERAGE);
}

export function countDistinctLocalDays(points: { recordedAtMs: number }[]): number {
  const days = new Set<string>();
  for (const point of points) {
    const d = new Date(point.recordedAtMs);
    days.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
  }
  return days.size;
}

export function isFortnightDenseEnough(points: { recordedAtMs: number }[]): boolean {
  return (
    points.length >= fortnightSampleMinimum() &&
    countDistinctLocalDays(points) >= FORTNIGHT_MIN_DISTINCT_DAYS
  );
}

export type FortnightRangePicture = {
  summary: GlucoseWindowSummary;
  inRangePercent: number;
  belowPercent: number;
  abovePercent: number;
  veryLowPercent: number;
};

/** Null when the stored fortnight is too thin to describe. */
export function buildFortnightRangePicture(
  points: CgmHistoryPoint[],
  units: BgUnits,
  targetLow: number,
  targetHigh: number,
): FortnightRangePicture | null {
  if (!isFortnightDenseEnough(points)) return null;
  const values = points.map((point) => convertGlucoseValue(point.valueMgDl, "mg/dL", units));
  const summary = computeGlucoseWindowSummary(values, targetLow, targetHigh, units);
  if (!summary) return null;
  return {
    summary,
    inRangePercent: summary.percents.in_range,
    belowPercent: summary.percents.low + summary.percents.very_low,
    abovePercent: summary.percents.high + summary.percents.very_high,
    veryLowPercent: summary.percents.very_low,
  };
}

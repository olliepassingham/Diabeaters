import { cgmTrendForExercise } from "@/lib/cgm/apply-cgm-trend";
import type { BgPrefillResult } from "@/lib/cgm/prefill";
import type { ExerciseBgTrend } from "@/lib/storage";

/** Apply a CGM or manual prefill value (and trend when available) into exercise fields. */
export function applyCgmPrefillToExercise(
  prefill: BgPrefillResult,
  onBg: (value: string) => void,
  onTrend?: (trend: ExerciseBgTrend) => void,
): void {
  onBg(prefill.value);
  const trend = cgmTrendForExercise(prefill.reading?.trend);
  if (trend && onTrend) onTrend(trend);
}

/** Whether a reading is fresh enough to auto-fill without user confirmation. */
export function isFreshCgmPrefill(prefill: BgPrefillResult | null | undefined): boolean {
  return Boolean(prefill?.fromCgm && prefill.reading && !prefill.reading.isStale);
}

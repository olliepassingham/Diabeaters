export type ExerciseBgTrend = "rising" | "falling" | "flat" | "not_sure";

export type ExerciseCgmAlertReason = "below_threshold" | "falling_toward" | "clinical_hypo";

export type ExerciseCgmAlertEvaluation = {
  shouldAlert: boolean;
  reason?: ExerciseCgmAlertReason;
  carbLine?: string;
};

const EXERCISE_CGM_ALERT_COOLDOWN_MS = 12 * 60_000;

export function defaultExerciseLowThreshold(bgUnits: "mmol/L" | "mg/dL"): number {
  return bgUnits === "mg/dL" ? 100 : 5.6;
}

function exerciseApproachLowCeiling(lowThreshold: number, bgUnits: "mmol/L" | "mg/dL"): number {
  const margin = bgUnits === "mmol/L" ? 0.9 : 16;
  return lowThreshold + margin;
}

function isBgBelowHypoThreshold(
  bg: number,
  clinicalHypoThreshold: number | null | undefined,
  bgUnits: "mmol/L" | "mg/dL",
): boolean {
  const low = clinicalHypoThreshold;
  if (typeof low === "number" && low > 0) return bg < low;
  return bg < (bgUnits === "mg/dL" ? 70 : 3.9);
}

export function needsImmediateExerciseBgTreatment(input: {
  bg: number;
  bgUnits: "mmol/L" | "mg/dL";
  threshold: number;
  trend: ExerciseBgTrend | null;
  trendAware: boolean;
  clinicalHypoThreshold?: number | null;
}): boolean {
  const { bg, bgUnits, threshold, trend, trendAware, clinicalHypoThreshold } = input;
  if (isBgBelowHypoThreshold(bg, clinicalHypoThreshold, bgUnits)) return true;
  if (bg < threshold) return true;
  if (trendAware && trend === "falling" && bg < exerciseApproachLowCeiling(threshold, bgUnits)) return true;
  return false;
}

export function evaluateExerciseCgmAlert(input: {
  bg: number;
  bgUnits: "mmol/L" | "mg/dL";
  trend: ExerciseBgTrend | null;
  threshold: number;
  trendAware: boolean;
  clinicalHypoThreshold?: number | null;
  carbsIfLow?: number | null;
  carbLine?: string | null;
}): ExerciseCgmAlertEvaluation {
  const { bg, bgUnits, threshold, trendAware, clinicalHypoThreshold, carbsIfLow, carbLine } = input;
  const trend = trendAware ? input.trend : null;

  if (
    !needsImmediateExerciseBgTreatment({
      bg,
      bgUnits,
      threshold,
      trend,
      trendAware,
      clinicalHypoThreshold,
    })
  ) {
    return { shouldAlert: false };
  }

  const clinicalHypo = isBgBelowHypoThreshold(bg, clinicalHypoThreshold, bgUnits);
  let reason: ExerciseCgmAlertReason = "below_threshold";
  if (clinicalHypo) {
    reason = "clinical_hypo";
  } else if (bg >= threshold && trend === "falling" && trendAware) {
    reason = "falling_toward";
  }

  const carbs =
    typeof carbsIfLow === "number" && carbsIfLow > 0 ? Math.round(carbsIfLow) : null;
  const line = carbLine?.trim() || (carbs != null ? `about ${carbs}g fast carbs` : "fast carbs from your usual plan");

  return {
    shouldAlert: true,
    reason,
    carbLine: line,
  };
}

export function shouldSkipExerciseCgmAlertDueToCooldown(input: {
  lastAlertAt: string | null | undefined;
  bg: number;
  threshold: number;
  bgUnits: "mmol/L" | "mg/dL";
}): boolean {
  const { lastAlertAt, bg, threshold, bgUnits } = input;
  if (!lastAlertAt) return false;
  const atMs = new Date(lastAlertAt).getTime();
  if (!Number.isFinite(atMs)) return false;
  if (Date.now() - atMs >= EXERCISE_CGM_ALERT_COOLDOWN_MS) return false;

  const clearMargin = bgUnits === "mmol/L" ? 0.4 : 7;
  if (bg >= threshold + clearMargin) return false;
  return true;
}

function trendArrow(trend: ExerciseBgTrend | null | undefined): string {
  if (trend === "rising") return "↑";
  if (trend === "falling") return "↓";
  if (trend === "flat") return "→";
  return "";
}

function formatBg(value: number, bgUnits: "mmol/L" | "mg/dL"): string {
  if (bgUnits === "mg/dL") return String(Math.round(value));
  return (Math.round(value * 10) / 10).toFixed(1);
}

/** Same 1g ≈ 0.25 mmol/L at 70kg model as the app hypo calculator. */
export function carbsGramsForExerciseAim(input: {
  bg: number;
  aim: number;
  weightKg: number;
  bgUnits: "mmol/L" | "mg/dL";
}): number {
  const toMmol = (value: number) => (input.bgUnits === "mg/dL" ? value / 18 : value);
  const gap = toMmol(input.aim) - toMmol(input.bg);
  if (gap <= 0) return 5;
  const sensitivity = 70 / Math.max(input.weightKg, 20);
  const rise = 0.25 * sensitivity;
  if (!(rise > 0)) return 5;
  return Math.max(5, Math.ceil(gap / rise));
}

export function parseExerciseAlertFuel(
  line: string | null | undefined,
): { aim: number; kg: number } | null {
  if (!line) return null;
  const match = /^aim=([0-9.]+);kg=([0-9.]+)$/.exec(line.trim());
  if (!match) return null;
  const aim = Number(match[1]);
  const kg = Number(match[2]);
  if (!(aim > 0) || !(kg > 0)) return null;
  return { aim, kg };
}

function shortCarbLine(line: string | undefined): string {
  if (!line) return "Carbs";
  const trimmed = line.trim();
  if (/^aim=/.test(trimmed)) return "Carbs";
  const one = trimmed.replace(/^about\s+/i, "").split("\n")[0]?.trim() ?? "";
  if (!one) return "Carbs";
  return one.length > 22 ? `${one.slice(0, 20)}…` : one;
}

export function buildExerciseCgmAlertCopy(input: {
  bg: number;
  bgUnits: "mmol/L" | "mg/dL";
  trend: ExerciseBgTrend | null;
  evaluation: ExerciseCgmAlertEvaluation;
  exerciseName?: string;
}): { title: string; body: string } {
  const bgLabel = formatBg(input.bg, input.bgUnits);
  const arrow = trendArrow(input.trend);
  return {
    title: `${bgLabel}${arrow ? ` ${arrow}` : ""}`,
    body: shortCarbLine(input.evaluation.carbLine),
  };
}

export function mapDexcomShareTrend(raw?: string | number | null): ExerciseBgTrend | null {
  if (raw == null) return null;
  let trend: string | null = null;
  if (typeof raw === "number") {
    const labels = [
      "doubleup",
      "singleup",
      "fortyfiveup",
      "flat",
      "fortyfivedown",
      "singledown",
      "doubledown",
    ];
    trend = labels[raw - 1] ?? null;
  } else {
    trend = raw.trim().toLowerCase() || null;
  }
  if (!trend) return null;
  if (trend.includes("up")) return "rising";
  if (trend.includes("down")) return "falling";
  if (trend === "flat") return "flat";
  return "not_sure";
}

export const EXERCISE_CGM_STALE_AGE_MINUTES = 20;

export function readingAgeMinutes(recordedAt: string, nowMs = Date.now()): number {
  const ms = new Date(recordedAt).getTime();
  if (!Number.isFinite(ms)) return Number.POSITIVE_INFINITY;
  return Math.max(0, (nowMs - ms) / 60_000);
}

export function isExerciseCgmReadingStale(recordedAt: string, nowMs = Date.now()): boolean {
  return readingAgeMinutes(recordedAt, nowMs) > EXERCISE_CGM_STALE_AGE_MINUTES;
}

export function mgDlToDisplay(valueMgDl: number, bgUnits: "mmol/L" | "mg/dL"): number {
  if (bgUnits === "mg/dL") return Math.round(valueMgDl);
  return Math.round((valueMgDl / 18) * 10) / 10;
}

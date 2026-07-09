import { defaultExerciseLowThreshold } from "@/lib/exercise-hypo-auto";
import type { NotificationSettings } from "@/lib/storage";

export const EXERCISE_CGM_ALERT_THRESHOLD_OPTIONS_MMOL = [4.0, 4.5, 5.0, 5.5, 5.6, 6.0, 6.5] as const;
export const EXERCISE_CGM_ALERT_THRESHOLD_OPTIONS_MGDL = [72, 81, 90, 99, 100, 108, 117] as const;

export function exerciseCgmAlertThresholdOptions(bgUnits: "mmol/L" | "mg/dL"): readonly number[] {
  return bgUnits === "mg/dL" ? EXERCISE_CGM_ALERT_THRESHOLD_OPTIONS_MGDL : EXERCISE_CGM_ALERT_THRESHOLD_OPTIONS_MMOL;
}

export function resolveExerciseCgmAlertThreshold(
  settings: NotificationSettings,
  bgUnits: "mmol/L" | "mg/dL",
): number {
  const custom = settings.exerciseCgmAlertThreshold;
  if (typeof custom === "number" && Number.isFinite(custom) && custom > 0) return custom;
  return defaultExerciseLowThreshold(bgUnits);
}

export function formatExerciseCgmAlertThresholdOption(value: number, bgUnits: "mmol/L" | "mg/dL"): string {
  const defaultVal = defaultExerciseLowThreshold(bgUnits);
  const formatted = bgUnits === "mmol/L" ? value.toFixed(1) : String(Math.round(value));
  return value === defaultVal ? `${formatted} (default)` : formatted;
}

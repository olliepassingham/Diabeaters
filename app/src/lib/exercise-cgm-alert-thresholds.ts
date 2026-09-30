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

const AIM_STEPS_MMOL = [1, 1.5, 2] as const;
const AIM_STEPS_MGDL = [18, 27, 36] as const;

function roundAim(value: number, bgUnits: "mmol/L" | "mg/dL"): number {
  return bgUnits === "mmol/L" ? Math.round(value * 10) / 10 : Math.round(value);
}

/** Levels to bring BG back to, each a step above the notify threshold. */
export function exerciseCgmAlertAimOptions(
  threshold: number,
  bgUnits: "mmol/L" | "mg/dL",
): number[] {
  const steps = bgUnits === "mmol/L" ? AIM_STEPS_MMOL : AIM_STEPS_MGDL;
  return steps.map((step) => roundAim(threshold + step, bgUnits));
}

/** BG the carb estimate aims for. Defaults to 1.5 mmol/L (27 mg/dL) above the notify level. */
export function resolveExerciseCgmAlertAim(
  settings: NotificationSettings,
  bgUnits: "mmol/L" | "mg/dL",
): number {
  const threshold = resolveExerciseCgmAlertThreshold(settings, bgUnits);
  const minGap = bgUnits === "mmol/L" ? 0.5 : 9;
  const custom = settings.exerciseCgmAlertAimBg;
  if (typeof custom === "number" && Number.isFinite(custom) && custom >= threshold + minGap - 0.05) {
    return roundAim(custom, bgUnits);
  }
  const bump = bgUnits === "mmol/L" ? 1.5 : 27;
  return roundAim(threshold + bump, bgUnits);
}

export type ExerciseAlertFuelCarb = {
  carbsPerServing: number;
  label: string;
};

/**
 * Compact token stored for background alerts so grams are calculated from the live reading.
 * Weight stays in this token for the calculation. It is not shown on the notification.
 * An optional carb favourite is `per` plus a label after `|`.
 */
export function encodeExerciseAlertFuel(
  aim: number,
  weightKg: number,
  carb?: ExerciseAlertFuelCarb | null,
): string {
  const kg = Math.round(Math.max(weightKg, 20) * 10) / 10;
  const base = `aim=${aim};kg=${kg}`;
  if (!carb || !(carb.carbsPerServing > 0) || !carb.label.trim()) return base;
  const per = Math.round(carb.carbsPerServing * 10) / 10;
  const name = carb.label.trim().replace(/[|;]/g, " ");
  return `${base};per=${per}|${name}`;
}

export function formatExerciseCgmAlertThresholdOption(value: number, bgUnits: "mmol/L" | "mg/dL"): string {
  const defaultVal = defaultExerciseLowThreshold(bgUnits);
  const formatted = bgUnits === "mmol/L" ? value.toFixed(1) : String(Math.round(value));
  return value === defaultVal ? `${formatted} (default)` : formatted;
}

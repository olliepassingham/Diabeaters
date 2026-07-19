/**
 * Single source of truth for the BG bands used across the exercise tools
 * (readiness verdicts, fuel plan lines, hypo suggestions, CGM alerts).
 * Previously these numbers were redefined independently in several files —
 * centralising them here means a future adjustment only needs to happen once,
 * and the different exercise surfaces can never quietly drift apart.
 */

export type ExerciseBgUnits = "mmol/L" | "mg/dL";

function units(bgUnits: string): ExerciseBgUnits {
  return bgUnits === "mg/dL" ? "mg/dL" : "mmol/L";
}

/** Default lower bound of "in range" (clinical hypo) when settings don't specify one. */
export function defaultHypoThreshold(bgUnits: string): number {
  return units(bgUnits) === "mg/dL" ? 70 : 3.9;
}

/** Below this (but not necessarily clinically hypo) is the exercise-specific "low" band. */
export function defaultExerciseLowThreshold(bgUnits: string): number {
  return units(bgUnits) === "mg/dL" ? 100 : 5.6;
}

/** Above this, exercise readiness switches to a high-BG caution band. */
export function exerciseHighThreshold(bgUnits: string): number {
  return units(bgUnits) === "mg/dL" ? 250 : 13.9;
}

/** Minimum BG to comfortably start moderate/intense cardio without a pre-exercise snack. */
export function exerciseIdealStartMinimum(bgUnits: string): number {
  return units(bgUnits) === "mg/dL" ? 126 : 7;
}

export function exerciseIdealStartMinimumLabel(bgUnits: string): string {
  return units(bgUnits) === "mg/dL" ? "~126 mg/dL" : "~7 mmol/L";
}

/**
 * Margin above the exercise-low threshold where a *falling* trend still warrants
 * treat-now guidance (matches readiness / fuel-plan / hypo-suggestion logic).
 */
export function exerciseApproachLowMargin(bgUnits: string): number {
  return units(bgUnits) === "mg/dL" ? 16 : 0.9;
}

export function exerciseApproachLowCeiling(lowThreshold: number, bgUnits: string): number {
  return lowThreshold + exerciseApproachLowMargin(bgUnits);
}

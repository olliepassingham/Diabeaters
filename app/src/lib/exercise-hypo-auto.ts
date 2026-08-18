import { getBodyWeightKgFromProfile } from "@/lib/body-weight";
import { formatCarbsForScenario } from "@/lib/carb-source-preferences";
import { computeHypoCarbEquivalents } from "@/lib/hypo-treatment-display";
import type { ActiveExerciseSession, ExerciseBgTrend, ExerciseSymptomSeverity, UserProfile, UserSettings } from "@/lib/storage";
import { formatTargetBgInput, suggestedRecoveryTargetBg } from "@/lib/hypo-context";
import { hypoCalculatorRequiresExplicitWeight } from "@/lib/user-age";
import {
  defaultExerciseLowThreshold as centralDefaultExerciseLowThreshold,
  defaultHypoThreshold,
  exerciseApproachLowCeiling as centralExerciseApproachLowCeiling,
  exerciseApproachLowCeilingForPhase,
  exerciseIdealStartMinimum,
} from "@/lib/exercise-thresholds";

/** BG value to use for hypo check: draft input wins when valid, else last logged for phase. */
export function resolveExerciseBgForHypo(session: ActiveExerciseSession, bgInputDraft?: string): number | null {
  const raw = bgInputDraft?.trim() ?? "";
  if (raw !== "") {
    const n = parseFloat(raw.replace(",", "."));
    if (Number.isFinite(n)) return n;
  }
  if (session.phase === "pre") return session.preBg ?? null;
  if (session.phase === "active") return session.midBg ?? session.preBg ?? null;
  return session.recoveryBg ?? session.midBg ?? session.preBg ?? null;
}

/** Lower bound of “in range” from settings, else sensible default (3.9 mmol/L · 70 mg/dL). */
export function hypoRangeThreshold(settings: UserSettings | undefined, bgUnits: "mmol/L" | "mg/dL"): number {
  const low = settings?.targetBgLow;
  if (typeof low === "number" && low > 0) return low;
  return defaultHypoThreshold(bgUnits);
}

export function defaultExerciseLowThreshold(bgUnits: "mmol/L" | "mg/dL"): number {
  return centralDefaultExerciseLowThreshold(bgUnits);
}

/** Upper band where falling BG during exercise still needs treat-now guidance (matches readiness logic). */
export function exerciseApproachLowCeiling(lowThreshold: number, bgUnits: "mmol/L" | "mg/dL"): number {
  return centralExerciseApproachLowCeiling(lowThreshold, bgUnits);
}

export function isBgBelowHypoThreshold(
  bg: number,
  settings: UserSettings | undefined,
  bgUnits: "mmol/L" | "mg/dL",
): boolean {
  return bg < hypoRangeThreshold(settings, bgUnits);
}

export type ExerciseHypoSuggestion = {
  carbsGrams: number;
  glucoseTablets: number;
  juiceMl: number;
  /** When true, use team-specific plan — estimate is a typical first step only. */
  approximate: boolean;
  /** e.g. "about ½ Running gel" when the user set an exercise favourite. */
  primaryTreatmentLine?: string;
  /** True when BG is below clinical hypo threshold; false for exercise-low / falling bands. */
  clinicalHypo?: boolean;
  /** Display target this estimate is aiming for (same units as the reading). */
  targetBg?: number;
  targetBgLabel?: string;
};

export type ExerciseHypoContext = {
  trend?: ExerciseBgTrend | null;
  phase?: "pre" | "active" | "recovery";
  /** Plan pre.lowThreshold parsed — defaults to 5.6 mmol/L / 100 mg/dL. */
  exerciseLowThreshold?: number;
  /** Plan pre.carbsIfLow — unused as a gram floor; treat-now uses the weight-based rise. */
  carbsIfLow?: number;
  /**
   * Subjective symptom severity logged mid-session. "severe" escalates treat-now
   * guidance even when the reading itself is only borderline, and moderate/severe
   * nudge the carb estimate up slightly — symptoms plus a borderline number is a
   * stronger signal than either alone.
   */
  symptomSeverity?: ExerciseSymptomSeverity;
};

function toMmol(bg: number, bgUnits: "mmol/L" | "mg/dL"): number {
  return bgUnits === "mg/dL" ? bg / 18 : bg;
}

function buildSuggestion(
  carbsGrams: number,
  profile: Partial<UserProfile>,
  approximate: boolean,
  clinicalHypo: boolean,
  targetBg: number,
  bgUnits: "mmol/L" | "mg/dL",
): ExerciseHypoSuggestion {
  const grams = Math.max(1, Math.round(carbsGrams));
  const eq = computeHypoCarbEquivalents(grams);
  return {
    carbsGrams: grams,
    glucoseTablets: eq.glucoseTablets,
    juiceMl: eq.juiceMl,
    approximate,
    clinicalHypo,
    targetBg,
    targetBgLabel: formatTargetBgInput(targetBg, bgUnits),
    primaryTreatmentLine: formatCarbsForScenario(grams, profile, "exercise_during") ?? undefined,
  };
}

/**
 * Fast-carb grams to close a mmol/L gap. Same 1g ≈ 0.25 mmol/L at 70kg model as Hypo help.
 * Returns 0 when already at or above target. Practical floor of 5g when a positive gap exists.
 */
export function carbsGramsToCloseBgGapMmol(
  currentMmol: number,
  targetMmol: number,
  profile: Partial<UserProfile>,
): number {
  const bgDifference = targetMmol - currentMmol;
  if (bgDifference <= 0) return 0;
  const weightKg = getBodyWeightKgFromProfile(profile) ?? 70;
  const sensitivityFactor = 70 / Math.max(weightKg, 20);
  const effectiveRise = 0.25 * sensitivityFactor;
  if (!(effectiveRise > 0)) return 0;
  return Math.max(5, Math.ceil(bgDifference / effectiveRise));
}

/**
 * Whether the user should treat now (not just carry carbs) for this reading during exercise.
 */
export function needsImmediateExerciseBgTreatment(
  bg: number,
  settings: UserSettings | undefined,
  bgUnits: "mmol/L" | "mg/dL",
  context?: ExerciseHypoContext,
): boolean {
  if (isBgBelowHypoThreshold(bg, settings, bgUnits)) return true;
  const low = context?.exerciseLowThreshold ?? defaultExerciseLowThreshold(bgUnits);
  if (bg < low) return true;
  // Recovery gets a wider ceiling than pre/active — delayed-onset lows after activity
  // don't always show up as a confirmed falling trend on the next single reading.
  const approachCeiling = exerciseApproachLowCeilingForPhase(low, bgUnits, context?.phase);
  if (context?.trend === "falling" && bg < approachCeiling) return true;
  if (context?.phase === "recovery" && bg < approachCeiling) return true;
  // Severe symptoms (shaky, sweaty, etc.) plus a borderline-low reading is a stronger
  // signal than the number alone — escalate even without a confirmed falling trend.
  if (context?.symptomSeverity === "severe" && bg < approachCeiling) return true;
  return false;
}

/**
 * Carbohydrate estimate for exercise lows — clinical hypo band and exercise-low / falling bands.
 * Same weight-based rise as Hypo help (1g ≈ 0.25 mmol/L at 70kg). Exercise-low aims at the
 * usual start-comfort band (~7 mmol/L); clinical hypo aims at the midpoint of the saved range.
 */
export function computeExerciseHypoSuggestion(
  bg: number,
  settings: UserSettings | undefined,
  bgUnits: "mmol/L" | "mg/dL",
  profile: Partial<UserProfile>,
  context?: ExerciseHypoContext,
): ExerciseHypoSuggestion | null {
  const clinicalHypo = isBgBelowHypoThreshold(bg, settings, bgUnits);
  if (!clinicalHypo && !needsImmediateExerciseBgTreatment(bg, settings, bgUnits, context)) {
    return null;
  }

  const currentMmol = toMmol(bg, bgUnits);
  const thresholdMmol = toMmol(hypoRangeThreshold(settings, bgUnits), bgUnits);
  const recoveryTargetMmol =
    suggestedRecoveryTargetBg(settings, bgUnits) != null
      ? toMmol(suggestedRecoveryTargetBg(settings, bgUnits)!, bgUnits)
      : Math.max(5.5, thresholdMmol + 1.2);
  const exerciseTargetMmol = toMmol(exerciseIdealStartMinimum(bgUnits), bgUnits);
  const targetMmol = clinicalHypo ? recoveryTargetMmol : Math.max(recoveryTargetMmol, exerciseTargetMmol);
  const targetDisplay = bgUnits === "mg/dL" ? Math.round(targetMmol * 18) : Math.round(targetMmol * 10) / 10;

  if (hypoCalculatorRequiresExplicitWeight(profile.dateOfBirth)) {
    return buildSuggestion(15, profile, true, clinicalHypo, targetDisplay, bgUnits);
  }

  let carbsNeeded = carbsGramsToCloseBgGapMmol(currentMmol, targetMmol, profile);
  // Treat-now can fire while already near the target (falling in the approach band).
  // A small 5g cushion is enough; do not jump to a fixed 15g Rule of 15.
  if (carbsNeeded <= 0) carbsNeeded = 5;

  if (context?.symptomSeverity === "severe") {
    carbsNeeded = Math.ceil(carbsNeeded * 1.2);
  } else if (context?.symptomSeverity === "moderate") {
    carbsNeeded = Math.ceil(carbsNeeded * 1.1);
  }

  return buildSuggestion(carbsNeeded, profile, false, clinicalHypo, targetDisplay, bgUnits);
}

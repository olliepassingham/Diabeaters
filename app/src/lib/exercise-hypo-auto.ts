import { getBodyWeightKgFromProfile } from "@/lib/body-weight";
import { formatCarbsForScenario } from "@/lib/carb-source-preferences";
import { computeHypoCarbEquivalents } from "@/lib/hypo-treatment-display";
import type { ActiveExerciseSession, ExerciseBgTrend, ExerciseSymptomSeverity, UserProfile, UserSettings } from "@/lib/storage";
import { suggestedRecoveryTargetBg } from "@/lib/hypo-context";
import { hypoCalculatorRequiresExplicitWeight } from "@/lib/user-age";
import {
  defaultExerciseLowThreshold as centralDefaultExerciseLowThreshold,
  defaultHypoThreshold,
  exerciseApproachLowCeiling as centralExerciseApproachLowCeiling,
  exerciseApproachLowCeilingForPhase,
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
  /** e.g. "about 4 glucose tablets" when user set a primary treatment. */
  primaryTreatmentLine?: string;
  /** True when BG is below clinical hypo threshold; false for exercise-low / falling bands. */
  clinicalHypo?: boolean;
};

export type ExerciseHypoContext = {
  trend?: ExerciseBgTrend | null;
  phase?: "pre" | "active" | "recovery";
  /** Plan pre.lowThreshold parsed — defaults to 5.6 mmol/L / 100 mg/dL. */
  exerciseLowThreshold?: number;
  /** Plan pre.carbsIfLow — floor for treat-now grams. */
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
): ExerciseHypoSuggestion {
  const eq = computeHypoCarbEquivalents(carbsGrams);
  return {
    carbsGrams: eq.carbsGrams,
    glucoseTablets: eq.glucoseTablets,
    juiceMl: eq.juiceMl,
    approximate,
    clinicalHypo,
    primaryTreatmentLine: formatCarbsForScenario(eq.carbsGrams, profile, "exercise_during") ?? undefined,
  };
}

/** Weight-based carbs to reach a target BG (mmol/L internally). */
function carbsToReachTargetMmol(
  currentMmol: number,
  targetMmol: number,
  profile: Partial<UserProfile>,
): number {
  const bgDifference = targetMmol - currentMmol;
  if (bgDifference <= 0) return 12;
  const weightKg = getBodyWeightKgFromProfile(profile) ?? 70;
  const sensitivityFactor = 70 / weightKg;
  const effectiveRise = 0.25 * sensitivityFactor;
  return Math.ceil(bgDifference / effectiveRise);
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
 * Same weight-based approach as Hypo help for adults; conservative ~15g for minors.
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

  const floorGrams = Math.max(0, context?.carbsIfLow ?? 0);

  if (hypoCalculatorRequiresExplicitWeight(profile.dateOfBirth)) {
    const grams = Math.max(15, floorGrams);
    return buildSuggestion(grams, profile, true, clinicalHypo);
  }

  const thresholdMmol = toMmol(hypoRangeThreshold(settings, bgUnits), bgUnits);
  const currentMmol = toMmol(bg, bgUnits);
  const targetFromSettings = suggestedRecoveryTargetBg(settings, bgUnits);
  const targetMmol =
    targetFromSettings != null
      ? toMmol(targetFromSettings, bgUnits)
      : Math.max(5.5, thresholdMmol + 1.2);

  let carbsNeeded: number;
  if (clinicalHypo) {
    carbsNeeded = carbsToReachTargetMmol(currentMmol, targetMmol, profile);
  } else {
    // Exercise-low or falling in the approach band — raise toward a safer exercise band.
    const exerciseTargetMmol = Math.max(targetMmol, bgUnits === "mg/dL" ? 126 / 18 : 6.5);
    carbsNeeded = carbsToReachTargetMmol(currentMmol, exerciseTargetMmol, profile);
    if (context?.trend === "falling") {
      carbsNeeded = Math.max(carbsNeeded, Math.ceil(floorGrams * 0.75) || 12);
    }
  }

  // Symptoms reported alongside a low/borderline reading — nudge the estimate up a little
  // rather than leaving the user to guess whether "feeling off" should change the amount.
  if (context?.symptomSeverity === "severe") {
    carbsNeeded = Math.ceil(carbsNeeded * 1.2);
  } else if (context?.symptomSeverity === "moderate") {
    carbsNeeded = Math.ceil(carbsNeeded * 1.1);
  }

  carbsNeeded = Math.max(carbsNeeded, floorGrams > 0 ? floorGrams : clinicalHypo ? 12 : 15);
  return buildSuggestion(carbsNeeded, profile, false, clinicalHypo);
}

/**
 * Rule-based educational lines from BG + trend during exercise flow.
 * No insulin dosing — confirm changes with your care team.
 */

import { isBgBelowHypoThreshold, hypoRangeThreshold } from "@/lib/exercise-hypo-auto";
import type { ExerciseBgTrend, ExerciseIntensity, ExerciseType, UserSettings } from "@/lib/storage";

export type PreExerciseInsulinSuppressedReason = "hypo" | "low_bg" | "below_target";

export type ShouldSuggestPreExerciseMealInsulinInput = {
  currentBg?: number;
  bgTrend?: ExerciseBgTrend | null;
  bgUnits: string;
  mealCarbsIsSuggested: boolean;
  /** Grams planned before exercise (suggested or user-entered). */
  mealCarbsGrams?: number;
  settings?: UserSettings;
};

export type ShouldSuggestPreExerciseMealInsulinResult = {
  suggest: boolean;
  suppressedReason?: PreExerciseInsulinSuppressedReason;
};

/** Lower bound of many people's pre-exercise target band (matches plan targetBg copy). */
export function preExerciseIdealLowBg(bgUnits: string): number {
  return bgUnits === "mmol/L" ? 7 : 126;
}

/** BG below typical exercise-start comfort band (5.6 mmol/L · 100 mg/dL). */
export function isExerciseStartLow(bg: number, bgUnits: string): boolean {
  return bgUnits === "mmol/L" ? bg < 5.6 : bg < 100;
}

export type ExerciseReadingPhase = "pre" | "active" | "recovery";

export interface ExerciseReadingContext {
  bg?: number;
  trend?: ExerciseBgTrend;
  bgUnits: string;
  exerciseType: ExerciseType;
  intensity: ExerciseIntensity;
  phase: ExerciseReadingPhase;
  /** Local clock 17+ for overnight-low copy in recovery. */
  isEvening?: boolean;
}

function isLow(bg: number, bgUnits: string): boolean {
  return isExerciseStartLow(bg, bgUnits);
}

const SMALL_PRE_EXERCISE_FUEL_GRAMS = 20;

/**
 * Whether to show a meal bolus estimate for pre-exercise fuel at the current reading.
 * Suppresses when BG is hypo, low for exercise start, or below ideal pre-exercise band.
 */
export function shouldSuggestPreExerciseMealInsulin(
  input: ShouldSuggestPreExerciseMealInsulinInput,
): ShouldSuggestPreExerciseMealInsulinResult {
  const bg = input.currentBg;
  if (bg == null || !Number.isFinite(bg)) {
    return { suggest: true };
  }

  const bgUnits = input.bgUnits === "mg/dL" ? "mg/dL" : "mmol/L";

  if (isBgBelowHypoThreshold(bg, input.settings, bgUnits)) {
    return { suggest: false, suppressedReason: "hypo" };
  }

  if (isExerciseStartLow(bg, bgUnits)) {
    return { suggest: false, suppressedReason: "low_bg" };
  }

  const idealLow = preExerciseIdealLowBg(bgUnits);
  if (bg < idealLow) {
    if (input.mealCarbsIsSuggested) {
      return { suggest: false, suppressedReason: "below_target" };
    }
    const mealCarbs = input.mealCarbsGrams ?? 0;
    if (input.bgTrend === "falling" && mealCarbs > 0 && mealCarbs <= SMALL_PRE_EXERCISE_FUEL_GRAMS) {
      return { suggest: false, suppressedReason: "below_target" };
    }
  }

  return { suggest: true };
}

/** Short copy for UI when meal insulin is suppressed at this BG. */
export function preExerciseInsulinSuppressedMessage(
  reason: PreExerciseInsulinSuppressedReason,
  bgUnits: string,
  settings?: UserSettings,
): string {
  const units = bgUnits === "mg/dL" ? "mg/dL" : "mmol/L";
  switch (reason) {
    case "hypo":
      return `Reading is below your hypo range (${hypoRangeThreshold(settings, units)} ${units}) — treat per your hypo plan and recheck before exercise. Carbs here are for treatment, not a meal bolus.`;
    case "low_bg":
      return "BG is below a typical exercise-start range for many people — use carbs to raise BG; no meal insulin suggested. Recheck before hard effort.";
    case "below_target":
      return `BG is below the usual pre-exercise band (about ${bgUnits === "mmol/L" ? "7–10" : "126–180"} ${bgUnits}) — fuel with carbs to reach your range; no meal insulin suggested at this reading.`;
  }
}

function isHigh(bg: number, bgUnits: string): boolean {
  return bgUnits === "mmol/L" ? bg > 13.9 : bg > 250;
}

function isInComfortBand(bg: number, bgUnits: string): boolean {
  if (bgUnits === "mmol/L") return bg >= 5.6 && bg <= 10;
  return bg >= 100 && bg <= 180;
}

/** Extra bullet strings to show under generic exercise tips. */
export function getExerciseGuidanceForReading(ctx: ExerciseReadingContext): string[] {
  const tips: string[] = [];
  const bg = ctx.bg;
  if (bg == null || Number.isNaN(bg)) return tips;

  const { bgUnits, trend, exerciseType, intensity, phase, isEvening } = ctx;
  const low = isLow(bg, bgUnits);
  const high = isHigh(bg, bgUnits);
  const ok = isInComfortBand(bg, bgUnits);

  if (low) {
    if (phase === "recovery") {
      tips.push(
        "Reading is low for many people — treat per your hypo plan and keep monitoring; delayed lows can still follow exercise.",
      );
    } else {
      tips.push(
        "Reading is below typical exercise-start range for many people — treat low BG first and delay hard effort until your team’s targets are met.",
      );
    }
    tips.push("If you use a CGM, confirm with a fingerstick if readings don’t match how you feel.");
    return tips;
  }

  if (high) {
    if (phase === "recovery") {
      tips.push(
        "BG is on the high side after exercise — follow your team’s correction and ketone plan if they use one; you may still see drops later.",
      );
    } else if (intensity === "intense") {
      tips.push("Higher BG before intense effort: check ketones and follow your sick-day or ketone plan if your team has one.");
    } else {
      tips.push("BG is on the high side — gentle activity may still be an option; confirm targets and any corrections with your care team.");
    }
  } else if (ok) {
    if (phase === "recovery") {
      tips.push(
        `Around ${bgUnits === "mmol/L" ? "a comfortable" : "a common"} range for many after exercise — delayed lows are still possible; keep checks and snacks handy.`,
      );
    } else {
      tips.push(`Around ${bgUnits === "mmol/L" ? "target" : "a common"} pre-exercise band for many — still watch how you feel and your trend.`);
    }
  }

  const cardioLike =
    exerciseType === "cardio" ||
    exerciseType === "hiit" ||
    exerciseType === "walking" ||
    exerciseType === "swimming" ||
    exerciseType === "court" ||
    exerciseType === "field";

  if (trend === "falling" && cardioLike && (intensity === "moderate" || intensity === "intense")) {
    tips.push("Trend is down — have fast carbs within reach; drops can accelerate during cardio-style work.");
  }

  if (trend === "falling" && phase === "active") {
    tips.push("Still falling mid-session — consider an extra check soon and pause if symptoms appear.");
  }

  if (trend === "rising" && exerciseType === "strength" && phase === "pre") {
    tips.push("Rising BG before lifting is common with adrenaline — you may still see a dip later; keep hypo treatment nearby.");
  }

  if (trend === "rising" && exerciseType === "hiit" && phase === "active") {
    tips.push("HIIT can spike then drop sharply after — plan recovery fuel even if BG looks high now.");
  }

  if (trend === "not_sure" && phase !== "pre") {
    tips.push("If unsure of direction, a quick check mid-session beats guessing — especially before pushing harder.");
  }

  if (phase === "recovery" && (trend === "falling" || (ok && cardioLike))) {
    tips.push("Recovery window: delayed lows are common — keep snacks accessible for several hours.");
  }

  if (phase === "recovery" && isEvening && (intensity === "intense" || intensity === "moderate")) {
    tips.push("Evening session — overnight delayed lows are more likely for some people; discuss snack or basal tweaks with your team.");
  }

  return tips;
}

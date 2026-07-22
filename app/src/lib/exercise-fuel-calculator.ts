import {
  EXERCISE_INTENSITY_OPTIONS,
  EXERCISE_MEAL_TYPE_OPTIONS,
  EXERCISE_TYPE_OPTIONS,
} from "@/lib/exercise-catalog";
import { computeSimpleCorrectionDose } from "@/lib/correction-dose";
import { calculateExercisePlan, type ExercisePlanContext } from "@/lib/exercise-plan";
import { isBgBelowHypoThreshold } from "@/lib/exercise-hypo-auto";
import { getBodyWeightKgFromProfile } from "@/lib/body-weight";
import { hypoCalculatorRequiresExplicitWeight } from "@/lib/user-age";
import {
  getExerciseGuidanceForReading,
  isExerciseStartLow,
  preExerciseInsulinSuppressedMessage,
  preExerciseMealCarbsSkipMessage,
  preExerciseIdealHighBg,
  preExerciseIdealLowBg,
  isPreExerciseHighBg,
  shouldSuggestPreExerciseMealCarbs,
  shouldSuggestPreExerciseMealInsulin,
  type PreExerciseInsulinSuppressedReason,
  type PreExerciseMealCarbsSkipReason,
} from "@/lib/exercise-reading-guidance";
import {
  getExerciseMealBolusPreview,
  roundInsulinUnits,
  type MealExerciseMeta,
} from "@/lib/meal-dose";
import type { ExercisePlanResult } from "@/lib/exercise-plan";
import { computeActiveWorkoutFuelCarry } from "@/lib/exercise-readiness";
import { parseRatioToGramsPerUnit } from "@/lib/ratio-utils";
import type { ExerciseBgTrend, ExerciseIntensity, ExerciseType, UserProfile, UserSettings } from "@/lib/storage";
import { getEffectiveTdd } from "@/lib/tdd";

export type { PreExerciseInsulinSuppressedReason, PreExerciseMealCarbsSkipReason };

export type ExerciseFuelCalculationBreakdown = {
  intensityLabel: string;
  activityLabel: string;
  durationMinutes: number;
  preBufferGrams: number;
  duringGrams: number;
  onHandGrams: number;
  mealCarbsSource: "user" | "suggested" | "none";
  mealCarbsSkipReason?: PreExerciseMealCarbsSkipReason;
  ratioDescription?: string;
  standardUnits?: number;
  reductionPercent?: number;
  adjustedUnitsExact?: number;
  /** Extra grams added on top of the session buffer because current BG is below the starting band. */
  lowBgCarbTopUpGrams?: number;
};

export type ExerciseFuelCalculatorInput = {
  exerciseType: ExerciseType;
  intensity: ExerciseIntensity;
  durationMinutes: number;
  minutesUntilStart: number;
  fasted: boolean;
  bgUnits: string;
  settings: UserSettings;
  isPump: boolean;
  /** User-entered pre-workout meal carbs; omit or 0 to get a suggestion from the session plan. */
  mealCarbsGrams?: number;
  mealType: string;
  currentBg?: number;
  bgTrend?: ExerciseBgTrend | null;
  rapidInsulinLast2h?: boolean;
  lastMealMinutesAgo?: number;
  lastMealCarbsGrams?: number;
  /** Body weight/age drive how much a suggested top-up scales for a low reading (optional). */
  profile?: Partial<UserProfile>;
};

export type ExerciseFuelInsulinResult = {
  carbsGrams: number;
  mealType: string;
  /** Carb coverage before exercise reduction. */
  standardUnits: number;
  /** Meal bolus after exercise reduction (carb coverage only). */
  adjustedUnits: number;
  reductionPercent: number;
  exactAdjusted: number;
  /** Correction toward pre-exercise target when BG is above the band. */
  correctionUnits: number;
  correctionTargetBg?: number;
  /** Meal bolus + correction (rounded for display). */
  totalUnits: number;
};

export type ExerciseSessionFuel = {
  /** Fast carbs to keep with you for the whole session. */
  carryGrams: number;
  /** Total fast carbs you may use during the workout. */
  duringTotalGrams: number;
  /** Per-interval dose for longer aerobic sessions. */
  doseGrams?: number;
  intervalMinutes?: number;
  carbFrequency: string;
};

export type ExerciseFuelProjection = {
  currentBg: number;
  projectedBgAtStart: number | null;
  targetBand: string;
  inTargetAtStart: boolean;
};

export type ExerciseFuelCalculatorResult = {
  /** Short headline for the result card. */
  headline: string;
  targetBg: string;
  /** Carbs for the pre-workout meal (user entry or suggestion). */
  mealCarbs: number;
  mealCarbsIsSuggested: boolean;
  /** True when the user entered their own pre-meal carbs (not suggest mode). */
  userEnteredMealCarbs: boolean;
  /** Fast carbs to keep available (during / if low). */
  onHandCarbs: number;
  duringCarbs: number;
  sessionFuel: ExerciseSessionFuel;
  insulin: ExerciseFuelInsulinResult | null;
  /** BG projection when user entered their own pre-meal carbs. */
  projection: ExerciseFuelProjection | null;
  /** How this session type affects glucose and insulin reduction. */
  exerciseEffectNote: string | null;
  /** When insulin is suppressed (e.g. low BG), estimate at target band for known-carbs planning. */
  projectedInsulinAtTarget: ExerciseFuelInsulinResult | null;
  insulinSuppressedReason: PreExerciseInsulinSuppressedReason | null;
  insulinNoRatios: boolean;
  /** Fallback % band when ratios are missing. */
  bolusReductionBand: string;
  pumpTip: string | null;
  /** Up to 3 short, input-specific notes. */
  notes: string[];
  mealCarbsSkipReason: PreExerciseMealCarbsSkipReason | null;
  breakdown: ExerciseFuelCalculationBreakdown;
};

function buildPlanContext(input: ExerciseFuelCalculatorInput): ExercisePlanContext {
  const ctx: ExercisePlanContext = {
    exerciseType: input.exerciseType,
    durationMinutes: input.durationMinutes,
    intensity: input.intensity,
    minutesUntilStart: Math.max(0, input.minutesUntilStart),
    bgUnits: input.bgUnits,
    hourOfDay: new Date().getHours(),
  };

  if (input.currentBg != null && Number.isFinite(input.currentBg)) ctx.currentBg = input.currentBg;
  if (input.bgTrend && input.bgTrend !== "not_sure") ctx.bgTrend = input.bgTrend;
  if (input.rapidInsulinLast2h) ctx.lastInsulinTiming = "lt_1h";
  if (input.fasted) {
    ctx.nutritionContext = "fasted";
  } else if (input.lastMealMinutesAgo != null) {
    ctx.minutesSinceLastMeal = input.lastMealMinutesAgo;
    if (input.lastMealCarbsGrams != null && input.lastMealCarbsGrams >= 0) {
      ctx.approximateCarbsGrams = input.lastMealCarbsGrams;
      ctx.nutritionContext =
        input.lastMealCarbsGrams > 0 && input.lastMealCarbsGrams < 45 ? "snack_only" : "ate_recently";
    } else {
      ctx.nutritionContext = input.lastMealMinutesAgo <= 120 ? "ate_recently" : undefined;
    }
  }

  const mealCarbs = input.mealCarbsGrams ?? 0;
  if (mealCarbs > 0) {
    ctx.nutritionContext = "about_to_eat";
    ctx.approximateCarbsGrams = mealCarbs;
    ctx.plannedPreExerciseFuel = input.mealType === "snack" ? "snack_bolus" : "meal_bolus";
    ctx.minutesUntilPreExerciseFuel = ctx.minutesUntilStart;
  }

  return ctx;
}

function activityLabel(type: ExerciseType): string {
  return EXERCISE_TYPE_OPTIONS.find((o) => o.value === type)?.label ?? type.replace(/_/g, " ");
}

function intensityLabel(intensity: ExerciseIntensity): string {
  return EXERCISE_INTENSITY_OPTIONS.find((o) => o.value === intensity)?.label ?? intensity;
}

function mealTypeLabel(mealType: string): string {
  return EXERCISE_MEAL_TYPE_OPTIONS.find((o) => o.value === mealType)?.label.toLowerCase() ?? mealType;
}

function describeRatioUsed(mealType: string, settings: UserSettings): string | undefined {
  const ratioMap: Record<string, string | undefined> = {
    breakfast: settings.breakfastRatio,
    lunch: settings.lunchRatio,
    dinner: settings.dinnerRatio,
    snack: settings.snackRatio,
    meal: settings.lunchRatio || settings.breakfastRatio,
  };
  const ratio = ratioMap[mealType]?.trim();
  if (ratio) return `1 unit per ${ratio}g carbs (${mealTypeLabel(mealType)})`;
  const tdd = getEffectiveTdd(settings);
  if (tdd) return `estimated from TDD ${tdd} (500÷TDD rule)`;
  return undefined;
}

function startLabel(minutesUntilStart: number): string {
  if (minutesUntilStart <= 0) return "starting now";
  if (minutesUntilStart === 60) return "starts in about an hour";
  if (minutesUntilStart < 60) return `starts in about ${minutesUntilStart} minutes`;
  const hours = Math.round(minutesUntilStart / 60);
  return `starts in about ${hours} hour${hours === 1 ? "" : "s"}`;
}

/** Plain-language session line for the plan card (no dose maths). */
function sessionLabel(input: ExerciseFuelCalculatorInput): string {
  return `${intensityLabel(input.intensity)} ${activityLabel(input.exerciseType)} · ${input.durationMinutes} min · ${startLabel(input.minutesUntilStart)}`;
}

function preExerciseTargetMidpoint(bgUnits: string): number {
  const units = bgUnits === "mg/dL" ? "mg/dL" : "mmol/L";
  const low = preExerciseIdealLowBg(units);
  const high = preExerciseIdealHighBg(units);
  return units === "mmol/L" ? Math.round(((low + high) / 2) * 10) / 10 : Math.round((low + high) / 2);
}

function computePreExerciseCorrectionUnits(
  currentBg: number,
  bgUnits: string,
  settings: UserSettings,
  exerciseReductionPercent: number,
): { units: number; targetBg: number } | null {
  const units = bgUnits === "mg/dL" ? "mg/dL" : "mmol/L";
  const targetBg = preExerciseIdealHighBg(units);
  if (currentBg <= targetBg) return null;

  const isf = settings.correctionFactor;
  if (isf == null || !Number.isFinite(isf) || isf <= 0) return null;

  const correction = computeSimpleCorrectionDose({
    currentBg,
    targetBg,
    correctionFactor: isf,
    bgUnits: units,
  });
  if (correction.status !== "dose" || correction.fullDoseRounded <= 0) return null;

  const reducedExact = correction.fullDoseRounded * (1 - exerciseReductionPercent / 100);
  const unitsOut = Math.max(0, Math.round(reducedExact));
  if (unitsOut <= 0) return null;

  return { units: unitsOut, targetBg };
}

function mealRatioGramsPerUnit(mealType: string, settings: UserSettings): number | null {
  const ratioMap: Record<string, string | undefined> = {
    breakfast: settings.breakfastRatio,
    lunch: settings.lunchRatio,
    dinner: settings.dinnerRatio,
    snack: settings.snackRatio,
    meal: settings.lunchRatio || settings.breakfastRatio,
  };
  const parsed = parseRatioToGramsPerUnit(ratioMap[mealType]);
  if (parsed != null && parsed > 0) return parsed;
  const tdd = getEffectiveTdd(settings);
  if (tdd) return Math.max(1, Math.round(500 / tdd));
  return null;
}

function projectBgAfterMeal(
  currentBg: number,
  mealCarbs: number,
  insulinUnitsExact: number,
  gramsPerUnit: number,
  isf: number,
  bgUnits: "mmol/L" | "mg/dL",
): number {
  const carbRaise = (mealCarbs / gramsPerUnit) * isf;
  const insulinDrop = insulinUnitsExact * isf;
  const raw = currentBg + carbRaise - insulinDrop;
  return bgUnits === "mmol/L" ? Math.round(raw * 10) / 10 : Math.round(raw);
}

function buildExerciseEffectNote(input: ExerciseFuelCalculatorInput, reductionPercent: number): string {
  const typeKey = input.exerciseType;
  const typeEffects: Partial<Record<ExerciseType, string>> = {
    strength: "Strength training usually drops glucose less during the session",
    cardio: "Cardio tends to lower glucose during effort",
    hiit: "High-intensity work can cause sharp glucose drops",
    walking: "Walking has a mild glucose-lowering effect",
    yoga: "Gentle movement has a small glucose effect",
    swimming: "Swimming often lowers glucose steadily during effort",
    court: "Court sports mix bursts of effort with glucose swings",
    field: "Field sports mix aerobic and anaerobic effort",
  };
  const effect = typeEffects[typeKey] ?? "Exercise changes how your body uses glucose";
  return `${effect} — meal insulin reduced ${reductionPercent}% for ${intensityLabel(input.intensity)} ${activityLabel(input.exerciseType)}, ${input.durationMinutes} min.`;
}

type KnownCarbsInsulinResult = MealInsulinAttempt & {
  projection: ExerciseFuelProjection | null;
  exerciseEffectNote: string | null;
};

/**
 * Smart pre-exercise insulin for "I know my carbs": projects BG rise from the planned meal,
 * tunes dose toward the exercise target band, and applies exercise-type reduction.
 */
function computeKnownCarbsInsulin(
  input: ExerciseFuelCalculatorInput,
  mealCarbs: number,
): KnownCarbsInsulinResult {
  const currentBg = input.currentBg;
  const bgUnits = input.bgUnits === "mg/dL" ? "mg/dL" : "mmol/L";
  const targetBand = planTargetBand(input.bgUnits);
  const idealLow = preExerciseIdealLowBg(bgUnits);
  const idealHigh = preExerciseIdealHighBg(bgUnits);
  const targetMid = preExerciseTargetMidpoint(bgUnits);

  if (currentBg == null || !Number.isFinite(currentBg)) {
    return {
      insulin: null,
      insulinNoRatios: false,
      suppressedReason: "bg_missing",
      projection: null,
      exerciseEffectNote: null,
    };
  }

  if (isBgBelowHypoThreshold(currentBg, input.settings, bgUnits)) {
    return {
      insulin: null,
      insulinNoRatios: false,
      suppressedReason: "hypo",
      projection: {
        currentBg,
        projectedBgAtStart: null,
        targetBand,
        inTargetAtStart: false,
      },
      exerciseEffectNote: null,
    };
  }

  const meta: MealExerciseMeta = {
    exerciseType: input.exerciseType,
    intensity: input.intensity,
    durationMinutes: input.durationMinutes,
  };
  const preview = getExerciseMealBolusPreview(
    mealCarbs,
    input.mealType,
    input.settings,
    input.bgUnits,
    input.minutesUntilStart,
    meta,
  );

  if (preview.error === "no_ratios" || preview.standardDose == null || preview.exerciseReduction == null) {
    return {
      insulin: null,
      insulinNoRatios: true,
      suppressedReason: null,
      projection: { currentBg, projectedBgAtStart: null, targetBand, inTargetAtStart: false },
      exerciseEffectNote: null,
    };
  }

  const isf = input.settings.correctionFactor;
  const gramsPerUnit = mealRatioGramsPerUnit(input.mealType, input.settings);
  let exactDose = preview.exactDose;
  let mealBolusUnits = preview.dose;

  if (isf != null && isf > 0 && gramsPerUnit != null && currentBg < idealHigh) {
    const carbRaise = (mealCarbs / gramsPerUnit) * isf;
    const tunedExact = Math.max(0, (currentBg + carbRaise - targetMid) / isf);

    if (currentBg < idealLow) {
      // Starting below target: your meal lifts BG — use the lower of exercise-reduced or tuned-to-midpoint dose.
      exactDose = Math.min(preview.exactDose, Math.max(0, tunedExact));
    } else if (currentBg > idealHigh || isPreExerciseHighBg(currentBg, bgUnits)) {
      exactDose = Math.max(preview.exactDose, tunedExact);
    }

    mealBolusUnits = roundInsulinUnits(exactDose);
  }

  if (input.bgTrend === "falling") {
    exactDose = exactDose * 0.75;
    mealBolusUnits = roundInsulinUnits(exactDose);
  }

  const projectedBgAtStart =
    isf != null && isf > 0 && gramsPerUnit != null
      ? projectBgAfterMeal(currentBg, mealCarbs, exactDose, gramsPerUnit, isf, bgUnits)
      : null;

  const correctionBg = projectedBgAtStart ?? currentBg;
  const correction = computePreExerciseCorrectionUnits(
    correctionBg,
    input.bgUnits,
    input.settings,
    preview.exerciseReduction,
  );

  const correctionUnits = correction?.units ?? 0;
  const totalUnits = mealBolusUnits + correctionUnits;

  const projection: ExerciseFuelProjection = {
    currentBg,
    projectedBgAtStart,
    targetBand,
    inTargetAtStart:
      projectedBgAtStart != null ? projectedBgAtStart >= idealLow && projectedBgAtStart <= idealHigh : false,
  };

  return {
    insulin: {
      carbsGrams: mealCarbs,
      mealType: input.mealType,
      standardUnits: preview.standardDose,
      adjustedUnits: mealBolusUnits,
      reductionPercent: preview.exerciseReduction,
      exactAdjusted: exactDose,
      correctionUnits,
      correctionTargetBg: correction?.targetBg,
      totalUnits,
    },
    insulinNoRatios: false,
    suppressedReason: input.bgTrend === "falling" ? "falling" : null,
    projection,
    exerciseEffectNote: buildExerciseEffectNote(input, preview.exerciseReduction),
  };
}

type MealInsulinAttempt = {
  insulin: ExerciseFuelInsulinResult | null;
  insulinNoRatios: boolean;
  suppressedReason: PreExerciseInsulinSuppressedReason | null;
};

function tryMealInsulinForBg(
  input: ExerciseFuelCalculatorInput,
  mealCarbs: number,
  mealCarbsIsSuggested: boolean,
  bgOverride?: number,
): MealInsulinAttempt {
  const currentBg = bgOverride ?? input.currentBg;

  const insulinDecision = shouldSuggestPreExerciseMealInsulin({
    currentBg,
    bgTrend: bgOverride != null ? "flat" : input.bgTrend,
    bgUnits: input.bgUnits,
    mealCarbsIsSuggested,
    mealCarbsGrams: mealCarbs,
    settings: input.settings,
  });

  if (mealCarbs <= 0 || !insulinDecision.suggest) {
    return {
      insulin: null,
      insulinNoRatios: false,
      suppressedReason: insulinDecision.suppressedReason ?? null,
    };
  }

  const meta: MealExerciseMeta = {
    exerciseType: input.exerciseType,
    intensity: input.intensity,
    durationMinutes: input.durationMinutes,
  };
  const preview = getExerciseMealBolusPreview(
    mealCarbs,
    input.mealType,
    input.settings,
    input.bgUnits,
    input.minutesUntilStart,
    meta,
  );

  if (preview.error === "no_ratios" || preview.standardDose == null || preview.exerciseReduction == null) {
    return { insulin: null, insulinNoRatios: true, suppressedReason: null };
  }

  const correction =
    currentBg != null && Number.isFinite(currentBg)
      ? computePreExerciseCorrectionUnits(
          currentBg,
          input.bgUnits,
          input.settings,
          preview.exerciseReduction,
        )
      : null;

  const mealBolusUnits = preview.dose;
  const correctionUnits = correction?.units ?? 0;
  const totalUnits = mealBolusUnits + correctionUnits;

  return {
    insulin: {
      carbsGrams: mealCarbs,
      mealType: input.mealType,
      standardUnits: preview.standardDose,
      adjustedUnits: mealBolusUnits,
      reductionPercent: preview.exerciseReduction,
      exactAdjusted: preview.exactDose,
      correctionUnits,
      correctionTargetBg: correction?.targetBg,
      totalUnits,
    },
    insulinNoRatios: false,
    suppressedReason: null,
  };
}

/**
 * How much faster a session burns through glucose, scaling the low-BG top-up so the same
 * BG deficit gets a bigger cushion for harder effort (which drops BG faster) and a smaller
 * one for gentle sessions (yoga/light) where the same deficit is less urgent to fully close
 * before starting. Conservative — never below 0.8x or above 1.25x.
 */
function lowBgTopUpIntensityFactor(intensity: ExerciseIntensity): number {
  if (intensity === "intense") return 1.25;
  if (intensity === "light") return 0.8;
  return 1;
}

/**
 * Extra carbs to add on top of the session's baseline pre-exercise buffer when current BG is
 * below the comfortable starting band (7 mmol/L · 126 mg/dL) — so the "suggest carbs for me"
 * amount actually scales with *how* low BG is (and how hard the session will be), rather than
 * jumping straight to the same flat session buffer for any reading below the line. Added to
 * (not maxed with) the buffer, since the buffer alone assumes a normal starting BG; a low
 * reading needs that plus a top-up.
 *
 * Uses the same weight-scaled "1g raises ~0.25 mmol/L at 70kg" assumption as the exercise hypo
 * carb calculator, for consistency across the app. Capped for sanity; falls back to a flat,
 * conservative bump for minors/unknown age rather than a false-precision weight-based number.
 */
function computeLowBgCarbTopUp(
  currentBg: number,
  bgUnits: "mmol/L" | "mg/dL",
  profile: Partial<UserProfile> | undefined,
  intensity: ExerciseIntensity,
): number {
  const idealLow = preExerciseIdealLowBg(bgUnits);
  if (currentBg >= idealLow) return 0;

  const bgMmol = bgUnits === "mg/dL" ? currentBg / 18 : currentBg;
  const targetMmol = bgUnits === "mg/dL" ? idealLow / 18 : idealLow;
  const bgDifference = targetMmol - bgMmol;
  if (bgDifference <= 0) return 0;

  const intensityFactor = lowBgTopUpIntensityFactor(intensity);

  if (hypoCalculatorRequiresExplicitWeight(profile?.dateOfBirth)) {
    return Math.round((10 * intensityFactor) / 5) * 5;
  }

  const weightKg = getBodyWeightKgFromProfile(profile) ?? 70;
  const sensitivityFactor = 70 / weightKg;
  const effectiveRise = 0.25 * sensitivityFactor;
  const grams = (bgDifference / effectiveRise) * intensityFactor;
  return Math.min(35, Math.ceil(grams / 5) * 5);
}

function planTargetBand(bgUnits: string): string {
  const units = bgUnits === "mg/dL" ? "mg/dL" : "mmol/L";
  return `${preExerciseIdealLowBg(units)}–${preExerciseIdealHighBg(units)} ${units}`;
}

function buildHeadline(
  input: ExerciseFuelCalculatorInput,
  mealCarbs: number,
  mealCarbsIsSuggested: boolean,
  userEnteredMealCarbs: boolean,
  onHandCarbs: number,
  insulin: ExerciseFuelInsulinResult | null,
  insulinSuppressed: boolean,
  insulinSuppressedReason: PreExerciseInsulinSuppressedReason | null,
): string {
  const session = sessionLabel(input);
  if (userEnteredMealCarbs && mealCarbs > 0) {
    if (insulin && insulin.totalUnits > 0) {
      const parts = [`${insulin.totalUnits} units for ${mealCarbs}g ${mealTypeLabel(input.mealType)}`];
      if (insulin.correctionUnits > 0) {
        parts.push(`includes ${insulin.correctionUnits}u correction toward ${planTargetBand(input.bgUnits)}`);
      }
      return `${session}. ${parts.join(" — ")}.`;
    }
    if (insulinSuppressed && insulinSuppressedReason === "hypo") {
      return `${session}. ${mealCarbs}g planned — treat hypo first, then recheck before insulin.`;
    }
    if (insulinSuppressed) {
      return `${session}. ${mealCarbs}g ${mealTypeLabel(input.mealType)} planned — no insulin suggested at this reading.`;
    }
    return `${session}. Add meal ratios in Settings for an insulin estimate for ${mealCarbs}g.`;
  }
  if (mealCarbs > 0) {
    if (mealCarbsIsSuggested && insulinSuppressed) {
      return `${session}. Plan about ${mealCarbs}g carbs to bring BG up before exercise — no meal insulin suggested at this reading.`;
    }
    if (mealCarbsIsSuggested) {
      return `${session}. Plan about ${mealCarbs}g carbs before you exercise.`;
    }
    if (insulinSuppressed) {
      return `${session}. ${mealCarbs}g ${mealTypeLabel(input.mealType)} before you start — no meal insulin suggested at this reading.`;
    }
    return `${session}. ${mealCarbs}g ${mealTypeLabel(input.mealType)} before you start.`;
  }
  return `${session}. Keep about ${onHandCarbs}g fast carbs within reach.`;
}

function pickNotes(
  input: ExerciseFuelCalculatorInput,
  plan: ReturnType<typeof calculateExercisePlan>,
  mealCarbs: number,
  insulinSuppressedReason: PreExerciseInsulinSuppressedReason | null,
  mealCarbsSkipReason: PreExerciseMealCarbsSkipReason | null,
  userEnteredMealCarbs: boolean,
  projection: ExerciseFuelProjection | null,
  lowBgCarbTopUpGrams: number,
): string[] {
  const notes: string[] = [];
  const units = input.bgUnits;
  const bgUnits = units === "mg/dL" ? "mg/dL" : "mmol/L";
  const high = units === "mmol/L" ? 13.9 : 250;

  if (mealCarbsSkipReason) {
    notes.push(preExerciseMealCarbsSkipMessage(mealCarbsSkipReason, units));
  }

  if (lowBgCarbTopUpGrams > 0 && input.currentBg != null) {
    const startBand = units === "mmol/L" ? "7 mmol/L" : "126 mg/dL";
    notes.push(
      `Added ~${lowBgCarbTopUpGrams}g on top of your usual buffer because your BG (${input.currentBg} ${units}) is below the ${startBand} starting line.`,
    );
  }

  if (userEnteredMealCarbs && projection?.projectedBgAtStart != null && mealCarbs > 0) {
    notes.push(
      `Your ${mealCarbs}g pre-exercise meal should bring you to about ${projection.projectedBgAtStart} ${units} at start (target ${projection.targetBand}).`,
    );
  } else if (insulinSuppressedReason && !(userEnteredMealCarbs && insulinSuppressedReason === "falling")) {
    notes.push(preExerciseInsulinSuppressedMessage(insulinSuppressedReason, units, input.settings));
  }

  if (input.bgTrend === "falling" && userEnteredMealCarbs && mealCarbs > 0) {
    notes.push("BG is falling — dose reduced; recheck before you start hard effort.");
  }

  if (input.currentBg == null && mealCarbs <= 0) {
    notes.push("Add current BG and trend — they change whether we suggest eating now or only keeping fast carbs on hand.");
  }

  if (input.currentBg != null && isBgBelowHypoThreshold(input.currentBg, input.settings, bgUnits)) {
    if (!userEnteredMealCarbs) {
      notes.push("Your BG looks low — treat and recheck before you rely on these numbers.");
    }
  } else if (
    input.currentBg != null &&
    isExerciseStartLow(input.currentBg, units) &&
    !userEnteredMealCarbs
  ) {
    if (!insulinSuppressedReason) {
      notes.push("Your BG is below a typical exercise-start range — treat and recheck before hard effort.");
    }
  } else if (input.currentBg != null && input.currentBg > high) {
    notes.push("BG looks high — follow your team's advice on ketones and fluids before hard effort.");
  }

  if (input.currentBg != null && Number.isFinite(input.currentBg)) {
    const readingTips = getExerciseGuidanceForReading({
      bg: input.currentBg,
      trend: input.bgTrend ?? undefined,
      bgUnits: units,
      exerciseType: input.exerciseType,
      intensity: input.intensity,
      phase: "pre",
    });
    for (const tip of readingTips) {
      if (notes.length >= 3) break;
      if (!notes.includes(tip)) notes.push(tip);
    }
  }

  if (input.rapidInsulinLast2h) {
    notes.push("Rapid insulin in the last 2 hours can stack with exercise — keep extra fast carbs nearby.");
  }

  if (input.bgTrend === "falling") {
    notes.push("You noted BG is falling — ease in and recheck if effort ramps up.");
  }

  if (input.fasted && mealCarbs > 0) {
    notes.push("You are training fasted but planning pre-workout carbs — that is often a good safety buffer for harder sessions.");
  } else if (input.fasted && mealCarbs <= 0 && plan.pre.carbsIfLow > 0) {
    notes.push("Fasted session — many people use a small carb buffer before harder work; discuss with your team.");
  }

  if (input.lastMealMinutesAgo != null && input.lastMealMinutesAgo < 60 && !input.fasted) {
    notes.push(
      `You ate ~${input.lastMealMinutesAgo} min ago${input.lastMealCarbsGrams != null ? ` (~${input.lastMealCarbsGrams}g)` : ""} — insulin and digestion may still be active.`,
    );
  }

  const contextual = plan.pre.contextualNotes?.[0];
  if (contextual && notes.length < 3) notes.push(contextual);

  return notes.slice(0, 3);
}

function computeSessionFuel(
  input: ExerciseFuelCalculatorInput,
  plan: ExercisePlanResult,
  userEnteredMealCarbs: boolean,
): ExerciseSessionFuel {
  const carry = computeActiveWorkoutFuelCarry({
    plan,
    exerciseType: input.exerciseType,
    intensity: input.intensity,
  });
  const duringFromPlan = plan.during.carbsNeeded;
  const carbFrequency = plan.during.carbFrequency;

  if (carry) {
    return {
      carryGrams: carry.carryGrams,
      duringTotalGrams: Math.max(duringFromPlan, carry.carryGrams),
      doseGrams: carry.doseGrams,
      intervalMinutes: carry.intervalMinutes,
      carbFrequency,
    };
  }

  const fallbackCarry = userEnteredMealCarbs
    ? duringFromPlan
    : Math.max(plan.pre.carbsIfLow, duringFromPlan);

  return {
    carryGrams: fallbackCarry,
    duringTotalGrams: duringFromPlan,
    carbFrequency,
  };
}

/**
 * Personalized pre-exercise fuel + meal insulin estimate from all calculator inputs.
 */
export function computeExerciseFuelPlan(input: ExerciseFuelCalculatorInput): ExerciseFuelCalculatorResult {
  const plan = calculateExercisePlan(buildPlanContext(input), input.settings);

  const userMealCarbs = input.mealCarbsGrams != null && input.mealCarbsGrams > 0 ? input.mealCarbsGrams : 0;
  const mealCarbsIsSuggested = userMealCarbs <= 0;
  const preBufferGrams = plan.pre.carbsIfLow;
  const userEnteredMealCarbs = userMealCarbs > 0;
  const sessionFuel = computeSessionFuel(input, plan, userEnteredMealCarbs);
  const onHandCarbs = sessionFuel.carryGrams;
  const duringCarbs = sessionFuel.duringTotalGrams;

  let mealCarbs = 0;
  let mealCarbsSkipReason: PreExerciseMealCarbsSkipReason | null = null;
  let lowBgCarbTopUpGrams = 0;
  const bgUnitsNormalized = input.bgUnits === "mg/dL" ? "mg/dL" : "mmol/L";

  if (mealCarbsIsSuggested) {
    const carbsDecision = shouldSuggestPreExerciseMealCarbs({
      currentBg: input.currentBg,
      bgTrend: input.bgTrend,
      bgUnits: input.bgUnits,
      fasted: input.fasted,
      bufferGrams: preBufferGrams,
      settings: input.settings,
    });
    if (carbsDecision.suggest) {
      if (input.currentBg != null && Number.isFinite(input.currentBg)) {
        lowBgCarbTopUpGrams = computeLowBgCarbTopUp(input.currentBg, bgUnitsNormalized, input.profile, input.intensity);
      }
      mealCarbs = preBufferGrams + lowBgCarbTopUpGrams;
    } else if (carbsDecision.skipReason) {
      mealCarbsSkipReason = carbsDecision.skipReason;
    }
  } else {
    mealCarbs = userMealCarbs;
  }

  let insulin: ExerciseFuelInsulinResult | null = null;
  let projectedInsulinAtTarget: ExerciseFuelInsulinResult | null = null;
  let projection: ExerciseFuelProjection | null = null;
  let exerciseEffectNote: string | null = null;
  let insulinNoRatios = false;
  let insulinSuppressedReason: PreExerciseInsulinSuppressedReason | null = null;

  if (mealCarbs > 0) {
    if (userEnteredMealCarbs) {
      const known = computeKnownCarbsInsulin(input, mealCarbs);
      insulin = known.insulin;
      insulinNoRatios = known.insulinNoRatios;
      insulinSuppressedReason = known.suppressedReason;
      projection = known.projection;
      exerciseEffectNote = known.exerciseEffectNote;
    } else {
      const attempt = tryMealInsulinForBg(input, mealCarbs, mealCarbsIsSuggested);
      insulin = attempt.insulin;
      insulinNoRatios = attempt.insulinNoRatios;
      insulinSuppressedReason = attempt.suppressedReason;
    }
  }

  const headline = buildHeadline(
    input,
    mealCarbs,
    mealCarbsIsSuggested && mealCarbs > 0,
    userEnteredMealCarbs,
    onHandCarbs,
    insulin,
    insulinSuppressedReason != null && insulin == null,
    insulinSuppressedReason,
  );

  const breakdown: ExerciseFuelCalculationBreakdown = {
    intensityLabel: intensityLabel(input.intensity),
    activityLabel: activityLabel(input.exerciseType),
    durationMinutes: input.durationMinutes,
    preBufferGrams,
    duringGrams: plan.during.carbsNeeded,
    onHandGrams: sessionFuel.carryGrams,
    mealCarbsSource: !mealCarbsIsSuggested ? "user" : mealCarbs > 0 ? "suggested" : "none",
    mealCarbsSkipReason: mealCarbsSkipReason ?? undefined,
    ratioDescription:
      mealCarbs > 0 ? describeRatioUsed(input.mealType, input.settings) : undefined,
    standardUnits: insulin?.standardUnits,
    reductionPercent: insulin?.reductionPercent,
    adjustedUnitsExact: insulin?.exactAdjusted,
    lowBgCarbTopUpGrams: lowBgCarbTopUpGrams > 0 ? lowBgCarbTopUpGrams : undefined,
  };

  return {
    headline,
    targetBg: plan.pre.targetBg,
    mealCarbs,
    mealCarbsIsSuggested: mealCarbsIsSuggested && mealCarbs > 0,
    userEnteredMealCarbs,
    onHandCarbs,
    duringCarbs,
    sessionFuel,
    insulin,
    projectedInsulinAtTarget,
    insulinSuppressedReason,
    insulinNoRatios,
    bolusReductionBand: plan.pre.bolusReduction,
    pumpTip: input.isPump && plan.pumpTips.pre[0] ? plan.pumpTips.pre[0]! : null,
    notes: pickNotes(
      input,
      plan,
      mealCarbs,
      insulinSuppressedReason,
      mealCarbsSkipReason,
      userEnteredMealCarbs,
      projection,
      lowBgCarbTopUpGrams,
    ),
    mealCarbsSkipReason,
    projection,
    exerciseEffectNote,
    breakdown,
  };
}

import {
  EXERCISE_INTENSITY_OPTIONS,
  EXERCISE_MEAL_TYPE_OPTIONS,
  EXERCISE_TYPE_OPTIONS,
} from "@/lib/exercise-catalog";
import { calculateExercisePlan, type ExercisePlanContext } from "@/lib/exercise-plan";
import {
  getExerciseMealBolusPreview,
  type MealExerciseMeta,
} from "@/lib/meal-dose";
import type { ExerciseBgTrend, ExerciseIntensity, ExerciseType, UserSettings } from "@/lib/storage";

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
};

export type ExerciseFuelInsulinResult = {
  carbsGrams: number;
  mealType: string;
  standardUnits: number;
  adjustedUnits: number;
  reductionPercent: number;
  exactAdjusted: number;
};

export type ExerciseFuelCalculatorResult = {
  /** Short headline for the result card. */
  headline: string;
  targetBg: string;
  /** Carbs for the pre-workout meal (user entry or suggestion). */
  mealCarbs: number;
  mealCarbsIsSuggested: boolean;
  /** Fast carbs to keep available (during / if low). */
  onHandCarbs: number;
  duringCarbs: number;
  insulin: ExerciseFuelInsulinResult | null;
  insulinNoRatios: boolean;
  /** Fallback % band when ratios are missing. */
  bolusReductionBand: string;
  pumpTip: string | null;
  /** Up to 3 short, input-specific notes. */
  notes: string[];
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

function buildHeadline(
  input: ExerciseFuelCalculatorInput,
  mealCarbs: number,
  mealCarbsIsSuggested: boolean,
  onHandCarbs: number,
): string {
  const session = sessionLabel(input);
  if (mealCarbs > 0) {
    if (mealCarbsIsSuggested) {
      return `${session}. Plan about ${mealCarbs}g carbs before you exercise.`;
    }
    return `${session}. ${mealCarbs}g ${mealTypeLabel(input.mealType)} before you start.`;
  }
  return `${session}. Keep about ${onHandCarbs}g fast carbs within reach.`;
}

function pickNotes(
  input: ExerciseFuelCalculatorInput,
  plan: ReturnType<typeof calculateExercisePlan>,
  mealCarbs: number,
): string[] {
  const notes: string[] = [];
  const units = input.bgUnits;
  const low = units === "mmol/L" ? 3.9 : 70;
  const high = units === "mmol/L" ? 13.9 : 250;

  if (input.currentBg != null && input.currentBg < low) {
    notes.push("Your BG looks low — treat and recheck before you rely on these numbers.");
  } else if (input.currentBg != null && input.currentBg > high) {
    notes.push("BG looks high — follow your team's advice on ketones and fluids before hard effort.");
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

/**
 * Personalized pre-exercise fuel + meal insulin estimate from all calculator inputs.
 */
export function computeExerciseFuelPlan(input: ExerciseFuelCalculatorInput): ExerciseFuelCalculatorResult {
  const plan = calculateExercisePlan(buildPlanContext(input));

  const userMealCarbs = input.mealCarbsGrams != null && input.mealCarbsGrams > 0 ? input.mealCarbsGrams : 0;
  const mealCarbsIsSuggested = userMealCarbs <= 0;
  const mealCarbs = mealCarbsIsSuggested ? plan.pre.carbsIfLow : userMealCarbs;

  const onHandCarbs = Math.max(plan.pre.carbsIfLow, plan.during.carbsNeeded);
  const duringCarbs = plan.during.carbsNeeded;

  let insulin: ExerciseFuelInsulinResult | null = null;
  let insulinNoRatios = false;

  if (mealCarbs > 0) {
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
      insulinNoRatios = true;
    } else {
      insulin = {
        carbsGrams: mealCarbs,
        mealType: input.mealType,
        standardUnits: preview.standardDose,
        adjustedUnits: preview.dose,
        reductionPercent: preview.exerciseReduction,
        exactAdjusted: preview.exactDose,
      };
    }
  }

  const headline = buildHeadline(input, mealCarbs, mealCarbsIsSuggested, onHandCarbs);

  return {
    headline,
    targetBg: plan.pre.targetBg,
    mealCarbs,
    mealCarbsIsSuggested,
    onHandCarbs,
    duringCarbs,
    insulin,
    insulinNoRatios,
    bolusReductionBand: plan.pre.bolusReduction,
    pumpTip: input.isPump && plan.pumpTips.pre[0] ? plan.pumpTips.pre[0]! : null,
    notes: pickNotes(input, plan, mealCarbs),
  };
}

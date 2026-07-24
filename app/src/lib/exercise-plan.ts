/**
 * Rule-based exercise planning copy — not medical advice.
 * Heuristics are conservative; users must confirm with their care team.
 */

import type { ExerciseBgTrend } from "@/lib/storage";
import type { UserSettings } from "@/lib/storage";
import {
  closedLoopPrePumpLeadIn,
  resolveExercisePumpTips,
} from "@/lib/exercise-closed-loop";
import { usesClosedLoop } from "@/lib/closed-loop";

export interface ExercisePlanResult {
  duration: number;
  intensity: string;
  exerciseType: string;
  summary: string;
  pre: {
    targetBg: string;
    lowThreshold: string;
    carbsIfLow: number;
    bolusReduction: string;
    snackIdeas: string[];
    timing: string;
    /** Food/insulin context — shown above generic pre rows. */
    contextualNotes?: string[];
  };
  during: {
    carbsNeeded: number;
    needsCarbs: boolean;
    carbFrequency: string;
    checkBg: boolean;
    tips: string[];
  };
  post: {
    carbs: number;
    protein: string;
    bolusReduction: string;
    snackIdeas: string[];
    timing: string;
  };
  recovery: {
    monitorHours: string;
    tips: string[];
  };
  pumpTips: {
    pre: string[];
    during: string[];
    post: string[];
    recovery: string[];
  };
}

/** Nutrition pattern relative to the session (optional in UI). */
export type ExerciseNutritionContext = "fasted" | "ate_recently" | "about_to_eat" | "snack_only";

/** Time since last bolus or meal insulin (optional). */
export type LastInsulinTiming = "none" | "lt_1h" | "h1_2" | "h2_4" | "gt_4h";

/** Planned snack/meal with bolus before the session starts (optional). */
export type PlannedPreExerciseFuel = "none" | "snack_bolus" | "meal_bolus";

/** Environment for the planned session. */
export type ExerciseEnvironment = "indoor" | "outdoor_normal" | "outdoor_hot" | "outdoor_cold" | "altitude";

/** Past response of the same routine, summarised for biasing fuel and bolus. */
export type ExerciseHistoryBias = {
  /** Number of prior outcomes considered. */
  totalSessions: number;
  /** Direction of typical BG response. */
  typicalResponse: "dropped" | "stable" | "rose";
  /** Whether hypos were common in those outcomes. */
  hypoProne: boolean;
};

export interface ExercisePlanContext {
  /** Planner keys: cardio, strength, hiit, yoga, walking, court, field, swimming */
  exerciseType: string;
  durationMinutes: number;
  intensity: "light" | "moderate" | "intense";
  /** Minutes until session starts (from "Starting in…"). */
  minutesUntilStart: number;
  bgUnits?: string;
  nutritionContext?: ExerciseNutritionContext;
  /** When ate_recently / snack_only: minutes since last meal or snack. */
  minutesSinceLastMeal?: number;
  /** Legacy/API: when nutritionContext is about_to_eat without planned pre-exercise fuel; prefer minutesUntilPreExerciseFuel for upcoming bolus+food. */
  minutesUntilNextMeal?: number;
  approximateCarbsGrams?: number;
  lastInsulinTiming?: LastInsulinTiming;
  /** Planned snack or meal with bolus before exercise; pair with minutesUntilPreExerciseFuel. */
  plannedPreExerciseFuel?: PlannedPreExerciseFuel;
  /** Minutes until that snack/meal (when snack_bolus or meal_bolus). */
  minutesUntilPreExerciseFuel?: number;
  /** Current BG if user entered it. */
  currentBg?: number;
  /** CGM or meter trend when user sets it (optional). */
  bgTrend?: ExerciseBgTrend;
  /** Local hour 0–23 for evening / overnight recovery copy. */
  hourOfDay?: number;

  // ----- Deeper guided coach context (all optional; defaults preserve legacy behaviour) -----
  /** Hours of sleep last night; <6 is treated as a caution amplifier. */
  sleepHoursLastNight?: number;
  /** Subjective hydration ok/low. */
  hydration?: "ok" | "low";
  /** Generic feeling-off / stress flag. */
  feelingOff?: boolean;
  /** Environmental context (heat/cold/altitude shift fuel + caution). Legacy single-select. */
  environment?: ExerciseEnvironment;
  /** When set, each matching environment applies its modifier (venue + altitude can stack). */
  environments?: ExerciseEnvironment[];
  /** Group / competitive sessions tend to push harder than solo workouts. */
  competitive?: boolean;
  /** Caffeine in last ~2h (small alertness/glucose effect, mostly noted in tips). */
  caffeineLast2h?: boolean;
  /** Alcohol last night (delayed-low risk for many people). */
  alcoholLastNight?: boolean;
  /** GLP-1 medication taken in last 24h (slower digestion / different fuel response). */
  glp1Last24h?: boolean;
  /** Beta-blocker today (blunted hypo awareness). */
  betaBlockerToday?: boolean;
  /** Known IOB units (pump or mental tally) for caution copy only. */
  iobUnits?: number;
  /** Bias from prior outcomes for the same routine. */
  historyBias?: ExerciseHistoryBias;
}

const VENUE_ENVIRONMENTS: readonly ExerciseEnvironment[] = ["indoor", "outdoor_normal", "outdoor_hot", "outdoor_cold"];

/**
 * Normalises environment inputs: at most one venue (indoor / outdoor variants) plus optional altitude.
 * `environments` wins when non-empty; otherwise falls back to legacy `environment`.
 */
export function normalizeExercisePlanEnvironments(context: ExercisePlanContext): ExerciseEnvironment[] {
  const raw: ExerciseEnvironment[] = [];
  if (context.environments?.length) raw.push(...context.environments);
  else if (context.environment) raw.push(context.environment);

  let venue: ExerciseEnvironment | undefined;
  let hasAltitude = false;
  for (const e of raw) {
    if (e === "altitude") hasAltitude = true;
    else if ((VENUE_ENVIRONMENTS as readonly string[]).includes(e)) venue = e;
  }
  const out: ExerciseEnvironment[] = [];
  if (venue) out.push(venue);
  if (hasAltitude) out.push("altitude");
  return out;
}

const EXERCISE_LABELS: Record<string, string> = {
  cardio: "Cardio",
  strength: "Strength",
  hiit: "HIIT",
  yoga: "Yoga",
  walking: "Walking",
  swimming: "Swimming",
  court: "Court sports",
  field: "Field sports",
  exercise: "Exercise",
};

function normalizeType(key: string): string {
  const k = key.toLowerCase();
  if (k === "hiit") return "HIIT";
  return EXERCISE_LABELS[k] ? k : "exercise";
}

function displayType(key: string): string {
  const k = key.toLowerCase();
  if (k === "hiit") return "HIIT";
  return EXERCISE_LABELS[k] || key;
}

function isBgLow(value: number, bgUnits: string): boolean {
  return bgUnits === "mmol/L" ? value < 5.6 : value < 100;
}

function isBgHigh(value: number, bgUnits: string): boolean {
  return bgUnits === "mmol/L" ? value > 13.9 : value > 250;
}

/** Recent meal insulin on board — higher hypo risk during activity. */
function hasRecentInsulin(timing: LastInsulinTiming | undefined): boolean {
  return timing === "lt_1h" || timing === "h1_2";
}

function hasModerateInsulin(timing: LastInsulinTiming | undefined): boolean {
  return timing === "h2_4";
}

/**
 * Round a final gram target to the nearest 5g step for practical dosing, biased down when the
 * *combined* type + deeper-context multiplier is a net decrease and up when it's a net increase
 * (so a deliberate nudge — e.g. cardio's during-carb bump — stays visible after rounding).
 *
 * Intentionally called only ONCE per pre/during/post value, after every multiplier has already
 * been applied to the full-precision number. Previously this same bias was applied at each
 * intermediate stage (base curve, then type nudge, then deeper context), which compounds: a
 * mild, intended trim (e.g. strength's ~8%) could land just under a 5g boundary after the first
 * rounding pass and then get floored a second time, turning an ~8% trim into a 50% cut. Applying
 * the bias once, to the combined multiplier, keeps nudges visible without amplifying them.
 */
function roundGramsForNudge(raw: number, aggregateMultiplier: number): number {
  if (raw <= 0) return 0;
  if (aggregateMultiplier < 1) return Math.floor(raw / 5) * 5;
  if (aggregateMultiplier > 1) return Math.ceil(raw / 5) * 5;
  return Math.round(raw / 5) * 5;
}

/**
 * Environmental + history multipliers applied on top of intensity/type adjustments.
 * Conservative — never below 0.7 or above 1.6 in aggregate.
 */
function deeperContextCarbMultipliers(context: ExercisePlanContext): { pre: number; during: number; post: number } {
  let pre = 1;
  let during = 1;
  let post = 1;

  const envs = normalizeExercisePlanEnvironments(context);
  for (const e of envs) {
    if (e === "outdoor_hot") {
      during *= 1.15;
      post *= 1.05;
    } else if (e === "outdoor_cold") {
      pre *= 1.05;
    } else if (e === "altitude") {
      during *= 1.1;
      post *= 1.05;
    }
  }

  if (context.competitive) {
    during *= 1.05;
    post *= 1.05;
  }

  if (context.alcoholLastNight) {
    post *= 1.1;
  }

  if (context.sleepHoursLastNight != null && context.sleepHoursLastNight < 6) {
    during *= 1.05;
    post *= 1.05;
  }

  // GLP-1 meds slow gastric emptying and appetite — fast carbs act more slowly and less
  // predictably, so keep a bit more in reach during and after the session.
  if (context.glp1Last24h) {
    during *= 1.1;
    post *= 1.05;
  }

  const hist = context.historyBias;
  if (hist && hist.totalSessions >= 2) {
    if (hist.typicalResponse === "dropped" || hist.hypoProne) {
      pre *= 1.1;
      during *= 1.1;
      post *= 1.05;
    } else if (hist.typicalResponse === "rose") {
      pre *= 0.95;
    }
  }

  pre = Math.min(1.6, Math.max(0.7, pre));
  during = Math.min(1.6, Math.max(0.7, during));
  post = Math.min(1.6, Math.max(0.7, post));
  return { pre, during, post };
}

/**
 * Conservative type-based nudges to pre/during/post carb heuristics (same intensity + duration
 * can differ slightly by activity pattern). Not a substitute for care-team guidance.
 */
function applyExerciseTypeCarbAdjustments(
  typeKey: string,
  intensity: "light" | "moderate" | "intense",
  pre: number,
  during: number,
  post: number,
): { pre: number; during: number; post: number; preM: number; duringM: number; postM: number } {
  const k = typeKey.toLowerCase();
  let preM = 1;
  let duringM = 1;
  let postM = 1;

  switch (k) {
    case "cardio":
      duringM = 1.08;
      postM = 1.05;
      break;
    case "strength":
      preM = 0.92;
      duringM = 0.82;
      postM = 1.12;
      break;
    case "hiit":
      duringM = 1.1;
      postM = 1.12;
      break;
    case "yoga":
      preM = 0.88;
      duringM = 0.88;
      postM = 0.88;
      break;
    case "walking":
      duringM = 1.05;
      break;
    case "swimming":
      duringM = 1.08;
      postM = 1.05;
      break;
    case "court":
      duringM = 1.1;
      postM = 1.06;
      break;
    case "field":
      duringM = 1.08;
      postM = 1.05;
      break;
    default:
      break;
  }

  // Light sessions: smaller nudges so yoga/walking do not over-correct.
  if (intensity === "light") {
    preM = 1 + (preM - 1) * 0.5;
    duringM = 1 + (duringM - 1) * 0.5;
    postM = 1 + (postM - 1) * 0.5;
  }

  // Kept unrounded here — rounding happens once, at the very end of calculateExercisePlan,
  // after deeper-context multipliers have also been applied.
  const outPre = pre * preM;
  let outDuring = during * duringM;
  const outPost = post * postM;
  let duringMForRounding = duringM;

  // HIIT at moderate+: small extra during buffer when base during was 0 but session is glycolytic.
  if (k === "hiit" && (intensity === "moderate" || intensity === "intense") && outDuring === 0 && during === 0) {
    outDuring = intensity === "intense" ? 10 : 5;
    // This is a fixed floor addition, not a proportional nudge — let any deeper-context
    // multiplier alone decide the final rounding direction for this value.
    duringMForRounding = 1;
  }

  return { pre: outPre, during: outDuring, post: outPost, preM, duringM: duringMForRounding, postM };
}

type ExerciseIntensityKey = "light" | "moderate" | "intense";

/**
 * Duration-scaling curve: ramps linearly from `base` once the session passes
 * `thresholdMin`, at `ratePerMin` grams per minute beyond that, capped at `cap`.
 * Replaces old fixed step-thresholds (e.g. "20g for anything 20-300 min") so duration
 * keeps influencing the number across the whole range instead of flattening out after
 * one breakpoint. Grams are rounded to the nearest 5g for practical dosing.
 */
type CarbRampCurve = { thresholdMin: number; base: number; ratePerMin: number; cap: number };

function rampGrams(duration: number, curve: CarbRampCurve): number {
  if (duration < curve.thresholdMin) return 0;
  const raw = curve.base + curve.ratePerMin * (duration - curve.thresholdMin);
  return Math.min(curve.cap, Math.max(0, raw));
}

/** Post-exercise: a floor that matches typical short/default sessions, ramping up only for longer ones. */
function rampGramsWithFloor(duration: number, curve: CarbRampCurve): number {
  if (duration <= curve.thresholdMin) return curve.base;
  const raw = curve.base + curve.ratePerMin * (duration - curve.thresholdMin);
  return Math.min(curve.cap, Math.max(curve.base, raw));
}

/** Carbs to eat now if BG is low, sized as a pre-exercise buffer — scales with duration and intensity. */
const PRE_EXERCISE_CARB_CURVE: Record<ExerciseIntensityKey, CarbRampCurve> = {
  light: { thresholdMin: 20, base: 10, ratePerMin: 0.12, cap: 25 },
  moderate: { thresholdMin: 15, base: 10, ratePerMin: 0.3, cap: 35 },
  intense: { thresholdMin: 10, base: 15, ratePerMin: 0.4, cap: 40 },
};

/** Fast carbs to have ready during the session — starts once a session is long enough to matter. */
const DURING_EXERCISE_CARB_CURVE: Record<ExerciseIntensityKey, CarbRampCurve> = {
  light: { thresholdMin: 45, base: 0, ratePerMin: 0.3, cap: 60 },
  moderate: { thresholdMin: 20, base: 0, ratePerMin: 0.7, cap: 70 },
  intense: { thresholdMin: 15, base: 0, ratePerMin: 1.0, cap: 80 },
};

/** Recovery carbs — flat floor for typical sessions, ramping up for longer ones (more glycogen used). */
const POST_EXERCISE_CARB_CURVE: Record<ExerciseIntensityKey, CarbRampCurve> = {
  light: { thresholdMin: 45, base: 15, ratePerMin: 0.12, cap: 30 },
  moderate: { thresholdMin: 45, base: 20, ratePerMin: 0.18, cap: 40 },
  intense: { thresholdMin: 45, base: 30, ratePerMin: 0.2, cap: 50 },
};

const BASE_BOLUS_REDUCTION: Record<ExerciseIntensityKey, string> = {
  light: "15-25%",
  moderate: "25-35%",
  intense: "35-50%",
};

/**
 * Duration shift for the bolus-reduction band, anchored at 45 min (0 shift) so the
 * default session length matches prior guidance exactly. Longer sessions increase
 * insulin sensitivity more (bias the range higher); short sessions bias it lower.
 * Capped so duration alone can't push the band to an extreme.
 */
function bolusReductionDurationShift(duration: number): number {
  const raw = (duration - 45) * 0.15;
  return Math.round(Math.min(15, Math.max(-10, raw)));
}

function baseCarbsAndBolus(
  intensity: ExerciseIntensityKey,
  duration: number,
): { preExerciseCarbs: number; duringCarbs: number; postExerciseCarbs: number; bolusReduction: string } {
  const preExerciseCarbs = rampGrams(duration, PRE_EXERCISE_CARB_CURVE[intensity]);
  const duringCarbs = rampGrams(duration, DURING_EXERCISE_CARB_CURVE[intensity]);
  const postExerciseCarbs = rampGramsWithFloor(duration, POST_EXERCISE_CARB_CURVE[intensity]);

  const shift = bolusReductionDurationShift(duration);
  const bolusReduction = shift === 0 ? BASE_BOLUS_REDUCTION[intensity] : shiftBolusReductionRange(BASE_BOLUS_REDUCTION[intensity], shift, shift);

  return { preExerciseCarbs, duringCarbs, postExerciseCarbs, bolusReduction };
}

function parseBolusReductionRange(range: string): { lo: number; hi: number } | null {
  const m = range.match(/^(\d+)-(\d+)%$/);
  if (!m) return null;
  const lo = parseInt(m[1]!, 10);
  const hi = parseInt(m[2]!, 10);
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return null;
  if (lo < 0 || hi < 0) return null;
  if (hi < lo) return null;
  return { lo, hi };
}

/** Shift a reduction range by deltas; clamps to [0, 60]. */
function shiftBolusReductionRange(range: string, deltaLo: number, deltaHi: number): string {
  const parsed = parseBolusReductionRange(range);
  if (!parsed) return range;
  const lo = Math.min(60, Math.max(0, parsed.lo + deltaLo));
  const hi = Math.min(60, Math.max(0, parsed.hi + deltaHi));
  const outLo = Math.min(lo, hi);
  const outHi = Math.max(lo, hi);
  return `${outLo}-${outHi}%`;
}

/**
 * Exercise-type adjustment for post-exercise bolus reduction guidance.\n
 * Aerobic-heavy sessions tend to increase insulin sensitivity more than anaerobic-heavy sessions.\n
 * This only adjusts the educational range string; users must follow care-team rules.\n
 */
function applyExerciseTypeBolusAdjustments(
  typeKey: string,
  intensity: "light" | "moderate" | "intense",
  bolusReduction: string,
): string {
  const k = typeKey.toLowerCase();

  // Strength/anaerobic dominant: typically *less* reduction vs cardio at same intensity.
  if (k === "strength") {
    return shiftBolusReductionRange(bolusReduction, -10, -10);
  }
  // HIIT: mixed; many people still see a delayed dip, but often less than steady cardio.
  if (k === "hiit") {
    return shiftBolusReductionRange(bolusReduction, -5, -5);
  }
  // Yoga/walking: generally lighter aerobic load → smaller reduction.
  if (k === "yoga" || k === "walking") {
    return shiftBolusReductionRange(bolusReduction, -5, -5);
  }
  // Court/field sports: mixed aerobic/anaerobic; keep baseline but avoid overstating for light sessions.
  if ((k === "court" || k === "field") && intensity === "light") {
    return shiftBolusReductionRange(bolusReduction, -5, -5);
  }

  // Cardio / swimming: baseline.
  return bolusReduction;
}

/**
 * Bias a bolus-reduction range string toward its higher end (clamped at 50%).
 * Examples: "15-25%" → "20-30%", "25-35%" → "30-45%", "35-50%" → "40-50%".
 */
function biasBolusReductionHigher(range: string): string {
  const m = range.match(/^(\d+)-(\d+)%$/);
  if (!m) return range;
  const lo = parseInt(m[1]!, 10);
  const hi = parseInt(m[2]!, 10);
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return range;
  const newLo = Math.min(50, lo + 5);
  const newHi = Math.min(50, hi + 5);
  return `${newLo}-${newHi}%`;
}

function pumpTipsForIntensity(intensity: "light" | "moderate" | "intense"): ExercisePlanResult["pumpTips"] {
  if (intensity === "light") {
    return {
      pre: ["Consider a 20-30% temporary basal reduction starting 60 min before"],
      during: ["Your pump's current basal may be sufficient for light activity"],
      post: ["Resume normal basal rate after light exercise"],
      recovery: ["No overnight basal change typically needed for light exercise"],
    };
  }
  if (intensity === "moderate") {
    return {
      pre: ["Set a temporary basal rate at 50-70% (30-50% reduction) starting 60-90 min before exercise"],
      during: ["If BG drops below target, reduce or suspend temp basal"],
      post: ["Keep temp basal running at 70-80% for 1-2 hours after exercise"],
      recovery: ["Consider running basal at 80-90% overnight if exercised in the evening"],
    };
  }
  return {
    pre: ["Set a temporary basal rate at 30-50% (50-70% reduction) starting 60-90 min before exercise"],
    during: [
      "Be ready to suspend pump briefly if BG drops rapidly",
      "Some people disconnect for water sports - discuss with your team first",
    ],
    post: ["Keep temp basal at 60-70% for 2-3 hours post-exercise"],
    recovery: ["Run basal at 70-80% overnight - intense exercise increases hypo risk for up to 24 hours"],
  };
}

/**
 * Primary API: structured exercise + optional food/insulin context.
 */
export function calculateExercisePlan(
  context: ExercisePlanContext,
  settings?: UserSettings | null,
): ExercisePlanResult {
  const bgUnits = context.bgUnits || "mmol/L";
  const duration = Math.max(5, Math.min(300, Math.round(context.durationMinutes || 45)));
  const intensity = context.intensity;
  const typeKey = normalizeType(context.exerciseType);

  let { preExerciseCarbs, duringCarbs, postExerciseCarbs, bolusReduction } = baseCarbsAndBolus(intensity, duration);

  // Fasted + harder effort: small bump to "if low" carb suggestion floor (not a meal replacement).
  if (context.nutritionContext === "fasted" && intensity !== "light") {
    preExerciseCarbs = Math.max(preExerciseCarbs, 10);
  }

  // Large recent meal + carbs reported: slight bump to "have carbs ready" during long sessions.
  const carbs = context.approximateCarbsGrams;
  if (carbs != null && carbs >= 60 && duration > 40 && (context.nutritionContext === "ate_recently" || context.nutritionContext === "snack_only")) {
    duringCarbs = Math.max(duringCarbs, 15);
  }

  // Recent insulin + moderate/heavy activity: ensure user has glucose on hand.
  if (hasRecentInsulin(context.lastInsulinTiming) && (intensity === "moderate" || intensity === "intense")) {
    duringCarbs = Math.max(duringCarbs, 15);
  }

  const typeAdjusted = applyExerciseTypeCarbAdjustments(typeKey, intensity, preExerciseCarbs, duringCarbs, postExerciseCarbs);
  preExerciseCarbs = typeAdjusted.pre;
  duringCarbs = typeAdjusted.during;
  postExerciseCarbs = typeAdjusted.post;
  bolusReduction = applyExerciseTypeBolusAdjustments(typeKey, intensity, bolusReduction);

  // Deeper context (environment / sleep / alcohol / history) applied on top of type adjustments.
  const deeperMult = deeperContextCarbMultipliers(context);
  if (deeperMult.pre !== 1 || deeperMult.during !== 1 || deeperMult.post !== 1) {
    preExerciseCarbs = preExerciseCarbs * deeperMult.pre;
    duringCarbs = duringCarbs * deeperMult.during;
    postExerciseCarbs = postExerciseCarbs * deeperMult.post;
  }

  // Round once, now that every intensity/type/deeper-context multiplier has been applied to the
  // full-precision value — see roundGramsForNudge for why this must happen exactly once, biased
  // by the combined multiplier rather than re-biased at each stage.
  preExerciseCarbs = roundGramsForNudge(preExerciseCarbs, typeAdjusted.preM * deeperMult.pre);
  duringCarbs = roundGramsForNudge(duringCarbs, typeAdjusted.duringM * deeperMult.during);
  postExerciseCarbs = roundGramsForNudge(postExerciseCarbs, typeAdjusted.postM * deeperMult.post);

  // History-aware bolus reduction nudge: hypo-prone routines bias toward the higher end.
  if (context.historyBias?.hypoProne || context.historyBias?.typicalResponse === "dropped") {
    bolusReduction = biasBolusReductionHigher(bolusReduction);
  }

  const idealStart = bgUnits === "mmol/L" ? "7-10" : "126-180";
  const lowThreshold = bgUnits === "mmol/L" ? "5.6" : "100";

  let preTimingShort =
    context.minutesUntilStart >= 90 ? "Planning ahead" : context.minutesUntilStart >= 45 ? "30–60 min before" : "Starting soon";

  let snackPre = ["Banana", "Toast with peanut butter", "Oat bar"];
  if (context.nutritionContext === "fasted") {
    snackPre = ["Small fruit", "Crackers", "Half a sports drink"];
  }
  if (context.nutritionContext === "snack_only") {
    snackPre = ["Rice cakes", "Fruit", "Yoghurt"];
  }

  const preTips: string[] = [];
  if (context.minutesUntilStart >= 90) {
    preTips.push("You have lead time — use it to steady BG and discuss adjustments with your team if unsure.");
  } else if (context.minutesUntilStart < 45) {
    preTips.push("Starting soon — prioritise in-range BG and quick fuel if needed.");
  }
  if (context.currentBg != null && !Number.isNaN(context.currentBg)) {
    if (isBgLow(context.currentBg, bgUnits)) {
      preTips.push(
        "Treat low BG before starting — delay exercise until you are safely back in range (confirm targets with your care team).",
      );
    } else if (isBgHigh(context.currentBg, bgUnits)) {
      preTips.push("If BG is high, follow your team's advice on ketones and fluids before intense effort.");
    } else if (context.bgTrend && context.bgTrend !== "not_sure") {
      if (context.bgTrend === "falling") {
        preTips.push(
          "You noted BG is falling — ease into intensity, keep fast carbs nearby, and recheck if anything feels off.",
        );
      } else if (context.bgTrend === "rising") {
        preTips.push(
          "You noted BG is rising — some sessions climb then fall sharply; keep fuel handy and plan follow-up checks.",
        );
      } else if (context.bgTrend === "flat") {
        preTips.push(
          "You noted BG is stable — still worth a quick recheck if effort ramps up or the session runs long.",
        );
      }
    }
  }

  if (hasRecentInsulin(context.lastInsulinTiming) && (intensity === "moderate" || intensity === "intense")) {
    preTips.push(
      "Recent rapid-acting insulin (meal or correction) may still be active — activity can drop BG faster. Avoid stacking aggressive bolus changes unless your team has taught you how.",
    );
  } else if (hasModerateInsulin(context.lastInsulinTiming) && intensity === "intense") {
    preTips.push("Some insulin may still be on board — keep extra fast carbs within reach.");
  }

  if (context.nutritionContext === "fasted" && intensity !== "light") {
    preTips.push("Training fasted: a small carb buffer before harder work can help some people — ask your team what fits your plan.");
  }

  if (context.nutritionContext === "ate_recently" && context.minutesSinceLastMeal != null) {
    preTips.push(
      `About ${context.minutesSinceLastMeal} min since eating — digestion and insulin tail still matter for how BG moves when you move.`,
    );
  }

  const plannedFuel =
    context.plannedPreExerciseFuel === "snack_bolus" || context.plannedPreExerciseFuel === "meal_bolus";
  const plannedMinutes = context.minutesUntilPreExerciseFuel;
  const hasPlannedFuelDetails = plannedFuel && plannedMinutes != null && !Number.isNaN(plannedMinutes) && plannedMinutes >= 0;

  if (hasPlannedFuelDetails) {
    const label = context.plannedPreExerciseFuel === "snack_bolus" ? "snack" : "meal";
    preTips.push(
      `Pre-exercise ${label} with bolus in ~${plannedMinutes} min — align bolus, food, and session start with your care team so insulin and activity don't clash.`,
    );
    if (plannedMinutes > context.minutesUntilStart) {
      preTips.push(
        "Your planned fuel is after your session was due to start — adjust the clock above or your fuel timing, then plan again.",
      );
    } else if (plannedMinutes <= Math.min(45, context.minutesUntilStart)) {
      preTips.push(
        "Bolusing close to the start can mean more insulin on board early in the session — keep fast carbs within reach and follow your team's activity bolus rules.",
      );
    }
    preTips.push(
      "After you take that bolus, treat it like other recent insulin: avoid extra correction stacking unless your team has a clear plan.",
    );
  }

  // Legacy/API-only: "about to eat" + minutes without planned pre-exercise fuel — avoid duplicating the planned-fuel tip.
  if (
    !hasPlannedFuelDetails &&
    context.nutritionContext === "about_to_eat" &&
    context.minutesUntilNextMeal != null
  ) {
    preTips.push(
      `Meal in ~${context.minutesUntilNextMeal} min — coordinate bolus and exercise timing with your team so fuel and insulin line up safely.`,
    );
  }

  if (carbs != null && carbs > 0) {
    preTips.push(`You noted ~${carbs}g carbs — pair any bolus changes with your usual ratios and what your team recommends for activity.`);
  }

  if (context.minutesUntilStart >= 75 && intensity !== "light") {
    preTips.push("Extra lead time: good window to set temp basal or snack plan if your team uses those strategies.");
  }

  if (typeKey !== "exercise") {
    preTips.push(
      "Carb targets factor in your activity type as well as intensity and duration—confirm details with your care team.",
    );
  }

  const envsForTips = normalizeExercisePlanEnvironments(context);
  if (envsForTips.includes("outdoor_hot")) {
    preTips.push("Hot environment — sweating increases hypo risk for some people. Sip fluids and keep extra fast carbs handy.");
  }
  if (envsForTips.includes("outdoor_cold")) {
    preTips.push("Cold weather can blunt hypo symptoms — set extra check reminders, especially if you train alone.");
  }
  if (envsForTips.includes("altitude")) {
    preTips.push("Altitude shifts insulin needs for some people — start gentler and build, and confirm any adjustments with your team.");
  }

  if (context.competitive) {
    preTips.push("Competitive sessions often run harder than planned — assume more carbs than a solo workout of the same length.");
  }

  if (context.sleepHoursLastNight != null && context.sleepHoursLastNight < 6) {
    preTips.push(`Only ${context.sleepHoursLastNight}h sleep last night — ease into intensity and watch for unusual lows.`);
  }

  if (context.hydration === "low") {
    preTips.push("Hydration noted as low — dehydration can make BG readings less reliable; sip fluids before and during.");
  }

  if (context.feelingOff) {
    preTips.push("You noted feeling off — consider a lighter session or a postponement; activity stress can amplify highs and lows.");
  }

  if (context.caffeineLast2h) {
    preTips.push("Caffeine on board — small BG bumps are common at the start; keep watching for the usual exercise drop later.");
  }

  if (context.alcoholLastNight) {
    preTips.push("Alcohol last night — delayed lows risk is higher today, especially after harder effort. Plan extra checks.");
  }

  if (context.glp1Last24h) {
    preTips.push(
      "GLP-1 medicine in the last 24h — digestion is slower, so fast carbs may act later than usual; lean on more frequent checks rather than repeat dosing right away.",
    );
  }

  if (context.betaBlockerToday) {
    preTips.push(
      "Beta-blocker today — adrenaline symptoms (shakiness, racing heart) can be masked. Trust your meter or CGM over how you feel and check a little more often.",
    );
  }

  if (context.iobUnits != null && context.iobUnits > 0) {
    preTips.push(`~${context.iobUnits}u insulin on board — activity can amplify its effect; keep treatment carbs within reach.`);
  }

  const hist = context.historyBias;
  if (hist && hist.totalSessions >= 2) {
    if (hist.hypoProne) {
      preTips.push("Your past sessions like this often led to hypos — start with a slightly higher BG and have treatment ready.");
    } else if (hist.typicalResponse === "dropped") {
      preTips.push("Your history shows BG often drops with this routine — extra carbs ready and an earlier check usually pays off.");
    } else if (hist.typicalResponse === "rose") {
      preTips.push("Your history shows BG often rises during this routine — plan for a possible delayed dip rather than only watching for highs.");
    }
  }

  const duringTips: string[] = [];
  if (duringCarbs > 0) {
    duringTips.push(`Have ${duringCarbs}g fast-acting carbs ready`);
    duringTips.push("Take ~15g if BG starts dropping");
    if (duration > 45) duringTips.push("Check BG around the halfway mark");
  } else {
    duringTips.push("You may not need extra carbs for this session");
    duringTips.push("Keep 15–20g fast glucose nearby just in case");
  }

  if (hasRecentInsulin(context.lastInsulinTiming)) {
    duringTips.push("Insulin on board can make drops feel faster — check earlier than usual if something feels off.");
  }

  if (hasPlannedFuelDetails) {
    duringTips.push(
      "If you bolus for a pre-exercise snack or meal, watch for drops during the first part of the session once that insulin is active.",
    );
  }

  if (context.betaBlockerToday) {
    duringTips.push("Beta-blocker on board — schedule a glucose check rather than waiting to feel low.");
  }

  let postTiming = "Within 30-60 min after";
  let postSnack = ["Chocolate milk", "Greek yoghurt", "Sandwich"];
  if (
    context.nutritionContext === "about_to_eat" ||
    (hasPlannedFuelDetails && context.plannedPreExerciseFuel === "meal_bolus")
  ) {
    postTiming = "Line up recovery fuel with your next meal — your team can help you balance bolus for both exercise and food.";
    postSnack = ["Meal with carbs and protein", "Sandwich", "Balanced plate"];
  }

  const recoveryTips = [
    "Monitor BG closely for delayed lows",
    "Consider a small bedtime snack to prevent overnight lows",
    "Have a protein-carb snack before bed if you exercised in the evening",
    "Stay hydrated — dehydration affects BG readings",
  ];

  const hour = context.hourOfDay;
  if (hour != null && hour >= 17 && intensity === "intense") {
    recoveryTips.unshift("Evening hard sessions often raise overnight hypo risk — plan extra checks or snacks if your team agrees.");
  }

  if (hasRecentInsulin(context.lastInsulinTiming) || intensity === "intense") {
    recoveryTips.push("IOB and muscle uptake can interact for many hours — err on the side of more checks after hard or insulin-heavy days.");
  }

  if (context.alcoholLastNight) {
    recoveryTips.push("Alcohol last night already increases delayed-low risk — pair with exercise recovery, plan a snack and an alarm if you feel unsure.");
  }

  if (context.glp1Last24h) {
    recoveryTips.push("GLP-1 medicine can delay how food and fast carbs act — favour scheduled checks over waiting for symptoms during recovery too.");
  }

  if (context.betaBlockerToday) {
    recoveryTips.push("Beta-blocker still on board — keep checking by meter or CGM through recovery rather than relying on how you feel.");
  }

  const envsRecovery = normalizeExercisePlanEnvironments(context);
  if (envsRecovery.includes("outdoor_hot")) {
    recoveryTips.push("After heat: rehydrate steadily — recheck BG after fluids, since dehydrated readings can mislead recovery decisions.");
  }

  if (context.historyBias?.hypoProne) {
    recoveryTips.unshift("Your routine has caused hypos before — keep treatment within reach for the next several hours, not just immediately after.");
  }

  let pumpTips = pumpTipsForIntensity(intensity);
  const closedLoop = usesClosedLoop(settings);
  if (!closedLoop && context.minutesUntilStart >= 90 && intensity !== "light") {
    pumpTips.pre = [
      `With ~${context.minutesUntilStart} min until start, you have time to start or adjust a temporary basal as discussed with your team.`,
      ...pumpTips.pre,
    ];
  }
  pumpTips = resolveExercisePumpTips(pumpTips, intensity, settings);
  if (closedLoop) {
    const leadIn = closedLoopPrePumpLeadIn(context.minutesUntilStart, intensity);
    if (leadIn) {
      pumpTips = { ...pumpTips, pre: [leadIn, ...pumpTips.pre] };
    }
  }

  const summaryParts = [`${duration} min`, intensity, displayType(typeKey)];
  if (context.nutritionContext) {
    const n = { fasted: "fasted", ate_recently: "after recent food", about_to_eat: "before a meal", snack_only: "light snack context" }[context.nutritionContext];
    summaryParts.push(`(${n})`);
  } else if (hasPlannedFuelDetails && context.plannedPreExerciseFuel === "meal_bolus") {
    summaryParts.push("(before a meal)");
  }

  return {
    duration,
    intensity,
    exerciseType: displayType(typeKey),
    summary: summaryParts.join(" "),
    pre: {
      targetBg: idealStart,
      lowThreshold,
      carbsIfLow: preExerciseCarbs,
      bolusReduction,
      snackIdeas: snackPre,
      timing: preTimingShort,
      contextualNotes: preTips.length > 0 ? preTips : undefined,
    },
    during: {
      carbsNeeded: duringCarbs,
      needsCarbs: duringCarbs > 0,
      carbFrequency: "every 30-45 min",
      checkBg: duration > 45 || hasRecentInsulin(context.lastInsulinTiming),
      tips: duringTips,
    },
    post: {
      carbs: postExerciseCarbs,
      protein: "15-20g",
      bolusReduction,
      snackIdeas: postSnack,
      timing: postTiming,
    },
    recovery: {
      monitorHours: "6-24",
      tips: recoveryTips,
    },
    pumpTips,
  };
}

/**
 * One-line insulin-oriented recovery summary for compact banner copy (educational; not dosing advice).
 */
export function getRecoveryInsulinHeadline(plan: ExercisePlanResult, isPump: boolean, isEvening: boolean): string {
  if (isPump) {
    const postLine = plan.pumpTips.post[0] ?? "";
    if (isEvening && plan.pumpTips.recovery[0]) {
      return `${postLine} ${plan.pumpTips.recovery[0]}`;
    }
    return postLine || plan.pumpTips.recovery[0] || "";
  }
  return `Many care teams discuss cutting the next meal bolus by about ${plan.post.bolusReduction} after this type of session — confirm with your team.`;
}

/** Planner-backed bullets for recovery education dialogs; dedupes exact duplicates. */
export function getRecoveryEducationBulletsFromPlan(plan: ExercisePlanResult, isPump: boolean): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const add = (s: string) => {
    const t = s.trim();
    if (!t || seen.has(t)) return;
    seen.add(t);
    out.push(t);
  };

  add(plan.post.timing);
  add(
    `Meal bolus: many plans use roughly ${plan.post.bolusReduction} less insulin for food in the meal after exercise — only with your team's rules.`,
  );
  if (plan.post.carbs > 0) {
    add(`Recovery snack ballpark: ~${plan.post.carbs}g carbs with ~${plan.post.protein} protein — adjust to your targets.`);
  }
  add(`Keep monitoring for the next ${plan.recovery.monitorHours} hours — delayed lows are common.`);

  for (const t of plan.recovery.tips) add(t);

  if (isPump) {
    for (const t of plan.pumpTips.post) add(t);
    for (const t of plan.pumpTips.recovery) add(t);
  }

  return out;
}

/** Parse legacy free-text (tests / migration). Prefer calculateExercisePlan(ExercisePlanContext). */
export function calculateExercisePlanFromMessage(message: string, bgUnits: string = "mmol/L"): ExercisePlanResult {
  const durationMatch = message.match(/(\d+)\s*(?:min|minute)/i);
  const duration = durationMatch ? parseInt(durationMatch[1]!, 10) : 45;
  const lower = message.toLowerCase();
  const intensity: "light" | "moderate" | "intense" = lower.includes("intense") || lower.includes("hard")
    ? "intense"
    : lower.includes("light") || lower.includes("easy")
      ? "light"
      : "moderate";

  let exerciseType = "exercise";
  if (lower.includes("cardio") || lower.includes("run") || lower.includes("cycl")) exerciseType = "cardio";
  else if (lower.includes("strength") || lower.includes("weight")) exerciseType = "strength";
  else if (lower.includes("hiit")) exerciseType = "hiit";
  else if (lower.includes("yoga") || lower.includes("stretch")) exerciseType = "yoga";
  else if (lower.includes("walk")) exerciseType = "walking";
  else if (lower.includes("swim")) exerciseType = "swimming";
  else if (
    lower.includes("tennis") ||
    lower.includes("badminton") ||
    lower.includes("squash") ||
    lower.includes("pickleball") ||
    lower.includes("racket")
  ) {
    exerciseType = "court";
  } else if (lower.includes("sport")) exerciseType = "field";

  return calculateExercisePlan(
    {
      exerciseType,
      durationMinutes: duration,
      intensity,
      minutesUntilStart: 60,
      bgUnits,
    },
    undefined,
  );
}

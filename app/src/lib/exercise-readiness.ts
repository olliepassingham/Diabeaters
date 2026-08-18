/**
 * Shared readiness verdict for exercise planner and active exercise banner.
 * Rule-based; not medical advice.
 */

import { formatCarbsForScenario, formatFastCarbsForScenario } from "@/lib/carb-source-preferences";
import type { ExercisePlanResult } from "@/lib/exercise-plan";
import { exerciseApproachLowCeiling } from "@/lib/exercise-hypo-auto";
import {
  exerciseApproachLowCeilingForPhase,
  exerciseHighThreshold,
  exerciseIdealStartMinimum as centralExerciseIdealStartMinimum,
  exerciseIdealStartMinimumLabel as centralExerciseIdealStartMinimumLabel,
} from "@/lib/exercise-thresholds";
import type {
  ExerciseBgTrend,
  ExerciseEnvironmentChoice,
  ExerciseIntensity,
  ExerciseSymptomSeverity,
  PreRapidInsulin2h,
  UserProfile,
} from "@/lib/storage";

export type ExerciseReadinessVerdict = "ready" | "caution" | "not_recommended";

export interface ExerciseReadinessResult {
  verdict: ExerciseReadinessVerdict;
  title: string;
  detail: string;
  /**
   * True when there isn't enough BG data yet to give a real verdict (verdict is a "caution"
   * placeholder purely because the field is empty). UI layers should use this to render a
   * neutral "waiting for input" prompt instead of amber caution chrome — showing a warning
   * before the user has typed anything reads as a false alarm, not guidance.
   */
  awaitingInput?: boolean;
}

function parseNumericMaybe(value: string | null | undefined): number | null {
  if (value == null) return null;
  const n = parseFloat(String(value).trim().replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** Upper band where “in range” BG + falling still warrants extra caution (matches recovery logic). */
function exerciseApproachLowCeilingForUnits(bgUnits: string, lowThreshold: number): number {
  const units = bgUnits === "mg/dL" ? "mg/dL" : "mmol/L";
  return exerciseApproachLowCeiling(lowThreshold, units);
}

/** Matches {@link ExercisePlanResult.pre.targetBg} lower bound — tip-of-the-day “snack first” band. */
export function exerciseIdealStartMinimum(bgUnits: string): number {
  return centralExerciseIdealStartMinimum(bgUnits);
}

export function exerciseIdealStartMinimumLabel(bgUnits: string): string {
  return centralExerciseIdealStartMinimumLabel(bgUnits);
}

export function isCardioLikeExerciseType(exerciseType: string): boolean {
  const t = exerciseType.toLowerCase();
  return (
    t === "cardio" ||
    t === "hiit" ||
    t === "walking" ||
    t === "swimming" ||
    t === "court" ||
    t === "field"
  );
}

/** Pre-workout: moderate/intense cardio below ideal start → eat carbs before starting, not just pack them. */
export function shouldTakePreExerciseCarbsNow(input: {
  currentBg?: number | null;
  bgUnits: string;
  exerciseType: string;
  intensity: ExerciseIntensity;
  phase?: "pre" | "active" | "recovery";
}): boolean {
  if (input.phase && input.phase !== "pre") return false;
  const bg = input.currentBg;
  if (bg == null || !Number.isFinite(bg)) return false;
  if (!isCardioLikeExerciseType(input.exerciseType)) return false;
  if (input.intensity !== "moderate" && input.intensity !== "intense") return false;
  return bg < exerciseIdealStartMinimum(input.bgUnits);
}

export interface ExerciseReadinessInput {
  exercisePlanResult: ExercisePlanResult | null;
  /** Planner-style raw BG field */
  currentBgInput?: string;
  /** Banner: numeric BG when known */
  currentBg?: number | null;
  bgUnits: string;
  sickDayActive?: boolean;
  /** When severe, exercise is not recommended. */
  sickDaySeverity?: string;
  exerciseType: string;
  intensity: ExerciseIntensity;
  bgTrend?: ExerciseBgTrend | null;
  /** For type+trend nuance (e.g. rising before lifting applies in pre) */
  phase?: "pre" | "active" | "recovery";
  /** Pre-session strip: any rapid-acting dose in the last ~2 h (affects plan + quick verdict). */
  preRapidInsulin2h?: PreRapidInsulin2h | null;

  // ----- Deeper guided coach context (all optional) -----
  sleepHoursLastNight?: number | null;
  feelingOff?: boolean;
  alcoholLastNight?: boolean;
  hypoProneHistory?: boolean;
  /** Pre: venue/altitude choices — heat and altitude both raise exercise risk. */
  environments?: ExerciseEnvironmentChoice[] | null;
  /** Pre: training without having eaten first. */
  fasted?: boolean;
  /** Pre: self-reported hydration. */
  hydration?: "ok" | "low" | null;
  /** Pre: caffeine in the last ~2h can amplify adrenaline-driven swings. */
  caffeineLast2h?: boolean;
  /** Pre: GLP-1 medicines slow digestion and can blunt hunger/hypo cues. */
  glp1Last24h?: boolean;
  /** Pre: beta-blockers can mask classic hypo warning signs (fast heartbeat, tremor). */
  betaBlockerToday?: boolean;
  /** Pre: competitive/group sessions are paced less predictably than planned. */
  competitive?: boolean;
  /** Active only: subjective symptom severity logged mid-session — can escalate the verdict. */
  symptomSeverity?: ExerciseSymptomSeverity | null;
}

function baseVerdict(input: ExerciseReadinessInput): ExerciseReadinessResult {
  const { exercisePlanResult, bgUnits, sickDayActive, sickDaySeverity } = input;

  if (!exercisePlanResult) {
    return { verdict: "caution", title: "Caution", detail: "Plan a workout to see guidance.", awaitingInput: true };
  }

  if (sickDayActive && sickDaySeverity === "severe") {
    return {
      verdict: "not_recommended",
      title: "Not recommended",
      detail: "Severe illness increases risk. Focus on rest and monitoring.",
    };
  }

  const lowThreshold = parseNumericMaybe(exercisePlanResult.pre.lowThreshold);
  const bg =
    input.currentBg != null && Number.isFinite(input.currentBg)
      ? input.currentBg
      : parseNumericMaybe(input.currentBgInput);

  if (bg == null || lowThreshold == null) {
    return {
      verdict: "caution",
      title: "Add your BG",
      detail: "Enter your current reading to get a tailored verdict for this session.",
      awaitingInput: true,
    };
  }

  const highThreshold = exerciseHighThreshold(bgUnits);
  if (bg < lowThreshold) {
    const phase = input.phase ?? "pre";
    if (phase === "active") {
      return {
        verdict: "not_recommended",
        title: "Pause — BG is low",
        detail:
          "Ease off and treat using the amount below, then re-check in 10–15 minutes before you push on.",
      };
    }
    if (phase === "recovery") {
      return {
        verdict: "not_recommended",
        title: "BG is low after exercise",
        detail:
          "Treat using the amount below, then re-check in 10–15 minutes. Delayed lows are common after activity.",
      };
    }
    return {
      verdict: "not_recommended",
      title: "Don't start yet — BG is low",
      detail: "Treat using the amount below, then re-check in 10–15 minutes before you begin.",
    };
  }

  if (bg > highThreshold) {
    return {
      verdict: "caution",
      title: "Caution (high BG)",
      detail: "Consider ketone checks and a correction plan per your care team before intense activity.",
    };
  }

  return { verdict: "ready", title: "Ready", detail: "You look in range to start—still monitor closely." };
}

function refineWithExerciseTypeAndTrend(
  base: ExerciseReadinessResult,
  input: ExerciseReadinessInput,
): ExerciseReadinessResult {
  const bg =
    input.currentBg != null && Number.isFinite(input.currentBg)
      ? input.currentBg
      : parseNumericMaybe(input.currentBgInput);
  if (bg == null) return base;

  const t = input.exerciseType.toLowerCase();
  const trend = input.bgTrend ?? "not_sure";
  const phase = input.phase ?? "pre";
  const { intensity } = input;

  const cardioLike =
    isCardioLikeExerciseType(input.exerciseType);
  const strengthLike = t === "strength";

  if (base.verdict === "caution" && base.title.startsWith("Caution (high BG)")) {
    if (t === "yoga" || t === "walking") {
      return {
        ...base,
        detail:
          "BG is on the high side — gentle movement often suits this activity type; confirm targets with your care team.",
      };
    }
    if (strengthLike || t === "hiit") {
      return {
        ...base,
        detail:
          "BG is elevated — intense effort can be harder on the body when high; consider a correction plan and ketone checks per your team.",
      };
    }
  }

  if (base.verdict === "ready") {
    if (trend === "falling" && cardioLike && (intensity === "moderate" || intensity === "intense")) {
      return {
        verdict: "caution",
        title: "Caution",
        detail:
          "Trend is down — this type of session can accelerate drops. Keep fast carbs within reach and consider delaying hard effort until stable.",
      };
    }

    if (trend === "rising" && strengthLike && phase === "pre") {
      return {
        verdict: "ready",
        title: "Ready",
        detail:
          "In range to start — a rise before lifting is common (adrenaline); still watch for a dip later.",
      };
    }

    if (trend === "rising" && t === "hiit" && phase === "pre") {
      return {
        verdict: "ready",
        title: "Ready",
        detail:
          "In range to start — HIIT can spike then drop sharply; plan recovery fuel even if BG looks high now.",
      };
    }

    if (trend === "flat" && phase === "pre") {
      return {
        verdict: "ready",
        title: "Ready",
        detail: "In range with a stable trend — still monitor as intensity changes.",
      };
    }

    if (trend === "not_sure" && phase === "pre") {
      return {
        verdict: "ready",
        title: "Ready",
        detail:
          "In range to start — if direction is unclear, a quick check before pushing harder beats guessing.",
      };
    }

    if (trend === "falling" && strengthLike && phase === "pre") {
      return {
        verdict: "caution",
        title: "Caution",
        detail:
          "Trend is down — strength work often dips after; keep hypo treatment nearby for the post-workout window.",
      };
    }

    if (phase === "active") {
      const lowThreshold = parseNumericMaybe(input.exercisePlanResult?.pre.lowThreshold ?? null);
      const approachCeiling =
        lowThreshold != null ? exerciseApproachLowCeilingForUnits(input.bgUnits, lowThreshold) : null;

      if (trend === "falling") {
        if (approachCeiling != null && bg < approachCeiling) {
          return {
            verdict: "caution",
            title: "Caution",
            detail: strengthLike
              ? "BG is toward the lower band and still falling — keep fast carbs handy; strength work often dips after."
              : "BG is toward the lower band and falling — ease intensity and treat lows your usual way.",
          };
        }
        if (strengthLike) {
          return {
            verdict: "caution",
            title: "Caution",
            detail:
              "Trend is down during strength — delayed dips are common. Keep hypo treatment within reach.",
          };
        }
        return {
          verdict: "caution",
          title: "Caution",
          detail:
            "Trend is down — keep fast carbs within reach and re-check if anything feels off.",
        };
      }

      if (trend === "rising") {
        return {
          verdict: "ready",
          title: "Ready",
          detail: strengthLike
            ? "BG is rising during effort — common with strength; still plan for a possible dip later."
            : "BG is rising for now — re-check if you push harder; keep fast carbs within reach anyway.",
        };
      }

      if (trend === "flat") {
        return {
          verdict: "ready",
          title: "Ready",
          detail: "Stable for now — keep monitoring as effort changes.",
        };
      }
    }
  }

  return base;
}

const IOB_QUICK_DETAIL =
  "Recent rapid insulin can drop BG faster. Keep fast carbs handy; avoid extra insulin unless your plan says so.";

/**
 * Post-workout strip: same red / amber / green idea as other phases, tuned for delayed lows and BG+trend.
 * Rule-based; not medical advice.
 */
export function getRecoveryReadinessVerdict(input: ExerciseReadinessInput): ExerciseReadinessResult {
  const { exercisePlanResult, bgUnits, sickDayActive, sickDaySeverity } = input;

  if (!exercisePlanResult) {
    return {
      verdict: "caution",
      title: "Caution",
      detail: "Plan data missing — add BG for clearer recovery guidance.",
      awaitingInput: true,
    };
  }

  if (sickDayActive && sickDaySeverity === "severe") {
    return {
      verdict: "not_recommended",
      title: "Not recommended",
      detail: "Severe illness increases risk. Focus on rest and monitoring with your care team.",
    };
  }

  const lowThreshold = parseNumericMaybe(exercisePlanResult.pre.lowThreshold);
  const bg =
    input.currentBg != null && Number.isFinite(input.currentBg)
      ? input.currentBg
      : parseNumericMaybe(input.currentBgInput);

  if (bg == null || lowThreshold == null) {
    return {
      verdict: "caution",
      title: "Add your BG",
      detail: "Recovery guidance depends on your level and trend — add a reading to tailor this.",
      awaitingInput: true,
    };
  }

  const highThreshold = exerciseHighThreshold(bgUnits);
  const trend = input.bgTrend ?? "not_sure";
  /**
   * Below range but not yet under formal low threshold — still falling → treat like a
   * high-risk window. Wider than pre/active: delayed-onset lows are common for hours
   * after activity even without a confirmed falling trend on a single reading.
   */
  const approachLowCeiling = exerciseApproachLowCeilingForPhase(lowThreshold, bgUnits, "recovery");

  if (bg < lowThreshold) {
    return {
      verdict: "not_recommended",
      title: "BG is low after exercise",
      detail:
        "Treat using the amount below, then re-check in 10–15 minutes. Delayed lows are common after activity.",
    };
  }

  // A clearly rising trend is a genuine reassuring signal here — don't override it. Flat,
  // falling, or unclear (not_sure) direction all warrant the wider recovery-only caution band,
  // since delayed-onset lows after activity often aren't caught by a single "falling" reading —
  // this must stay in sync with needsImmediateExerciseBgTreatment's recovery-phase check, which
  // also flags flat readings in this band, so the hero verdict and the hypo "treat now" banner
  // never contradict each other on screen.
  if (trend !== "rising" && bg < approachLowCeiling) {
    const falling = trend === "falling";
    const strengthLike = input.exerciseType.toLowerCase() === "strength";
    return {
      verdict: "not_recommended",
      title: falling ? "BG is low and falling" : "BG is still on the low side",
      detail: falling
        ? strengthLike
          ? "After strength work, glucose often keeps dropping as muscles refill. Use the treat-now amount below, then re-check in 10–15 minutes."
          : "Glucose can keep falling after you stop. Use the treat-now amount below, then re-check in 10–15 minutes."
        : "Delayed lows are common in this window. Stay with recovery, keep fast carbs close, and re-check soon.",
    };
  }

  if (bg > highThreshold) {
    return {
      verdict: "caution",
      title: "Caution (high BG)",
      detail:
        "BG is elevated after exercise — follow your team’s correction and ketone plan; delayed lows can still appear later.",
    };
  }

  if (trend === "falling") {
    return {
      verdict: "caution",
      title: "Caution",
      detail:
        "Trend is down after exercise — delayed lows are still common. Keep fast carbs within reach and re-check if anything feels off.",
    };
  }

  if (trend === "rising") {
    return {
      verdict: "ready",
      title: "Ready",
      detail:
        "BG is rising after effort — that can be normal; still watch for delayed lows over the next few hours.",
    };
  }

  if (trend === "flat") {
    return {
      verdict: "ready",
      title: "Ready",
      detail:
        "Comfortable range with a flat trend after exercise — still watch for delayed lows over the next hours per your team.",
    };
  }

  return {
    verdict: "ready",
    title: "Ready",
    detail:
      "In range after exercise — if direction is unclear, a quick check beats guessing while muscles are still refuelling.",
  };
}

function refineWithPreExerciseStartBand(
  result: ExerciseReadinessResult,
  input: ExerciseReadinessInput,
): ExerciseReadinessResult {
  if (input.phase !== "pre") return result;
  if (result.verdict === "not_recommended") return result;
  if (result.title.startsWith("Caution (high BG)")) return result;

  const bg =
    input.currentBg != null && Number.isFinite(input.currentBg)
      ? input.currentBg
      : parseNumericMaybe(input.currentBgInput);
  if (bg == null) return result;

  if (!isCardioLikeExerciseType(input.exerciseType)) return result;
  if (input.intensity !== "moderate" && input.intensity !== "intense") return result;

  const idealMin = exerciseIdealStartMinimum(input.bgUnits);
  if (bg >= idealMin) return result;

  const grams = input.exercisePlanResult?.pre.carbsIfLow ?? 0;
  const carbHint = grams > 0 ? `about ${grams}g fast carbs` : "fast carbs";
  const bandLabel = exerciseIdealStartMinimumLabel(input.bgUnits);

  return {
    verdict: "caution",
    title: "Caution",
    detail: `BG is below ${bandLabel} for ${input.intensity} ${input.exerciseType} — take ${carbHint} before you start, then re-check in 10–15 minutes.`,
  };
}

function refineWithPreRapidInsulin(result: ExerciseReadinessResult, input: ExerciseReadinessInput): ExerciseReadinessResult {
  if (input.phase !== "pre") return result;
  const r = input.preRapidInsulin2h;
  if (r == null) return result;
  if (result.verdict === "not_recommended" && (result.title.includes("low") || result.title.includes("Low"))) {
    return result;
  }
  if (r === "no") return result;
  if (r === "not_sure") {
    return {
      verdict: "caution",
      title: "Caution",
      detail:
        "If you are unsure about rapid-acting insulin in the last ~2 hours, expect glucose to move more with activity. Extra checks and fast carbs on hand are sensible until you are certain.",
    };
  }
  if (r === "yes" && result.title.startsWith("Caution (high BG)")) {
    return { ...result, detail: `${result.detail} If you have taken rapid insulin recently, follow your team’s high-BG and ketone plan before intense effort.` };
  }
  if (r === "yes" && (result.verdict === "ready" || result.verdict === "caution")) {
    const mergedDetail =
      result.verdict === "caution" && result.detail ? `${result.detail} ${IOB_QUICK_DETAIL}` : IOB_QUICK_DETAIL;
    return {
      verdict: "caution",
      title: "Caution (insulin on board)",
      detail: mergedDetail,
    };
  }
  return result;
}

type DeeperContextTrigger = { text: string; weight: 1 | 2 };

/**
 * Layered "deeper context" caution refiners — sleep, feeling off, alcohol, beta-blocker, GLP-1,
 * fasted status, heat/altitude, hydration, caffeine, competitive pacing, and history. Each factor
 * is weighted: a single strong factor (weight 2) escalates ready→caution on its own, while mild
 * factors (weight 1, e.g. caffeine alone) are only surfaced as a note unless they stack with
 * another. Never upgrades a verdict beyond caution — preserves not_recommended verdicts unchanged.
 */
function refineWithDeeperContext(result: ExerciseReadinessResult, input: ExerciseReadinessInput): ExerciseReadinessResult {
  if (result.verdict === "not_recommended") return result;
  // Nothing to weigh against yet — keep the "add your BG" prompt focused rather than
  // appending caution language the user hasn't earned a verdict for yet.
  if (result.awaitingInput) return result;

  const hardEffort = input.intensity === "moderate" || input.intensity === "intense";
  const triggers: DeeperContextTrigger[] = [];

  if (input.feelingOff) triggers.push({ text: "you noted feeling off", weight: 2 });
  if (input.sleepHoursLastNight != null && input.sleepHoursLastNight < 6) {
    triggers.push({ text: "low sleep last night", weight: 2 });
  }
  if (input.alcoholLastNight) triggers.push({ text: "alcohol last night raises delayed-low risk", weight: 2 });
  if (input.hypoProneHistory) triggers.push({ text: "your history shows hypos for this routine", weight: 2 });
  if (input.betaBlockerToday) {
    triggers.push({ text: "beta-blockers can mask common hypo warning signs", weight: 2 });
  }
  if (input.glp1Last24h) {
    triggers.push({ text: "GLP-1 medicine can slow digestion and blunt hunger/hypo cues", weight: 2 });
  }
  if (input.fasted) {
    triggers.push({
      text: "training fasted raises hypo risk without carbs on board",
      weight: hardEffort ? 2 : 1,
    });
  }
  const heatOrAltitude = (input.environments ?? []).some((e) => e === "outdoor_hot" || e === "altitude");
  if (heatOrAltitude) {
    triggers.push({
      text: "heat/altitude add extra strain on top of this effort",
      weight: hardEffort ? 2 : 1,
    });
  }
  if (input.hydration === "low") {
    triggers.push({ text: "low hydration can blur early hypo symptoms", weight: 1 });
  }
  if (input.caffeineLast2h) {
    triggers.push({ text: "recent caffeine can amplify adrenaline-driven swings", weight: 1 });
  }
  if (input.competitive) {
    triggers.push({ text: "competitive/group sessions are often paced harder than planned", weight: 1 });
  }

  if (triggers.length === 0) return result;

  const totalWeight = triggers.reduce((sum, t) => sum + t.weight, 0);
  const strongestFirst = [...triggers].sort((a, b) => b.weight - a.weight);
  const summary = `${strongestFirst[0]!.text}${
    triggers.length > 1 ? ` (+${triggers.length - 1} more factor${triggers.length - 1 === 1 ? "" : "s"})` : ""
  }`;

  if (result.verdict === "ready") {
    if (totalWeight >= 2) {
      return {
        verdict: "caution",
        title: "Caution",
        detail: `${result.detail} Also: ${summary}. Plan extra checks and keep fast carbs nearby.`,
      };
    }
    // A single mild factor alone isn't enough to leave "Ready" — still worth surfacing.
    return { ...result, detail: `${result.detail} Worth noting: ${summary}.` };
  }

  return {
    ...result,
    detail: `${result.detail} Plus: ${summary}.`,
  };
}

/**
 * Mid-exercise symptom severity can escalate the verdict, not just the hypo carb estimate —
 * a "Ready" card while shaky/sweaty/lightheaded symptoms are logged would be a confusing and
 * unsafe signal. Runs last so it has the final say for the active phase.
 */
function refineWithActiveSymptoms(result: ExerciseReadinessResult, input: ExerciseReadinessInput): ExerciseReadinessResult {
  if (input.phase !== "active") return result;
  const severity = input.symptomSeverity;
  if (!severity || severity === "mild") return result;

  // An existing not_recommended (e.g. confirmed low BG) already carries the strongest, most
  // specific message — don't overwrite its title/detail, just don't soften it either.
  if (result.verdict === "not_recommended") return result;

  if (severity === "severe") {
    return {
      verdict: "not_recommended",
      title: "Stop and check now",
      detail:
        "Severe symptoms logged during exercise — stop, treat if BG is low or borderline, and re-check before continuing.",
    };
  }

  if (result.verdict === "ready") {
    return {
      verdict: "caution",
      title: "Caution",
      detail: `${result.detail} You've also logged symptoms — ease off and re-check soon.`,
    };
  }
  return result;
}

/** Planner and active banner: shared go / caution / not recommended copy. */
export function getExerciseReadinessVerdict(input: ExerciseReadinessInput): ExerciseReadinessResult {
  if (input.phase === "recovery") {
    return refineWithDeeperContext(getRecoveryReadinessVerdict(input), input);
  }
  const base = baseVerdict(input);
  const withTrends = refineWithExerciseTypeAndTrend(base, input);
  const withStartBand = refineWithPreExerciseStartBand(withTrends, input);
  const withInsulin = refineWithPreRapidInsulin(withStartBand, input);
  const withContext = refineWithDeeperContext(withInsulin, input);
  return refineWithActiveSymptoms(withContext, input);
}

export function getReadinessToneClasses(verdict: ExerciseReadinessVerdict): string {
  if (verdict === "ready") {
    return "border-emerald-200/80 bg-emerald-50/60 dark:border-emerald-800/50 dark:bg-emerald-950/25";
  }
  if (verdict === "not_recommended") {
    return "border-red-200/80 bg-red-50/60 dark:border-red-800/50 dark:bg-red-950/25";
  }
  return "border-amber-200/80 bg-amber-50/60 dark:border-amber-800/50 dark:bg-amber-950/25";
}

export type ExerciseFuelPlanLineId = "on_hand" | "during" | "post";

export type ExerciseFuelPlanLine = {
  id: ExerciseFuelPlanLineId;
  label: string;
  text: string;
};

/** Pre/active/recovery low or falling BG: show Take now with carb favourites. */
function resolveTreatFirstFuelGrams(
  plan: ExercisePlanResult,
  phase: "pre" | "active" | "recovery",
  bg: number | null | undefined,
  bgUnits: string,
  trend?: ExerciseBgTrend | null,
): number | null {
  const lowThreshold = parseNumericMaybe(plan.pre.lowThreshold);
  if (bg == null || lowThreshold == null) return null;
  const grams = plan.pre.carbsIfLow;
  if (grams <= 0) return null;
  const units = bgUnits === "mg/dL" ? "mg/dL" : "mmol/L";
  const approachCeiling = exerciseApproachLowCeiling(lowThreshold, units);

  if (bg < lowThreshold) return grams;
  if (trend === "falling" && bg < approachCeiling) return grams;
  if (phase === "recovery" && bg < approachCeiling) return grams;
  return null;
}

/** During-workout carry + interval dose for the active strip (cardio: ~30g per 30 min). */
export function computeActiveWorkoutFuelCarry(input: {
  plan: ExercisePlanResult;
  exerciseType: string;
  intensity: ExerciseIntensity;
}): { carryGrams: number; doseGrams: number; intervalMinutes: number } | null {
  const { plan, exerciseType, intensity } = input;
  const duration = plan.duration;

  if (isCardioLikeExerciseType(exerciseType)) {
    if (intensity === "light") {
      const carry = Math.max(plan.during.carbsNeeded, 15);
      return { carryGrams: carry, doseGrams: 15, intervalMinutes: 30 };
    }
    const doseGrams = intensity === "intense" ? 30 : 20;
    const intervals = Math.max(1, Math.ceil(duration / 30));
    const carryGrams = Math.max(plan.during.carbsNeeded, doseGrams * intervals);
    return { carryGrams, doseGrams, intervalMinutes: 30 };
  }

  const carry = Math.max(plan.during.carbsNeeded, plan.pre.carbsIfLow > 0 ? 15 : 0);
  if (carry <= 0) return null;
  return { carryGrams: carry, doseGrams: Math.min(15, carry), intervalMinutes: 30 };
}

/**
 * Structured fuel plan from {@link calculateExercisePlan} — intensity, duration, and type aware.
 * Uses carb source favourites when configured (`exercise_on_hand` / `exercise_during`).
 */
export function getExerciseFuelPlanLines(
  plan: ExercisePlanResult,
  verdict: ExerciseReadinessVerdict,
  profile: Partial<UserProfile> | null | undefined,
  options?: {
    phase?: "pre" | "active" | "recovery";
    exerciseType?: string;
    currentBg?: number | null;
    bgUnits?: string;
    intensity?: ExerciseIntensity;
    trend?: ExerciseBgTrend | null;
  },
): ExerciseFuelPlanLine[] {
  const phase = options?.phase ?? "pre";
  const bgUnits = options?.bgUnits ?? "mmol/L";

  const treatFirstGrams = resolveTreatFirstFuelGrams(
    plan,
    phase,
    options?.currentBg,
    bgUnits,
    options?.trend,
  );
  if (verdict === "not_recommended") {
    if (treatFirstGrams != null) {
      return [
        {
          id: "on_hand",
          label: "Take now",
          text: formatFastCarbsForScenario(treatFirstGrams, profile, "exercise_on_hand"),
        },
      ];
    }
    return [];
  }

  const lines: ExerciseFuelPlanLine[] = [];
  const pre = plan.pre.carbsIfLow;
  const during = plan.during.carbsNeeded;
  const post = plan.post.carbs;
  const takeNow =
    phase === "pre" &&
    shouldTakePreExerciseCarbsNow({
      currentBg: options?.currentBg,
      bgUnits: options?.bgUnits ?? "mmol/L",
      exerciseType: options?.exerciseType ?? "",
      intensity: options?.intensity ?? "moderate",
      phase,
    });

  if (phase === "recovery") {
    if (post > 0) {
      lines.push({
        id: "post",
        label: "Have ready",
        text: formatFastCarbsForScenario(post, profile, "exercise_on_hand"),
      });
    }
    return lines;
  }

  if (phase === "pre") {
    if (pre > 0) {
      lines.push({
        id: "on_hand",
        label: takeNow ? "Take now" : "Have ready",
        text: formatFastCarbsForScenario(pre, profile, "exercise_on_hand"),
      });
    }
    if (during > 0) {
      const duringDetail = formatCarbsForScenario(during, profile, "exercise_during");
      lines.push({
        id: "during",
        label: `Have ~${Math.round(during)}g if BG drops`,
        text: duringDetail ?? "",
      });
    }
    return lines;
  }

  if (phase === "active") {
    if (treatFirstGrams != null) {
      return [
        {
          id: "on_hand",
          label: "Take now",
          text: formatFastCarbsForScenario(treatFirstGrams, profile, "exercise_on_hand"),
        },
      ];
    }
    const carry = computeActiveWorkoutFuelCarry({
      plan,
      exerciseType: options?.exerciseType ?? "",
      intensity: options?.intensity ?? "moderate",
    });
    if (carry) {
      const carryDetail = formatCarbsForScenario(carry.carryGrams, profile, "exercise_during");
      lines.push({
        id: "during",
        label: "Carry with you",
        text: carryDetail
          ? `~${Math.round(carry.carryGrams)}g fast carbs · ${carryDetail}`
          : `~${Math.round(carry.carryGrams)}g fast carbs`,
      });
      const showInterval =
        isCardioLikeExerciseType(options?.exerciseType ?? "") &&
        (options?.intensity === "moderate" || options?.intensity === "intense") &&
        plan.duration > 30;
      if (showInterval) {
        const doseDetail = formatCarbsForScenario(carry.doseGrams, profile, "exercise_during");
        lines.push({
          id: "on_hand",
          label: `Every ${carry.intervalMinutes} min`,
          text: doseDetail
            ? `~${Math.round(carry.doseGrams)}g · ${doseDetail}`
            : `~${Math.round(carry.doseGrams)}g`,
        });
      }
    }
    return lines;
  }

  return lines;
}

/**
 * One-line carb planning hint from {@link calculateExercisePlan} (intensity + duration).
 * Omit when not_recommended — low-BG copy already includes treat amounts; sick day is a hard stop.
 */
export function getExerciseCarbPlanHintLine(
  plan: ExercisePlanResult,
  verdict: ExerciseReadinessVerdict,
  options?: {
    phase?: "pre" | "active" | "recovery";
    exerciseType?: string;
    profile?: Partial<UserProfile> | null;
    currentBg?: number | null;
    bgUnits?: string;
    intensity?: ExerciseIntensity;
    trend?: ExerciseBgTrend | null;
  },
): string | null {
  const lines = getExerciseFuelPlanLines(plan, verdict, options?.profile, {
    phase: options?.phase,
    exerciseType: options?.exerciseType,
    currentBg: options?.currentBg,
    bgUnits: options?.bgUnits,
    intensity: options?.intensity,
    trend: options?.trend,
  });
  if (lines.length === 0) return null;
  return `${lines.map((l) => `${l.label}: ${l.text}`).join(" · ")}.`;
}

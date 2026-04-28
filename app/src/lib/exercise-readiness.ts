/**
 * Shared readiness verdict for exercise planner and active exercise banner.
 * Rule-based; not medical advice.
 */

import type { ExercisePlanResult } from "@/lib/exercise-plan";
import type { ExerciseBgTrend, ExerciseIntensity, PreRapidInsulin2h } from "@/lib/storage";

export type ExerciseReadinessVerdict = "ready" | "caution" | "not_recommended";

export interface ExerciseReadinessResult {
  verdict: ExerciseReadinessVerdict;
  title: string;
  detail: string;
}

function parseNumericMaybe(value: string | null | undefined): number | null {
  if (value == null) return null;
  const n = parseFloat(String(value).trim().replace(",", "."));
  return Number.isFinite(n) ? n : null;
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
}

function baseVerdict(input: ExerciseReadinessInput): ExerciseReadinessResult {
  const { exercisePlanResult, bgUnits, sickDayActive, sickDaySeverity } = input;

  if (!exercisePlanResult) {
    return { verdict: "caution", title: "Caution", detail: "Plan a workout to see guidance." };
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
      title: "Caution",
      detail: "Add your current BG to refine this.",
    };
  }

  const highThreshold = bgUnits === "mmol/L" ? 13.9 : 250;
  if (bg < lowThreshold) {
    const grams = exercisePlanResult.pre.carbsIfLow;
    return {
      verdict: "not_recommended",
      title: "Not recommended (low BG)",
      detail: grams > 0 ? `Treat first (about ${grams}g fast carbs), then re-check.` : "Treat first, then re-check.",
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
    t === "cardio" ||
    t === "hiit" ||
    t === "walking" ||
    t === "swimming" ||
    t === "court" ||
    t === "field";
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
    return { verdict: "caution", title: "Caution", detail: "Plan data missing — add BG for clearer recovery guidance." };
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
      title: "Caution",
      detail: "Add your current BG — recovery colours and tips depend on level and trend.",
    };
  }

  const highThreshold = bgUnits === "mmol/L" ? 13.9 : 250;
  const trend = input.bgTrend ?? "not_sure";
  /** Below range but not yet under formal low threshold — still falling → treat like a high-risk window. */
  const approachMargin = bgUnits === "mmol/L" ? 0.9 : 16;
  const approachLowCeiling = lowThreshold + approachMargin;

  if (bg < lowThreshold) {
    const grams = exercisePlanResult.pre.carbsIfLow;
    return {
      verdict: "not_recommended",
      title: "Not recommended (low BG)",
      detail:
        grams > 0
          ? `Low after exercise — treat first (~${grams}g fast carbs), then re-check per your hypo plan.`
          : "Low after exercise — treat per your hypo plan, then re-check.",
    };
  }

  if (trend === "falling" && bg < approachLowCeiling) {
    return {
      verdict: "not_recommended",
      title: "Not recommended (low + falling)",
      detail:
        "BG is borderline low and dropping — treat per your hypo plan if your team uses these bands; delayed lows after activity are common.",
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
      verdict: "caution",
      title: "Caution",
      detail:
        "BG is rising for now — some people swing after effort; still plan for possible drops later and follow your team’s targets.",
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

/**
 * Layered "deeper context" caution refiners (sleep, feeling off, alcohol, beta-blocker, GLP-1, history).
 * Never upgrades a verdict — only escalates ready→caution where the combined risk warrants it.
 * Preserves not_recommended verdicts unchanged.
 */
function refineWithDeeperContext(result: ExerciseReadinessResult, input: ExerciseReadinessInput): ExerciseReadinessResult {
  if (result.verdict === "not_recommended") return result;

  const triggers: string[] = [];
  if (input.feelingOff) triggers.push("you noted feeling off");
  if (input.sleepHoursLastNight != null && input.sleepHoursLastNight < 6) {
    triggers.push("low sleep last night");
  }
  if (input.alcoholLastNight) triggers.push("alcohol last night raises delayed-low risk");
  if (input.hypoProneHistory) triggers.push("your history shows hypos for this routine");

  if (triggers.length === 0) return result;

  if (result.verdict === "ready") {
    return {
      verdict: "caution",
      title: "Caution",
      detail: `${result.detail} Also: ${triggers[0]}${triggers.length > 1 ? ` (+${triggers.length - 1} more factor${triggers.length - 1 === 1 ? "" : "s"})` : ""}. Plan extra checks and keep fast carbs nearby.`,
    };
  }

  return {
    ...result,
    detail: `${result.detail} Plus: ${triggers[0]}${triggers.length > 1 ? ` (+${triggers.length - 1} more)` : ""}.`,
  };
}

/** Planner and active banner: shared go / caution / not recommended copy. */
export function getExerciseReadinessVerdict(input: ExerciseReadinessInput): ExerciseReadinessResult {
  if (input.phase === "recovery") {
    return refineWithDeeperContext(getRecoveryReadinessVerdict(input), input);
  }
  const base = baseVerdict(input);
  const withTrends = refineWithExerciseTypeAndTrend(base, input);
  const withInsulin = refineWithPreRapidInsulin(withTrends, input);
  return refineWithDeeperContext(withInsulin, input);
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

/**
 * One-line carb planning hint from {@link calculateExercisePlan} (intensity + duration).
 * Omit when not_recommended — low-BG copy already includes treat amounts; sick day is a hard stop.
 */
export function getExerciseCarbPlanHintLine(
  plan: ExercisePlanResult,
  verdict: ExerciseReadinessVerdict,
  options?: { phase?: "pre" | "active" | "recovery" },
): string | null {
  if (options?.phase === "recovery") return null;
  if (verdict === "not_recommended") return null;

  const pre = plan.pre.carbsIfLow;
  const during = plan.during.carbsNeeded;
  if (pre <= 0 && during <= 0) return null;

  const parts: string[] = [];
  if (pre > 0) {
    parts.push(`~${pre}g fast carbs on hand before you start`);
  }
  if (during > 0) {
    parts.push(`~${during}g during if BG drops (${plan.during.carbFrequency})`);
  }
  return `${parts.join(" · ")}.`;
}

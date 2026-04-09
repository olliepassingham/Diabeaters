/**
 * Shared readiness verdict for exercise planner and active exercise banner.
 * Rule-based; not medical advice.
 */

import type { ExercisePlanResult } from "@/lib/exercise-plan";
import type { ExerciseBgTrend, ExerciseIntensity } from "@/lib/storage";

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
      detail: "Add your current BG for a clearer go/no-go decision.",
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

/** Planner and active banner: shared go / caution / not recommended copy. */
export function getExerciseReadinessVerdict(input: ExerciseReadinessInput): ExerciseReadinessResult {
  if (input.phase === "recovery") {
    return {
      verdict: "caution",
      title: "Recovery",
      detail:
        "Post-workout window — delayed lows can happen for hours afterward. Follow your care team's plan for bolus, basal, and snacks.",
    };
  }
  const base = baseVerdict(input);
  return refineWithExerciseTypeAndTrend(base, input);
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
  return `${parts.join(" · ")}. Confirm amounts with your care team.`;
}

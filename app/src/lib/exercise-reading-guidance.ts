/**
 * Rule-based educational lines from BG + trend during exercise flow.
 * No insulin dosing — confirm changes with your care team.
 */

import type { ExerciseBgTrend, ExerciseIntensity, ExerciseType } from "@/lib/storage";

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
  return bgUnits === "mmol/L" ? bg < 5.6 : bg < 100;
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
    tips.push("Reading is below typical exercise-start range for many people — treat low BG first and delay hard effort until your team’s targets are met.");
    tips.push("If you use a CGM, confirm with a fingerstick if readings don’t match how you feel.");
    return tips;
  }

  if (high) {
    if (intensity === "intense") {
      tips.push("Higher BG before intense effort: check ketones and follow your sick-day or ketone plan if your team has one.");
    } else {
      tips.push("BG is on the high side — gentle activity may still be an option; confirm targets and any corrections with your care team.");
    }
  } else if (ok) {
    tips.push(`Around ${bgUnits === "mmol/L" ? "target" : "a common"} pre-exercise band for many — still watch how you feel and your trend.`);
  }

  const cardioLike = exerciseType === "cardio" || exerciseType === "hiit" || exerciseType === "walking" || exerciseType === "swimming";

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

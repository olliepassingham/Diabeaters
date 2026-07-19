/**
 * Unifies the exercise tool's readiness verdict, fuel plan lines, and hypo suggestion
 * into one coherent recommendation. Shared by the guided coach, the status strip, and
 * the dashboard widget so all three surfaces agree on what to say for the same session
 * and BG reading — the same class of fix as {@link resolveBedtimeAction} for the bedtime
 * tool.
 *
 * Historically the three calculators were combined ad hoc per surface: a hypo suggestion
 * (weight-based grams) could be shown at the same time as a fuel-plan "Take now" line
 * (a fixed carb-band number), giving the user two different amounts for the same moment.
 * The hypo suggestion is the more personalised, weight-aware number, so it always wins —
 * this module is the single place that enforces that precedence.
 */

import type { ExerciseFuelPlanLine } from "@/lib/exercise-readiness";
import type { ExerciseHypoSuggestion } from "@/lib/exercise-hypo-auto";

/**
 * Drop any fuel-plan "Take now" line once a hypo suggestion is present — the hypo
 * suggestion is the single source of truth for how many grams to take right now.
 * Complementary lines (carry-on-you, interval dosing, "have ready") are kept since
 * they don't restate a conflicting number.
 */
export function reconcileExerciseFuelLines(
  lines: ExerciseFuelPlanLine[],
  hypoSuggestion: ExerciseHypoSuggestion | null | undefined,
): ExerciseFuelPlanLine[] {
  if (!hypoSuggestion) return lines;
  return lines.filter((line) => !(line.id === "on_hand" && line.label === "Take now"));
}

export type ExercisePrimaryActionKind = "hypo" | "fuel" | "steady";

export type ExercisePrimaryAction =
  | { kind: "hypo"; suggestion: ExerciseHypoSuggestion; supportingLines: ExerciseFuelPlanLine[] }
  | { kind: "fuel"; lines: ExerciseFuelPlanLine[] }
  | { kind: "steady" };

/**
 * Single entry point combining a fuel plan and a hypo suggestion into one action so
 * callers never need to decide independently which number to show.
 */
export function resolveExercisePrimaryAction(
  fuelLines: ExerciseFuelPlanLine[],
  hypoSuggestion: ExerciseHypoSuggestion | null | undefined,
): ExercisePrimaryAction {
  if (hypoSuggestion) {
    return {
      kind: "hypo",
      suggestion: hypoSuggestion,
      supportingLines: reconcileExerciseFuelLines(fuelLines, hypoSuggestion),
    };
  }
  if (fuelLines.length > 0) {
    return { kind: "fuel", lines: fuelLines };
  }
  return { kind: "steady" };
}

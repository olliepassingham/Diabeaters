import { describe, expect, it } from "vitest";

import { reconcileExerciseFuelLines, resolveExercisePrimaryAction } from "./exercise-recommendation";
import type { ExerciseFuelPlanLine } from "./exercise-readiness";
import type { ExerciseHypoSuggestion } from "./exercise-hypo-auto";

const hypoSuggestion: ExerciseHypoSuggestion = {
  carbsGrams: 18,
  glucoseTablets: 4,
  juiceMl: 150,
  approximate: false,
  clinicalHypo: true,
};

const takeNowLine: ExerciseFuelPlanLine = { id: "on_hand", label: "Take now", text: "20g fast carbs" };
const carryLine: ExerciseFuelPlanLine = { id: "during", label: "Carry with you", text: "~30g fast carbs" };

describe("reconcileExerciseFuelLines", () => {
  it("returns the lines unchanged when there is no hypo suggestion", () => {
    expect(reconcileExerciseFuelLines([takeNowLine, carryLine], null)).toEqual([takeNowLine, carryLine]);
  });

  it("drops the fuel plan's own 'Take now' line once a hypo suggestion exists, to avoid a second conflicting number", () => {
    const result = reconcileExerciseFuelLines([takeNowLine, carryLine], hypoSuggestion);
    expect(result).toEqual([carryLine]);
  });

  it("keeps complementary lines that don't restate a take-now amount", () => {
    const result = reconcileExerciseFuelLines([carryLine], hypoSuggestion);
    expect(result).toEqual([carryLine]);
  });
});

describe("resolveExercisePrimaryAction", () => {
  it("prioritises the hypo suggestion over fuel lines when both are present", () => {
    const action = resolveExercisePrimaryAction([takeNowLine, carryLine], hypoSuggestion);
    expect(action.kind).toBe("hypo");
    if (action.kind === "hypo") {
      expect(action.suggestion).toBe(hypoSuggestion);
      expect(action.supportingLines).toEqual([carryLine]);
    }
  });

  it("falls back to fuel lines when there is no hypo suggestion", () => {
    const action = resolveExercisePrimaryAction([carryLine], null);
    expect(action).toEqual({ kind: "fuel", lines: [carryLine] });
  });

  it("reports steady when there is nothing to show", () => {
    const action = resolveExercisePrimaryAction([], null);
    expect(action).toEqual({ kind: "steady" });
  });
});

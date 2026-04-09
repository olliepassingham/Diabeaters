import { describe, expect, it } from "vitest";
import { calculateExercisePlan } from "./exercise-plan";
import { getExerciseCarbPlanHintLine, getExerciseReadinessVerdict } from "./exercise-readiness";

const plan = calculateExercisePlan({
  exerciseType: "cardio",
  durationMinutes: 45,
  intensity: "moderate",
  minutesUntilStart: 0,
  bgUnits: "mmol/L",
  currentBg: 7,
});

describe("getExerciseReadinessVerdict recovery phase", () => {
  it("does not say in range to start", () => {
    const r = getExerciseReadinessVerdict({
      exercisePlanResult: plan,
      currentBg: 7,
      bgUnits: "mmol/L",
      exerciseType: "cardio",
      intensity: "moderate",
      phase: "recovery",
    });
    expect(r.title).toBe("Recovery");
    expect(r.detail.toLowerCase()).not.toContain("start");
    expect(r.detail.toLowerCase()).not.toContain("in range to start");
  });

  it("omits pre-session carb hint for recovery", () => {
    const r = getExerciseReadinessVerdict({
      exercisePlanResult: plan,
      currentBg: 7,
      bgUnits: "mmol/L",
      exerciseType: "cardio",
      intensity: "moderate",
      phase: "recovery",
    });
    expect(getExerciseCarbPlanHintLine(plan, r.verdict, { phase: "recovery" })).toBeNull();
  });
});

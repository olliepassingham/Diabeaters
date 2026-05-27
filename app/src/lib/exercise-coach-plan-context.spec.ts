import { describe, expect, it } from "vitest";

import { buildExercisePlanContextFromCoachSession } from "./exercise-coach-plan-context";
import type { ActiveExerciseSession } from "./storage";

function baseSession(overrides: Partial<ActiveExerciseSession> = {}): ActiveExerciseSession {
  return {
    id: "s1",
    exerciseName: "Run",
    exerciseType: "cardio",
    intensity: "moderate",
    durationMinutes: 45,
    phase: "pre",
    startedAt: new Date().toISOString(),
    recoveryMinutes: 120,
    midCheckDone: false,
    preChecklist: { bgChecked: false, carbsConsidered: false, basalAdjusted: false },
    ...overrides,
  };
}

describe("buildExercisePlanContextFromCoachSession", () => {
  it("maps last meal timing and carbs", () => {
    const ctx = buildExercisePlanContextFromCoachSession({
      session: baseSession({
        prefuelMinutesAgo: 60,
        prefuelGrams: 50,
      }),
      bgUnits: "mmol/L",
    });
    expect(ctx.minutesUntilStart).toBe(30);
    expect(ctx.minutesSinceLastMeal).toBe(60);
    expect(ctx.nutritionContext).toBe("ate_recently");
    expect(ctx.approximateCarbsGrams).toBe(50);
  });

  it("maps fasted", () => {
    const ctx = buildExercisePlanContextFromCoachSession({
      session: baseSession({ preFasted: true }),
      bgUnits: "mmol/L",
    });
    expect(ctx.nutritionContext).toBe("fasted");
  });
});

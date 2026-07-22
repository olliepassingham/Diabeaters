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

  it("counts minutesUntilStart down as the user lingers on the pre screen, instead of a flat 30", () => {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60_000).toISOString();
    const ctx = buildExercisePlanContextFromCoachSession({
      session: baseSession({ startedAt: tenMinutesAgo }),
      bgUnits: "mmol/L",
    });
    expect(ctx.minutesUntilStart).toBeLessThan(30);
    expect(ctx.minutesUntilStart).toBeGreaterThanOrEqual(18);
  });

  it("floors minutesUntilStart at 0 once the assumed prep window has fully elapsed", () => {
    const anHourAgo = new Date(Date.now() - 60 * 60_000).toISOString();
    const ctx = buildExercisePlanContextFromCoachSession({
      session: baseSession({ startedAt: anHourAgo }),
      bgUnits: "mmol/L",
    });
    expect(ctx.minutesUntilStart).toBe(0);
  });
});

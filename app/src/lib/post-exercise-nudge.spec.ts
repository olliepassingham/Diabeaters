import { describe, expect, it } from "vitest";
import { inferPostExerciseLoadTier } from "./post-exercise-nudge";
import type { LastExerciseSummary } from "./storage";

function sum(partial: Partial<LastExerciseSummary>): LastExerciseSummary {
  return {
    endedAt: new Date().toISOString(),
    exerciseType: "cardio",
    intensity: "moderate",
    durationMinutes: 30,
    exerciseName: "Run",
    ...partial,
  };
}

describe("inferPostExerciseLoadTier", () => {
  it("rates short easy yoga as light", () => {
    expect(
      inferPostExerciseLoadTier(
        sum({ exerciseType: "yoga", intensity: "light", durationMinutes: 20 }),
      ),
    ).toBe("light");
  });

  it("rates long intense HIIT as heavy", () => {
    expect(
      inferPostExerciseLoadTier(
        sum({ exerciseType: "hiit", intensity: "intense", durationMinutes: 55 }),
      ),
    ).toBe("heavy");
  });

  it("bumps toward heavy when RPE is high on a long hard session", () => {
    expect(
      inferPostExerciseLoadTier(
        sum({
          exerciseType: "hiit",
          intensity: "intense",
          durationMinutes: 50,
          context: { midRpe: 9 },
        }),
      ),
    ).toBe("heavy");
  });
});

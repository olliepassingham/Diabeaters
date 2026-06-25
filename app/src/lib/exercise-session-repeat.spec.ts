import { describe, expect, it } from "vitest";

import { findLastRepeatableExerciseSession } from "@/lib/exercise-session-repeat";
import type { ExerciseOutcome, LastExerciseSummary } from "@/lib/storage";

describe("findLastRepeatableExerciseSession", () => {
  it("prefers the most recent exercise outcome", () => {
    const outcomes: ExerciseOutcome[] = [
      {
        id: "1",
        exerciseType: "cardio",
        intensity: "moderate",
        durationMinutes: 45,
        exerciseName: "Run",
        completedAt: "2026-06-01T10:00:00.000Z",
      },
      {
        id: "2",
        exerciseType: "strength",
        intensity: "intense",
        durationMinutes: 60,
        exerciseName: "Gym",
        completedAt: "2026-06-10T10:00:00.000Z",
      },
    ];
    const session = findLastRepeatableExerciseSession({ outcomes, lastSummary: null });
    expect(session?.exerciseType).toBe("strength");
    expect(session?.label).toContain("Gym");
  });

  it("falls back to last exercise summary", () => {
    const lastSummary: LastExerciseSummary = {
      endedAt: "2026-06-09T18:00:00.000Z",
      exerciseType: "court",
      intensity: "moderate",
      durationMinutes: 40,
      exerciseName: "Tennis",
    };
    const session = findLastRepeatableExerciseSession({ outcomes: [], lastSummary });
    expect(session?.durationMinutes).toBe(40);
    expect(session?.label).toContain("Tennis");
  });
});

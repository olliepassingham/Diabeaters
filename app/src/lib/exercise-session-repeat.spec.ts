import { describe, expect, it } from "vitest";

import { findLastRepeatableExerciseSession, listRecentRepeatableExerciseSessions } from "@/lib/exercise-session-repeat";
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
        feltHypo: false,
        completedAt: "2026-06-01T10:00:00.000Z",
      },
      {
        id: "2",
        exerciseType: "strength",
        intensity: "intense",
        durationMinutes: 60,
        exerciseName: "Gym",
        feltHypo: false,
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

describe("listRecentRepeatableExerciseSessions", () => {
  it("returns one row per exercise type, newest first", () => {
    const outcomes: ExerciseOutcome[] = [
      {
        id: "1",
        exerciseType: "cardio",
        intensity: "moderate",
        durationMinutes: 45,
        exerciseName: "Run",
        feltHypo: false,
        completedAt: "2026-06-01T10:00:00.000Z",
      },
      {
        id: "2",
        exerciseType: "strength",
        intensity: "intense",
        durationMinutes: 60,
        exerciseName: "Gym",
        feltHypo: false,
        completedAt: "2026-06-10T10:00:00.000Z",
      },
      {
        id: "3",
        exerciseType: "strength",
        intensity: "intense",
        durationMinutes: 60,
        exerciseName: "Gym",
        feltHypo: false,
        completedAt: "2026-06-09T10:00:00.000Z",
      },
    ];

    const recent = listRecentRepeatableExerciseSessions({ outcomes, limit: 5 });
    expect(recent).toHaveLength(2);
    expect(recent[0]?.id).toBe("2");
    expect(recent[1]?.id).toBe("1");
  });

  it("keeps only the newest session when the same type was restarted with a different duration", () => {
    const outcomes: ExerciseOutcome[] = [
      {
        id: "tennis-90",
        exerciseType: "court",
        intensity: "moderate",
        durationMinutes: 90,
        exerciseName: "Tennis",
        feltHypo: false,
        completedAt: "2026-08-05T10:00:00.000Z",
      },
      {
        id: "tennis-120",
        exerciseType: "court",
        intensity: "moderate",
        durationMinutes: 120,
        exerciseName: "Tennis",
        feltHypo: false,
        completedAt: "2026-08-03T10:00:00.000Z",
      },
      {
        id: "golf",
        exerciseType: "walking",
        intensity: "moderate",
        durationMinutes: 240,
        exerciseName: "Golf",
        feltHypo: false,
        completedAt: "2026-07-24T10:00:00.000Z",
      },
    ];

    const recent = listRecentRepeatableExerciseSessions({ outcomes, limit: 5 });
    expect(recent.map((s) => s.id)).toEqual(["tennis-90", "golf"]);
    expect(recent[0]?.durationMinutes).toBe(90);
  });
});

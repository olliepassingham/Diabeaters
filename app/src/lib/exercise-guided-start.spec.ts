import { beforeEach, describe, expect, it } from "vitest";

import { startGuidedExerciseSession } from "./exercise-guided-start";
import { setActiveUserIdForLocalStorage, storage } from "./storage";

describe("startGuidedExerciseSession", () => {
  beforeEach(() => {
    localStorage.clear();
    setActiveUserIdForLocalStorage("test-user");
  });

  it("restarts a recent workout when the stored session is a finished recovery", () => {
    storage.startExerciseSession({
      exerciseName: "Gym",
      exerciseType: "strength",
      intensity: "moderate",
      durationMinutes: 45,
    });
    storage.startExercisePhase();
    storage.finishExercisePhase();
    const endedAt = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    storage.updateActiveExercise({
      exerciseEndedAt: endedAt,
      recoveryEndsAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    });

    const result = startGuidedExerciseSession({
      exerciseName: "Gym",
      exerciseType: "strength",
      intensity: "moderate",
      durationMinutes: 45,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.session.phase).toBe("pre");
    expect(result.session.exerciseName).toBe("Gym");
    expect(storage.didExerciseRecently(24)).toBe(false);
  });

  it("does not replace a workout that is still in progress", () => {
    const current = storage.startExerciseSession({
      exerciseName: "Gym",
      exerciseType: "strength",
      intensity: "moderate",
      durationMinutes: 45,
    });
    storage.startExercisePhase();

    const result = startGuidedExerciseSession({
      exerciseName: "5km Run",
      exerciseType: "cardio",
      intensity: "moderate",
      durationMinutes: 30,
    });

    expect(result.ok).toBe(false);
    if (result.ok || result.reason !== "active_session") return;
    expect(result.session.id).toBe(current.id);
    expect(storage.getActiveExercise()?.id).toBe(current.id);
  });

  it("drops a getting-ready session left open from a previous day", () => {
    storage.startExerciseSession({
      exerciseName: "Gym",
      exerciseType: "strength",
      intensity: "moderate",
      durationMinutes: 45,
    });
    storage.updateActiveExercise({
      startedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    });

    const result = startGuidedExerciseSession({
      exerciseName: "Gym",
      exerciseType: "strength",
      intensity: "moderate",
      durationMinutes: 45,
    });

    expect(result.ok).toBe(true);
    expect(storage.getExerciseOutcomes()).toHaveLength(0);
    expect(storage.didExerciseRecently(24)).toBe(false);
  });
});

import { beforeEach, describe, expect, it } from "vitest";

import { collectAllActivityEvents } from "./activity-history";
import { setActiveUserIdForLocalStorage, storage, type ActiveExerciseSession } from "./storage";

describe("normalizeActiveExerciseSession", () => {
  it("clears midSymptoms when stored value is not an array (prevents During-phase crash)", () => {
    const raw = {
      id: "test-1",
      exerciseName: "Cardio",
      exerciseType: "cardio" as const,
      intensity: "moderate" as const,
      durationMinutes: 45,
      phase: "active" as const,
      startedAt: new Date().toISOString(),
      recoveryMinutes: 60,
      midCheckDone: false,
      preChecklist: { bgChecked: false, carbsConsidered: false, basalAdjusted: false },
      midSymptoms: { oops: true } as unknown as ActiveExerciseSession["midSymptoms"],
    };
    const n = storage.normalizeActiveExerciseSession(raw as ActiveExerciseSession);
    expect(n.midSymptoms).toBeUndefined();
  });

  it("keeps only valid symptom flag strings", () => {
    const raw = {
      id: "test-2",
      exerciseName: "Cardio",
      exerciseType: "cardio" as const,
      intensity: "moderate" as const,
      durationMinutes: 45,
      phase: "active" as const,
      startedAt: new Date().toISOString(),
      recoveryMinutes: 60,
      midCheckDone: false,
      preChecklist: { bgChecked: false, carbsConsidered: false, basalAdjusted: false },
      midSymptoms: ["shaky", "invalid", "fine"] as ActiveExerciseSession["midSymptoms"],
    };
    const n = storage.normalizeActiveExerciseSession(raw as ActiveExerciseSession);
    expect(n.midSymptoms).toEqual(["shaky", "fine"]);
  });
});

describe("exercise outcome logging", () => {
  beforeEach(() => {
    localStorage.clear();
    setActiveUserIdForLocalStorage("test-user");
  });

  it("does not log an outcome when ending a pre-phase session", () => {
    storage.startExerciseSession({
      exerciseName: "Walk",
      exerciseType: "walking",
      intensity: "light",
      durationMinutes: 30,
    });
    storage.endExerciseSession();
    expect(storage.getExerciseOutcomes()).toHaveLength(0);
  });

  it("logs a minimal outcome when a started session finishes", () => {
    storage.startExerciseSession({
      exerciseName: "Walk",
      exerciseType: "walking",
      intensity: "light",
      durationMinutes: 30,
    });
    storage.startExercisePhase();
    const session = storage.getActiveExercise()!;
    storage.endExerciseSession();

    const outcomes = storage.getExerciseOutcomes();
    expect(outcomes).toHaveLength(1);
    expect(outcomes[0].sessionId).toBe(session.id);
    expect(outcomes[0].feltHypo).toBe(false);
    expect(outcomes[0].bgResponse).toBeUndefined();

    const events = collectAllActivityEvents().filter((e) => e.kind === "exercise_session");
    expect(events).toHaveLength(1);
  });

  it("does not log when the user abandons a started session", () => {
    storage.startExerciseSession({
      exerciseName: "Walk",
      exerciseType: "walking",
      intensity: "light",
      durationMinutes: 30,
    });
    storage.startExercisePhase();
    storage.endExerciseSession({ abandon: true });
    expect(storage.getExerciseOutcomes()).toHaveLength(0);
  });

  it("enriches the auto-logged row when feedback is saved", () => {
    storage.startExerciseSession({
      exerciseName: "Run",
      exerciseType: "cardio",
      intensity: "moderate",
      durationMinutes: 45,
    });
    storage.startExercisePhase();
    const session = storage.getActiveExercise()!;
    storage.endExerciseSession();

    const updated = storage.saveExerciseOutcomeFeedback(session.id, {
      bgResponse: "stable",
      feltHypo: false,
      notes: "Felt good",
    });
    expect(updated?.bgResponse).toBe("stable");
    expect(updated?.notes).toBe("Felt good");
    expect(storage.getExerciseOutcomes()).toHaveLength(1);
  });
});

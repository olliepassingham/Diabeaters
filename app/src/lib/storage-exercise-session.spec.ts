import { describe, expect, it } from "vitest";
import { storage, type ActiveExerciseSession } from "./storage";

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

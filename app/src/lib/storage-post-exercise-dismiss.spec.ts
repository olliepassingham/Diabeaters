import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { storage } from "./storage";

const sessionMeta = {
  exerciseType: "cardio" as const,
  intensity: "moderate" as const,
  durationMinutes: 30,
};

describe("post-exercise nudge session dismiss", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-01T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("hides educational nudges after dismiss for the current endedAt", () => {
    const t1 = "2026-06-01T10:00:00.000Z";
    storage.recordExerciseEndedAt(t1, sessionMeta);
    expect(storage.shouldShowPostExerciseEducationalNudges()).toBe(true);
    storage.dismissPostExerciseNudgesForCurrentSession();
    expect(storage.shouldShowPostExerciseEducationalNudges()).toBe(false);
    expect(storage.isPostExerciseNudgeDismissedForCurrentSession()).toBe(true);
  });

  it("shows nudges again when a new workout ends with a different endedAt", () => {
    const t1 = "2026-06-01T10:00:00.000Z";
    storage.recordExerciseEndedAt(t1, sessionMeta);
    storage.dismissPostExerciseNudgesForCurrentSession();
    const t2 = "2026-06-01T11:00:00.000Z";
    storage.recordExerciseEndedAt(t2, sessionMeta);
    expect(storage.isPostExerciseNudgeDismissedForCurrentSession()).toBe(false);
    expect(storage.shouldShowPostExerciseEducationalNudges()).toBe(true);
  });

  it("resume clears dismiss for the same session", () => {
    const t1 = "2026-06-01T10:00:00.000Z";
    storage.recordExerciseEndedAt(t1, sessionMeta);
    storage.dismissPostExerciseNudgesForCurrentSession();
    expect(storage.shouldShowPostExerciseEducationalNudges()).toBe(false);
    storage.clearPostExerciseNudgeDismissForCurrentSession();
    expect(storage.shouldShowPostExerciseEducationalNudges()).toBe(true);
  });
});

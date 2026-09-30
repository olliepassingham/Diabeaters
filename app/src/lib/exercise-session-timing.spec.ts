import { describe, expect, it } from "vitest";
import {
  getWorkoutElapsedMs,
  getWorkoutRemainingMs,
  isExercisePaused,
  isStaleActiveExerciseSession,
  STALE_ACTIVE_EXERCISE_MS,
} from "./exercise-session-timing";

describe("getWorkoutElapsedMs", () => {
  const start = "2026-08-05T10:00:00.000Z";
  const t0 = Date.parse(start);

  it("returns wall-clock elapsed when never paused", () => {
    expect(getWorkoutElapsedMs({ exerciseStartedAt: start }, t0 + 90_000)).toBe(90_000);
  });

  it("excludes completed pauses", () => {
    expect(
      getWorkoutElapsedMs(
        { exerciseStartedAt: start, totalPausedMs: 30_000 },
        t0 + 120_000,
      ),
    ).toBe(90_000);
  });

  it("freezes during an open pause", () => {
    const pausedAt = new Date(t0 + 60_000).toISOString();
    expect(
      getWorkoutElapsedMs(
        { exerciseStartedAt: start, pausedAt, totalPausedMs: 0 },
        t0 + 180_000,
      ),
    ).toBe(60_000);
  });

  it("combines completed and open pauses", () => {
    const pausedAt = new Date(t0 + 100_000).toISOString();
    expect(
      getWorkoutElapsedMs(
        { exerciseStartedAt: start, pausedAt, totalPausedMs: 20_000 },
        t0 + 150_000,
      ),
    ).toBe(80_000); // 150s wall - 20s completed - 50s open = 80s
  });

  it("returns 0 without a start time", () => {
    expect(getWorkoutElapsedMs({}, Date.now())).toBe(0);
  });
});

describe("isExercisePaused / remaining", () => {
  it("detects an open pause only in active phase", () => {
    expect(isExercisePaused({ phase: "active", pausedAt: new Date().toISOString() })).toBe(true);
    expect(isExercisePaused({ phase: "active", pausedAt: undefined })).toBe(false);
    expect(isExercisePaused({ phase: "pre", pausedAt: new Date().toISOString() })).toBe(false);
  });

  it("computes remaining planned time from effective elapsed", () => {
    const start = "2026-08-05T10:00:00.000Z";
    const t0 = Date.parse(start);
    expect(
      getWorkoutRemainingMs(
        { exerciseStartedAt: start, durationMinutes: 45, totalPausedMs: 0 },
        t0 + 15 * 60_000,
      ),
    ).toBe(30 * 60_000);
  });
});

describe("isStaleActiveExerciseSession", () => {
  const now = Date.parse("2026-09-30T18:37:00.000Z");

  it("treats a finished recovery window as stale", () => {
    expect(
      isStaleActiveExerciseSession(
        {
          phase: "recovery",
          startedAt: "2026-09-28T17:00:00.000Z",
          exerciseStartedAt: "2026-09-28T17:05:00.000Z",
          durationMinutes: 45,
          recoveryEndsAt: "2026-09-28T19:00:00.000Z",
        },
        now,
      ),
    ).toBe(true);
  });

  it("keeps a workout that is still inside its recovery window", () => {
    expect(
      isStaleActiveExerciseSession(
        {
          phase: "recovery",
          startedAt: "2026-09-30T17:00:00.000Z",
          exerciseStartedAt: "2026-09-30T17:05:00.000Z",
          durationMinutes: 45,
          recoveryEndsAt: "2026-09-30T19:30:00.000Z",
        },
        now,
      ),
    ).toBe(false);
  });

  it("keeps a paused workout until 12 hours after the pause", () => {
    const pausedAt = new Date(now - STALE_ACTIVE_EXERCISE_MS + 60_000).toISOString();
    expect(
      isStaleActiveExerciseSession(
        {
          phase: "active",
          startedAt: "2026-09-29T08:00:00.000Z",
          exerciseStartedAt: "2026-09-29T08:00:00.000Z",
          pausedAt,
          durationMinutes: 45,
          recoveryEndsAt: undefined,
        },
        now,
      ),
    ).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import {
  getWorkoutElapsedMs,
  getWorkoutRemainingMs,
  isExercisePaused,
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

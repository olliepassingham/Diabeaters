import { describe, expect, it } from "vitest";
import { buildExerciseSessionBgSeries, exerciseSessionBgGlance, recentSessionBgForField } from "./exercise-session-summary";

const session = {
  startedAt: "2026-09-28T08:00:00.000Z",
  exerciseStartedAt: "2026-09-28T08:05:00.000Z",
  preBg: 7.2,
  preBgAt: "2026-09-28T08:04:00.000Z",
  midBg: 5.4,
  midBgAt: "2026-09-28T08:30:00.000Z",
  recoveryBg: 6.1,
  recoveryBgAt: "2026-09-28T09:00:00.000Z",
};

describe("buildExerciseSessionBgSeries", () => {
  it("uses CGM readings inside the workout window", () => {
    const series = buildExerciseSessionBgSeries(
      session,
      [
        { recordedAtMs: Date.parse("2026-09-28T07:00:00.000Z"), valueMgDl: 200 },
        { recordedAtMs: Date.parse("2026-09-28T08:10:00.000Z"), valueMgDl: 126 },
        { recordedAtMs: Date.parse("2026-09-28T08:40:00.000Z"), valueMgDl: 90 },
      ],
      "mmol/L",
      Date.parse("2026-09-28T09:00:00.000Z"),
    );
    expect(series.source).toBe("cgm");
    expect(series.points).toHaveLength(2);
    expect(series.points[0]!.value).toBeCloseTo(7, 0);
  });

  it("falls back to logged checks when CGM is missing", () => {
    const series = buildExerciseSessionBgSeries(session, [], "mmol/L", Date.parse("2026-09-28T09:00:00.000Z"));
    expect(series.source).toBe("checks");
    expect(exerciseSessionBgGlance(series.points)).toEqual({ start: 7.2, low: 5.4, now: 6.1 });
  });

  it("uses a recent session reading for the recovery field", () => {
    const bare = {
      startedAt: "2026-09-28T08:00:00.000Z",
      exerciseStartedAt: "2026-09-28T08:05:00.000Z",
    };
    const now = Date.parse("2026-09-28T09:00:00.000Z");
    const recent = recentSessionBgForField(
      bare,
      [{ recordedAtMs: Date.parse("2026-09-28T08:55:00.000Z"), valueMgDl: 216 }],
      "mmol/L",
      now,
    );
    expect(recent?.value).toBeCloseTo(12, 0);
    const stale = recentSessionBgForField(
      bare,
      [{ recordedAtMs: Date.parse("2026-09-28T08:10:00.000Z"), valueMgDl: 216 }],
      "mmol/L",
      now,
    );
    expect(stale).toBeNull();
  });
});

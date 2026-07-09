import { describe, expect, it } from "vitest";
import {
  intersectTimeInterval,
  resolveExerciseChartOverlays,
  resolveSleepChartOverlays,
} from "@/lib/cgm/cgm-chart-overlays";
import type { BedtimeLog, ExerciseOutcome } from "@/lib/storage";

describe("cgm chart overlays", () => {
  it("intersects intervals within the chart window", () => {
    expect(intersectTimeInterval(100, 500, 200, 400)).toEqual({ startMs: 200, endMs: 400 });
    expect(intersectTimeInterval(100, 150, 200, 400)).toBeNull();
  });

  it("resolves sleep windows from bedtime logs", () => {
    const checkMs = new Date("2026-07-08T22:00:00").getTime();
    const log: BedtimeLog = {
      id: "b1",
      date: new Date(checkMs).toISOString(),
      currentBg: 6,
      bgUnits: "mmol/L",
      readinessLevel: "steady",
      hoursSinceFood: 2,
      hoursSinceInsulin: 3,
      hoursUntilSleep: 1,
      exercisedToday: false,
      hadAlcohol: false,
      sickDayActive: false,
      travelModeActive: false,
      correctionGiven: null,
      notes: "",
    };
    const windowStart = checkMs - 60 * 60_000;
    const windowEnd = checkMs + 12 * 60 * 60_000;
    const overlays = resolveSleepChartOverlays({ bedtimeLogs: [log], windowStartMs: windowStart, windowEndMs: windowEnd });
    expect(overlays).toHaveLength(1);
    expect(overlays[0]?.kind).toBe("sleep");
    expect(overlays[0]?.startMs).toBe(checkMs + 60 * 60_000);
  });

  it("resolves exercise windows from outcomes", () => {
    const completedAt = "2026-07-09T10:00:00.000Z";
    const outcome: ExerciseOutcome = {
      id: "e1",
      exerciseType: "cardio",
      intensity: "moderate",
      durationMinutes: 45,
      exerciseName: "Morning run",
      feltHypo: false,
      completedAt,
    };
    const endMs = new Date(completedAt).getTime();
    const overlays = resolveExerciseChartOverlays({
      outcomes: [outcome],
      activeSession: null,
      windowStartMs: endMs - 3 * 60 * 60_000,
      windowEndMs: endMs + 60_000,
    });
    expect(overlays).toHaveLength(1);
    expect(overlays[0]?.label).toBe("Morning run");
    expect(overlays[0]?.endMs).toBe(endMs);
    expect(overlays[0]?.startMs).toBe(endMs - 45 * 60_000);
  });
});

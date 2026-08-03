import { describe, expect, it } from "vitest";
import {
  analyzeBedtimeOvernight,
  computeOvernightStats,
  entriesToOvernightReadings,
  filterEntriesToSleepWindow,
} from "./bedtime-overnight-analysis";
import { computeBedtimeSleepWindow, findReviewableBedtimeLog, resolveOvernightReviewTarget, findMorningHomeBedtimeLog, isBedtimeMorningHomeWindow, bedtimeReadinessLabel } from "./bedtime-overnight-window";
import type { BedtimeLog } from "@/lib/storage";

function makeLog(overrides: Partial<BedtimeLog> = {}): BedtimeLog {
  return {
    id: "log-1",
    date: "2026-07-08T22:00:00.000Z",
    currentBg: 7.2,
    bgUnits: "mmol/L",
    readinessLevel: "monitor",
    hoursSinceFood: 3,
    hoursSinceInsulin: 2,
    hoursUntilSleep: 1,
    exercisedToday: true,
    hadAlcohol: false,
    sickDayActive: false,
    travelModeActive: false,
    correctionGiven: null,
    notes: "",
    ...overrides,
  };
}

describe("bedtime overnight window", () => {
  it("estimates sleep start from check time plus sleep-in offset", () => {
    const window = computeBedtimeSleepWindow(makeLog());
    expect(window).not.toBeNull();
    expect(window!.hoursUntilSleep).toBe(1);
    expect(window!.endMs - window!.startMs).toBe(8 * 60 * 60 * 1000);
  });

  it("finds the latest log with a completed sleep window", () => {
    const now = new Date("2026-07-09T10:00:00.000Z").getTime();
    const logs = [
      makeLog({ id: "old", date: "2026-07-07T22:00:00.000Z", hoursUntilSleep: 1 }),
      makeLog({ id: "last-night", date: "2026-07-08T22:00:00.000Z", hoursUntilSleep: 1 }),
    ];
    expect(findReviewableBedtimeLog(logs, now)?.id).toBe("last-night");
  });

  it("uses calendar fallback when no completed bedtime log exists", () => {
    const now = new Date("2026-07-09T10:00:00.000Z").getTime();
    const target = resolveOvernightReviewTarget([], now);
    expect(target).not.toBeNull();
    expect(target!.source).toBe("calendar_fallback");
    expect(target!.window.endMs).toBeLessThanOrEqual(now);
  });
});

describe("morning home bedtime score", () => {
  function localMs(year: number, month: number, day: number, hour: number, minute = 0): number {
    return new Date(year, month - 1, day, hour, minute, 0, 0).getTime();
  }

  it("is only in the morning window (6–11 local)", () => {
    expect(isBedtimeMorningHomeWindow(localMs(2026, 7, 9, 5, 59))).toBe(false);
    expect(isBedtimeMorningHomeWindow(localMs(2026, 7, 9, 6))).toBe(true);
    expect(isBedtimeMorningHomeWindow(localMs(2026, 7, 9, 11, 59))).toBe(true);
    expect(isBedtimeMorningHomeWindow(localMs(2026, 7, 9, 12))).toBe(false);
  });

  it("surfaces last night's readiness during morning when the sleep window has ended", () => {
    const morning = localMs(2026, 7, 9, 8, 30);
    // Check at 22:00 previous evening, sleep immediately → ends 06:00 (default 8h)
    const checkAt = new Date(2026, 6, 8, 22, 0, 0, 0).toISOString();
    const logs = [makeLog({ id: "last-night", date: checkAt, hoursUntilSleep: 0, readinessLevel: "steady" })];
    expect(findMorningHomeBedtimeLog(logs, morning)?.id).toBe("last-night");
  });

  it("hides the score after noon even if last night is still fresh", () => {
    const afternoon = localMs(2026, 7, 9, 12, 5);
    const checkAt = new Date(2026, 6, 8, 22, 0, 0, 0).toISOString();
    const logs = [makeLog({ id: "last-night", date: checkAt, hoursUntilSleep: 0 })];
    expect(findMorningHomeBedtimeLog(logs, afternoon)).toBeNull();
  });

  it("ignores stale nights that ended more than 18 hours ago", () => {
    const morning = localMs(2026, 7, 11, 9);
    const checkAt = new Date(2026, 6, 8, 22, 0, 0, 0).toISOString();
    const logs = [makeLog({ id: "old-night", date: checkAt, hoursUntilSleep: 0 })];
    expect(findMorningHomeBedtimeLog(logs, morning)).toBeNull();
  });

  it("labels readiness levels for the home card", () => {
    expect(bedtimeReadinessLabel("steady")).toBe("Steady");
    expect(bedtimeReadinessLabel("monitor")).toBe("Monitor");
    expect(bedtimeReadinessLabel("alert")).toBe("Alert");
  });
});

describe("bedtime overnight analysis", () => {
  it("flags overnight low and links exercise from the log", () => {
    const log = makeLog({ exercisedToday: true });
    const window = computeBedtimeSleepWindow(log)!;
    const entries = [
      { valueMgDl: 126, recordedAt: new Date(window.startMs + 2 * 60 * 60 * 1000).toISOString(), trend: "flat" as const },
      { valueMgDl: 61, recordedAt: new Date(window.startMs + 5 * 60 * 60 * 1000).toISOString(), trend: "flat" as const },
    ];
    const filtered = filterEntriesToSleepWindow(entries, window);
    const readings = entriesToOvernightReadings(filtered, "mmol/L");
    const stats = computeOvernightStats(readings, 4, 10)!;
    const insight = analyzeBedtimeOvernight(log, readings, window, 4, 10)!;

    expect(stats.hadLow).toBe(true);
    expect(insight.headline).toMatch(/low/i);
    expect(insight.explanations.some((l) => /exercise/i.test(l))).toBe(true);
  });

  it("computes time in range against user targets, not overnight extrema", () => {
    const readings = [
      { timeMs: 1, recordedAt: new Date(1).toISOString(), value: 8, units: "mmol/L" as const },
      { timeMs: 2, recordedAt: new Date(2).toISOString(), value: 9, units: "mmol/L" as const },
      { timeMs: 3, recordedAt: new Date(3).toISOString(), value: 11, units: "mmol/L" as const },
      { timeMs: 4, recordedAt: new Date(4).toISOString(), value: 13.9, units: "mmol/L" as const },
    ];
    const stats = computeOvernightStats(readings, 4, 10)!;
    expect(stats.inRangePercent).toBe(50);
    expect(stats.hadHigh).toBe(true);
    expect(stats.min).toBe(8);
    expect(stats.max).toBe(13.9);
  });

  it("uses a nuanced headline when part of the night was in range before rising", () => {
    const log = makeLog();
    const window = computeBedtimeSleepWindow(log)!;
    const readings = Array.from({ length: 10 }, (_, i) => ({
      timeMs: window.startMs + i * 60 * 60 * 1000,
      recordedAt: new Date(window.startMs + i * 60 * 60 * 1000).toISOString(),
      value: 8 + i * 0.7,
      units: "mmol/L" as const,
    }));
    const insight = analyzeBedtimeOvernight(log, readings, window, 4, 10)!;
    expect(insight.headline).toMatch(/rose above target/i);
    expect(insight.summary).toContain("4–10");
    expect(insight.considerations.length).toBeGreaterThan(0);
  });

  it("says fully in range when every reading was in target — not mostly", () => {
    const window = computeBedtimeSleepWindow(makeLog())!;
    const readings = [
      { timeMs: window.startMs, recordedAt: new Date(window.startMs).toISOString(), value: 7.4, units: "mmol/L" as const },
      {
        timeMs: window.startMs + 4 * 3600_000,
        recordedAt: new Date(window.startMs + 4 * 3600_000).toISOString(),
        value: 8.2,
        units: "mmol/L" as const,
      },
      {
        timeMs: window.endMs,
        recordedAt: new Date(window.endMs).toISOString(),
        value: 7.9,
        units: "mmol/L" as const,
      },
    ];
    const insight = analyzeBedtimeOvernight(null, readings, window, 4, 10)!;
    expect(insight.stats.inRangePercent).toBe(100);
    expect(insight.headline).toBe("In range overnight");
    expect(insight.summary).toMatch(/every reading stayed within/i);
    expect(insight.headline).not.toMatch(/mostly/i);
  });

  it("mentions overnight rise when in range but climbing toward morning", () => {
    const window = computeBedtimeSleepWindow(makeLog())!;
    const readings = Array.from({ length: 8 }, (_, i) => ({
      timeMs: window.startMs + i * 60 * 60 * 1000,
      recordedAt: new Date(window.startMs + i * 60 * 60 * 1000).toISOString(),
      value: 6 + i * 0.4,
      units: "mmol/L" as const,
    }));
    const insight = analyzeBedtimeOvernight(null, readings, window, 4, 10)!;
    expect(insight.stats.hadHigh).toBe(false);
    expect(insight.headline).toMatch(/rising/i);
    expect(insight.considerations.some((c) => /dawn|morning|target/i.test(c))).toBe(true);
  });
});

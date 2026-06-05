import { addDays, format, startOfDay } from "date-fns";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  computeStreakStats,
  qualifyingBalancedDayKeys,
  qualifyingDayKeysForKind,
} from "./activity-streaks";
import { collectAllActivityEvents } from "./activity-history";
import { setActiveUserIdForLocalStorage, storage } from "./storage";

function saveBedtime(date: string, id: string): void {
  storage.saveBedtimeLog({
    id,
    date,
    currentBg: 6,
    bgUnits: "mmol/L",
    readinessLevel: "steady",
    hoursSinceFood: null,
    hoursSinceInsulin: null,
  });
}

describe("activity-streaks", () => {
  beforeEach(() => {
    localStorage.clear();
    setActiveUserIdForLocalStorage("test-user");
    vi.restoreAllMocks();
  });

  it("qualifyingDayKeysForKind deduplicates multiple events on same day", () => {
    saveBedtime("2025-06-10T12:00:00", "b1");
    const events = collectAllActivityEvents();
    const keys = qualifyingDayKeysForKind(events, "bedtime_check");
    expect(keys.size).toBe(1);
    expect(keys.has("2025-06-10")).toBe(true);
  });

  it("computeStreakStats counts current consecutive days including today", () => {
    saveBedtime("2025-06-10T12:00:00", "b0");
    saveBedtime("2025-06-09T12:00:00", "b1");
    saveBedtime("2025-06-08T12:00:00", "b2");

    const events = collectAllActivityEvents();
    const stats = computeStreakStats(events, "bedtime_check", new Date("2025-06-10T12:00:00"));
    expect(stats.current).toBe(3);
    expect(stats.best).toBe(3);
  });

  it("current streak resets when yesterday is missed", () => {
    saveBedtime("2025-06-10T12:00:00", "b-today");
    saveBedtime("2025-06-08T12:00:00", "b-old");

    const events = collectAllActivityEvents();
    const stats = computeStreakStats(events, "bedtime_check", new Date("2025-06-10T12:00:00"));
    expect(stats.current).toBe(1);
    expect(stats.best).toBe(1);
  });

  it("qualifyingBalancedDayKeys requires bedtime and exercise same day", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-06-10T15:00:00.000Z"));
    saveBedtime("2025-06-10T12:00:00", "b1");
    storage.addExerciseOutcome({
      exerciseName: "Walk",
      exerciseType: "cardio",
      intensity: "moderate",
      durationMinutes: 30,
    });

    const events = collectAllActivityEvents();
    const balanced = qualifyingBalancedDayKeys(events);
    expect(balanced.has("2025-06-10")).toBe(true);
    vi.useRealTimers();
  });

  it("counts yesterday-only streak when today has no activity yet", () => {
    saveBedtime(format(addDays(startOfDay(new Date("2025-06-10T12:00:00")), -1), "yyyy-MM-dd'T'12:00:00"), "b1");
    saveBedtime(format(addDays(startOfDay(new Date("2025-06-10T12:00:00")), -2), "yyyy-MM-dd'T'12:00:00"), "b2");

    const events = collectAllActivityEvents();
    const stats = computeStreakStats(events, "bedtime_check", new Date("2025-06-10T12:00:00"));
    expect(stats.current).toBe(2);
  });
});

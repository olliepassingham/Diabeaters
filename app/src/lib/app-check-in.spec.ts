import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { evaluateNewlyUnlockedAchievements } from "./achievements";
import { computeStreakStats } from "./activity-streaks";
import { collectAllActivityEvents } from "./activity-history";
import { setActiveUserIdForLocalStorage, storage } from "./storage";

describe("app daily check-in", () => {
  beforeEach(() => {
    localStorage.clear();
    setActiveUserIdForLocalStorage("test-user");
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-06-10T15:00:00.000Z"));
    storage.saveProfile({
      name: "Test",
      bgUnits: "mmol/L",
    } as Parameters<typeof storage.saveProfile>[0]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not record before onboarding is complete", () => {
    localStorage.removeItem("diabeater_onboarding_completed");
    expect(storage.recordAppDailyCheckIn()).toBe(false);
    expect(storage.getAppCheckInDayKeys()).toEqual([]);
  });

  it("records at most one key per calendar day", () => {
    expect(storage.recordAppDailyCheckIn()).toBe(true);
    expect(storage.recordAppDailyCheckIn()).toBe(false);
    expect(storage.getAppCheckInDayKeys()).toEqual(["2025-06-10"]);
  });

  it("builds a consecutive-day streak across days", () => {
    storage.recordAppDailyCheckIn();
    vi.setSystemTime(new Date("2025-06-11T10:00:00.000Z"));
    storage.recordAppDailyCheckIn();

    const events = collectAllActivityEvents();
    const stats = computeStreakStats(events, "app_check_in", new Date("2025-06-11T12:00:00"));
    expect(stats.current).toBe(2);
  });

  it("unlocks showing up 3-day achievement", () => {
    for (const day of ["2025-06-10", "2025-06-09", "2025-06-08"]) {
      vi.setSystemTime(new Date(`${day}T12:00:00.000Z`));
      storage.recordAppDailyCheckIn();
    }

    const events = collectAllActivityEvents();
    const unlocked = evaluateNewlyUnlockedAchievements(events, new Set(), new Date("2025-06-10T12:00:00"));
    expect(unlocked).toContain("app_check_in_streak_3");
  });
});

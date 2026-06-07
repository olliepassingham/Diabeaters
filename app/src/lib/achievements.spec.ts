import { beforeEach, describe, expect, it, vi } from "vitest";

import { evaluateNewlyUnlockedAchievements } from "./achievements";
import { collectAllActivityEvents } from "./activity-history";
import {
  loadEarnedAchievements,
  loadPinnedStreakKinds,
  savePinnedStreakKinds,
  syncAchievementsFromActivity,
} from "./user-achievements";
import { setActiveUserIdForLocalStorage, storage } from "./storage";

function saveThreeBedtimeDays(): void {
  for (const [id, date] of [
    ["b1", "2025-06-10T12:00:00"],
    ["b2", "2025-06-09T12:00:00"],
    ["b3", "2025-06-08T12:00:00"],
  ] as const) {
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
}

describe("achievements", () => {
  beforeEach(() => {
    localStorage.clear();
    setActiveUserIdForLocalStorage("test-user");
    vi.useRealTimers();
  });

  it("unlocks bedtime 3-day achievement after three consecutive days", () => {
    saveThreeBedtimeDays();
    const events = collectAllActivityEvents();
    const unlocked = evaluateNewlyUnlockedAchievements(events, new Set(), new Date("2025-06-10T12:00:00"));
    expect(unlocked).toContain("bedtime_streak_3");
  });

  it("syncAchievementsFromActivity persists earned achievements locally", () => {
    saveThreeBedtimeDays();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-06-10T12:00:00"));
    const newly = syncAchievementsFromActivity();
    vi.useRealTimers();

    expect(newly).toContain("bedtime_streak_3");
    expect(loadEarnedAchievements().map((a) => a.id)).toContain("bedtime_streak_3");
  });

  it("savePinnedStreakKinds only keeps earned streak kinds up to max", () => {
    saveThreeBedtimeDays();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-06-10T12:00:00"));
    syncAchievementsFromActivity();
    vi.useRealTimers();

    savePinnedStreakKinds(["bedtime_check", "exercise_session"]);
    expect(loadPinnedStreakKinds()).toEqual(["bedtime_check"]);
  });
});

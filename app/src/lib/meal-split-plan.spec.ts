import { describe, expect, it, vi } from "vitest";

import {
  computeMealSplitPlanFromCarbs,
  computeMealSplitPlanFromDose,
  splitSecondDoseClockLabel,
} from "@/lib/meal-split-plan";
import type { UserSettings } from "@/lib/storage";

const settingsWithDinner: UserSettings = {
  dinnerRatio: "10",
};

describe("computeMealSplitPlanFromDose", () => {
  it("splits the same dose the meal planner already suggested", () => {
    const plan = computeMealSplitPlanFromDose({
      exactDose: 12,
      carbsGrams: 110,
      mealTime: "dinner",
      fatTier: "high",
      roundIncrement: 1,
    });
    expect(plan).toMatchObject({
      totalUnits: 12,
      firstDose: 6,
      secondDose: 6,
      secondDoseDelay: 3,
      splitRatio: "50/50",
      carbsGrams: 110,
    });
  });
});

describe("computeMealSplitPlanFromCarbs", () => {
  it("uses the meal ratio then splits for the fat tier", () => {
    const result = computeMealSplitPlanFromCarbs({
      carbsGrams: 80,
      mealTime: "dinner",
      fatTier: "medium",
      settings: settingsWithDinner,
      ratioFormat: "per10g",
      roundIncrement: 1,
    });
    expect(result).toEqual({
      plan: expect.objectContaining({
        totalUnits: 8,
        firstDose: 5,
        secondDose: 3,
        secondDoseDelay: 2,
        splitRatio: "60/40",
      }),
    });
  });

  it("rejects missing carbs", () => {
    expect(
      computeMealSplitPlanFromCarbs({
        carbsGrams: 0,
        mealTime: "dinner",
        fatTier: "high",
        settings: settingsWithDinner,
        ratioFormat: "per10g",
        roundIncrement: 1,
      }),
    ).toEqual({ error: "invalid_carbs" });
  });
});

describe("splitSecondDoseClockLabel", () => {
  it("returns the local clock time for the second dose", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-03T17:42:00"));
    expect(splitSecondDoseClockLabel(3)).toBe("20:42");
    vi.useRealTimers();
  });
});

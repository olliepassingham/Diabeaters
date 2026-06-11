import { describe, expect, it } from "vitest";
import {
  getExerciseGuidanceForReading,
  shouldSuggestPreExerciseMealCarbs,
  shouldSuggestPreExerciseMealInsulin,
} from "./exercise-reading-guidance";

describe("getExerciseGuidanceForReading", () => {
  it("returns treat-low-first when BG low", () => {
    const tips = getExerciseGuidanceForReading({
      bg: 4.2,
      trend: "flat",
      bgUnits: "mmol/L",
      exerciseType: "cardio",
      intensity: "moderate",
      phase: "pre",
    });
    expect(tips.some((t) => t.toLowerCase().includes("below"))).toBe(true);
  });

  it("warns on falling trend during cardio", () => {
    const tips = getExerciseGuidanceForReading({
      bg: 7,
      trend: "falling",
      bgUnits: "mmol/L",
      exerciseType: "cardio",
      intensity: "moderate",
      phase: "pre",
    });
    expect(tips.some((t) => t.toLowerCase().includes("trend is down"))).toBe(true);
  });

  it("returns empty when no BG", () => {
    expect(
      getExerciseGuidanceForReading({
        bgUnits: "mmol/L",
        exerciseType: "yoga",
        intensity: "light",
        phase: "pre",
      }),
    ).toEqual([]);
  });

  it("shouldSuggestPreExerciseMealCarbs skips when in range and fed", () => {
    const r = shouldSuggestPreExerciseMealCarbs({
      currentBg: 8,
      bgTrend: "flat",
      bgUnits: "mmol/L",
      fasted: false,
      bufferGrams: 20,
    });
    expect(r.suggest).toBe(false);
    expect(r.skipReason).toBe("in_range_fed");
  });

  it("shouldSuggestPreExerciseMealInsulin requires BG", () => {
    const r = shouldSuggestPreExerciseMealInsulin({
      bgUnits: "mmol/L",
      mealCarbsIsSuggested: true,
      mealCarbsGrams: 25,
    });
    expect(r.suggest).toBe(false);
    expect(r.suppressedReason).toBe("bg_missing");
  });

  it("shouldSuggestPreExerciseMealInsulin suppresses when falling", () => {
    const r = shouldSuggestPreExerciseMealInsulin({
      currentBg: 8.5,
      bgTrend: "falling",
      bgUnits: "mmol/L",
      mealCarbsIsSuggested: false,
      mealCarbsGrams: 50,
    });
    expect(r.suggest).toBe(false);
    expect(r.suppressedReason).toBe("falling");
  });

  it("uses post-workout framing in recovery when BG in range", () => {
    const tips = getExerciseGuidanceForReading({
      bg: 7,
      trend: "flat",
      bgUnits: "mmol/L",
      exerciseType: "cardio",
      intensity: "moderate",
      phase: "recovery",
    });
    expect(tips.some((t) => t.toLowerCase().includes("pre-exercise"))).toBe(false);
    expect(tips.some((t) => t.toLowerCase().includes("after exercise"))).toBe(true);
  });
});

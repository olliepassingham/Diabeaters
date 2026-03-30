import { describe, expect, it } from "vitest";
import { getExerciseGuidanceForReading } from "./exercise-reading-guidance";

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
});

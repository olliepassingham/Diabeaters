import { describe, expect, it } from "vitest";

import { computeExerciseFuelPlan } from "./exercise-fuel-calculator";
import type { UserSettings } from "./storage";

const settings: UserSettings = {
  snackRatio: "15",
  lunchRatio: "10",
  tdd: 50,
};

describe("computeExerciseFuelPlan", () => {
  it("returns insulin units when meal carbs and ratios are provided", () => {
    const r = computeExerciseFuelPlan({
      exerciseType: "cardio",
      intensity: "moderate",
      durationMinutes: 45,
      minutesUntilStart: 30,
      fasted: false,
      mealCarbsGrams: 50,
      mealType: "snack",
      bgUnits: "mmol/L",
      settings,
      isPump: false,
    });
    expect(r.insulin).not.toBeNull();
    expect(r.insulin!.adjustedUnits).toBeGreaterThan(0);
    expect(r.insulin!.reductionPercent).toBeGreaterThan(0);
    expect(r.headline).toContain("50g");
    expect(r.headline).not.toContain("→");
    expect(r.headline).not.toContain("usual");
  });

  it("suggests meal carbs when none entered", () => {
    const r = computeExerciseFuelPlan({
      exerciseType: "cardio",
      intensity: "moderate",
      durationMinutes: 45,
      minutesUntilStart: 30,
      fasted: true,
      mealType: "snack",
      bgUnits: "mmol/L",
      settings,
      isPump: false,
    });
    expect(r.mealCarbsIsSuggested).toBe(true);
    expect(r.mealCarbs).toBeGreaterThan(0);
  });

  it("adds note when rapid insulin was recent", () => {
    const r = computeExerciseFuelPlan({
      exerciseType: "hiit",
      intensity: "intense",
      durationMinutes: 30,
      minutesUntilStart: 15,
      fasted: false,
      mealCarbsGrams: 40,
      mealType: "lunch",
      rapidInsulinLast2h: true,
      bgUnits: "mmol/L",
      settings,
      isPump: false,
    });
    expect(r.notes.some((n) => n.includes("Rapid insulin"))).toBe(true);
  });
});

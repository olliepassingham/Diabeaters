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

  it("suppresses meal insulin at 5.5 mmol/L with suggested carbs (moderate strength 45 min)", () => {
    const r = computeExerciseFuelPlan({
      exerciseType: "strength",
      intensity: "moderate",
      durationMinutes: 45,
      minutesUntilStart: 0,
      fasted: false,
      mealType: "snack",
      currentBg: 5.5,
      bgTrend: "flat",
      bgUnits: "mmol/L",
      settings,
      isPump: false,
    });
    expect(r.mealCarbs).toBeGreaterThan(0);
    expect(r.mealCarbsIsSuggested).toBe(true);
    expect(r.insulin).toBeNull();
    expect(r.insulinSuppressedReason).toBe("low_bg");
    expect(r.headline).toContain("no meal insulin");
    expect(r.notes.some((n) => n.toLowerCase().includes("meal insulin") || n.toLowerCase().includes("exercise-start"))).toBe(
      true,
    );
  });

  it("still shows meal insulin at 8.0 mmol/L with suggested carbs", () => {
    const r = computeExerciseFuelPlan({
      exerciseType: "cardio",
      intensity: "moderate",
      durationMinutes: 45,
      minutesUntilStart: 30,
      fasted: false,
      mealType: "snack",
      currentBg: 8,
      bgTrend: "flat",
      bgUnits: "mmol/L",
      settings,
      isPump: false,
    });
    expect(r.mealCarbsIsSuggested).toBe(true);
    expect(r.insulin).not.toBeNull();
    expect(r.insulinSuppressedReason).toBeNull();
  });

  it("suppresses insulin at 6.5 mmol/L when carbs are suggested (below ideal 7)", () => {
    const r = computeExerciseFuelPlan({
      exerciseType: "cardio",
      intensity: "moderate",
      durationMinutes: 45,
      minutesUntilStart: 30,
      fasted: false,
      mealType: "snack",
      currentBg: 6.5,
      bgUnits: "mmol/L",
      settings,
      isPump: false,
    });
    expect(r.insulin).toBeNull();
    expect(r.insulinSuppressedReason).toBe("below_target");
  });

  it("suppresses insulin at 5.5 mmol/L even when user enters 50g carbs", () => {
    const r = computeExerciseFuelPlan({
      exerciseType: "strength",
      intensity: "moderate",
      durationMinutes: 45,
      minutesUntilStart: 0,
      fasted: false,
      mealCarbsGrams: 50,
      mealType: "snack",
      currentBg: 5.5,
      bgTrend: "flat",
      bgUnits: "mmol/L",
      settings,
      isPump: false,
    });
    expect(r.insulin).toBeNull();
    expect(r.insulinSuppressedReason).toBe("low_bg");
  });
});

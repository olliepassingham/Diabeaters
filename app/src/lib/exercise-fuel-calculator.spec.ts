import { describe, expect, it } from "vitest";

import { computeExerciseFuelPlan } from "./exercise-fuel-calculator";
import type { UserSettings } from "./storage";

const settings: UserSettings = {
  snackRatio: "15",
  lunchRatio: "10",
  tdd: 50,
  correctionFactor: 2,
};

describe("computeExerciseFuelPlan", () => {
  it("returns insulin units when meal carbs, ratios, and BG are provided", () => {
    const r = computeExerciseFuelPlan({
      exerciseType: "cardio",
      intensity: "moderate",
      durationMinutes: 45,
      minutesUntilStart: 30,
      fasted: false,
      mealCarbsGrams: 50,
      mealType: "snack",
      currentBg: 8.5,
      bgTrend: "flat",
      bgUnits: "mmol/L",
      settings,
      isPump: false,
    });
    expect(r.insulin).not.toBeNull();
    expect(r.insulin!.adjustedUnits).toBeGreaterThan(0);
    expect(r.insulin!.totalUnits).toBeGreaterThan(0);
    expect(r.userEnteredMealCarbs).toBe(true);
    expect(r.breakdown.standardUnits).toBeGreaterThan(0);
    expect(r.headline).toContain("units");
  });

  it("does not show insulin without a BG reading even when meal carbs are entered", () => {
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
    expect(r.insulin).toBeNull();
    expect(r.insulinSuppressedReason).toBe("bg_missing");
  });

  it("suggests meal carbs when fasted and none entered", () => {
    const r = computeExerciseFuelPlan({
      exerciseType: "cardio",
      intensity: "moderate",
      durationMinutes: 45,
      minutesUntilStart: 30,
      fasted: true,
      mealType: "snack",
      currentBg: 8,
      bgTrend: "flat",
      bgUnits: "mmol/L",
      settings,
      isPump: false,
    });
    expect(r.mealCarbsIsSuggested).toBe(true);
    expect(r.mealCarbs).toBeGreaterThan(0);
  });

  it("does not suggest pre-meal carbs when BG is in range and not fasted", () => {
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
    expect(r.mealCarbs).toBe(0);
    expect(r.mealCarbsSkipReason).toBe("in_range_fed");
    expect(r.onHandCarbs).toBeGreaterThan(0);
    expect(r.insulin).toBeNull();
  });

  it("scales intense pre buffer with duration", () => {
    const short = computeExerciseFuelPlan({
      exerciseType: "court",
      intensity: "intense",
      durationMinutes: 25,
      minutesUntilStart: 45,
      fasted: true,
      mealType: "snack",
      currentBg: 6.5,
      bgUnits: "mmol/L",
      settings,
      isPump: false,
    });
    const long = computeExerciseFuelPlan({
      exerciseType: "court",
      intensity: "intense",
      durationMinutes: 120,
      minutesUntilStart: 45,
      fasted: true,
      mealType: "snack",
      currentBg: 6.5,
      bgUnits: "mmol/L",
      settings,
      isPump: false,
    });
    expect(short.breakdown.preBufferGrams).toBe(15);
    expect(long.breakdown.preBufferGrams).toBe(30);
    expect(long.breakdown.duringGrams).toBe(90);
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
      currentBg: 8.5,
      bgTrend: "flat",
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
      fasted: true,
      mealType: "snack",
      currentBg: 5.5,
      bgTrend: "flat",
      bgUnits: "mmol/L",
      settings,
      isPump: false,
    });
    expect(r.mealCarbs).toBeGreaterThan(0);
    expect(r.insulin).toBeNull();
    expect(r.insulinSuppressedReason).toBe("low_bg");
  });

  it("suppresses insulin at 6.5 mmol/L when carbs are suggested (below ideal 7)", () => {
    const r = computeExerciseFuelPlan({
      exerciseType: "cardio",
      intensity: "moderate",
      durationMinutes: 45,
      minutesUntilStart: 30,
      fasted: true,
      mealType: "snack",
      currentBg: 6.5,
      bgUnits: "mmol/L",
      settings,
      isPump: false,
    });
    expect(r.mealCarbs).toBeGreaterThan(0);
    expect(r.insulin).toBeNull();
    expect(r.insulinSuppressedReason).toBe("below_target");
  });

  it("suppresses insulin when BG trend is falling in suggest mode", () => {
    const r = computeExerciseFuelPlan({
      exerciseType: "cardio",
      intensity: "moderate",
      durationMinutes: 45,
      minutesUntilStart: 30,
      fasted: false,
      mealCarbsGrams: 40,
      mealType: "snack",
      currentBg: 8.5,
      bgTrend: "falling",
      bgUnits: "mmol/L",
      settings,
      isPump: false,
    });
    expect(r.userEnteredMealCarbs).toBe(true);
    expect(r.insulin).not.toBeNull();
    expect(r.insulin!.totalUnits).toBeGreaterThan(0);
    expect(r.insulinSuppressedReason).toBe("falling");
  });

  it("calculates insulin at low BG when user entered pre-exercise carbs", () => {
    const r = computeExerciseFuelPlan({
      exerciseType: "strength",
      intensity: "moderate",
      durationMinutes: 45,
      minutesUntilStart: 30,
      fasted: false,
      mealCarbsGrams: 48,
      mealType: "snack",
      currentBg: 5.5,
      bgTrend: "flat",
      bgUnits: "mmol/L",
      settings,
      isPump: false,
    });
    expect(r.insulin).not.toBeNull();
    expect(r.insulin!.totalUnits).toBeGreaterThan(0);
    expect(r.projection).not.toBeNull();
    expect(r.projection!.projectedBgAtStart).not.toBeNull();
    expect(r.projection!.projectedBgAtStart!).toBeGreaterThanOrEqual(7);
    expect(r.projection!.projectedBgAtStart!).toBeLessThanOrEqual(10);
    expect(r.exerciseEffectNote).toContain("Strength");
    expect(r.userEnteredMealCarbs).toBe(true);
    expect(r.projectedInsulinAtTarget).toBeNull();
  });

  it("adds correction units when BG is above pre-exercise target band", () => {
    const r = computeExerciseFuelPlan({
      exerciseType: "strength",
      intensity: "moderate",
      durationMinutes: 45,
      minutesUntilStart: 30,
      fasted: false,
      mealCarbsGrams: 50,
      mealType: "snack",
      currentBg: 12,
      bgTrend: "flat",
      bgUnits: "mmol/L",
      settings,
      isPump: false,
    });
    expect(r.insulin).not.toBeNull();
    expect(r.insulin!.correctionUnits).toBeGreaterThan(0);
    expect(r.insulin!.totalUnits).toBeGreaterThan(r.insulin!.adjustedUnits);
  });

  it("computes session fuel from exercise type, intensity, and duration for known carbs", () => {
    const r = computeExerciseFuelPlan({
      exerciseType: "strength",
      intensity: "moderate",
      durationMinutes: 45,
      minutesUntilStart: 30,
      fasted: false,
      mealCarbsGrams: 70,
      mealType: "lunch",
      currentBg: 5.5,
      bgTrend: "flat",
      bgUnits: "mmol/L",
      settings,
      isPump: false,
    });
    expect(r.userEnteredMealCarbs).toBe(true);
    expect(r.sessionFuel.duringTotalGrams).toBeGreaterThan(0);
    expect(r.sessionFuel.carryGrams).toBeGreaterThan(0);
    expect(r.onHandCarbs).toBe(r.sessionFuel.carryGrams);
    expect(r.duringCarbs).toBe(r.sessionFuel.duringTotalGrams);
  });

  it("includes interval dosing for cardio sessions over 30 min", () => {
    const r = computeExerciseFuelPlan({
      exerciseType: "cardio",
      intensity: "moderate",
      durationMinutes: 45,
      minutesUntilStart: 30,
      fasted: false,
      mealCarbsGrams: 40,
      mealType: "snack",
      currentBg: 8.5,
      bgTrend: "flat",
      bgUnits: "mmol/L",
      settings,
      isPump: false,
    });
    expect(r.sessionFuel.doseGrams).toBe(20);
    expect(r.sessionFuel.intervalMinutes).toBe(30);
    expect(r.sessionFuel.carryGrams).toBeGreaterThanOrEqual(40);
  });
});

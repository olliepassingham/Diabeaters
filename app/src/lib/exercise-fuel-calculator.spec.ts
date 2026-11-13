import { describe, expect, it } from "vitest";

import {
  buildExerciseFuelActionLines,
  buildExerciseFuelSummary,
  computeExerciseFuelPlan,
  exerciseFuelInputFromSession,
} from "./exercise-fuel-calculator";
import type { UserSettings } from "./storage";

const settings: UserSettings = {
  snackRatio: "15",
  lunchRatio: "10",
  tdd: 50,
  correctionFactor: 2,
};

describe("computeExerciseFuelPlan", () => {
  it("says a short max effort can raise glucose and uses the moderate insulin band", () => {
    const shared = {
      exerciseType: "cardio" as const,
      durationMinutes: 45,
      minutesUntilStart: 30,
      fasted: false,
      mealCarbsGrams: 50,
      mealType: "snack",
      currentBg: 8.5,
      bgTrend: "flat" as const,
      bgUnits: "mmol/L",
      settings,
      isPump: false,
    };
    const steady = computeExerciseFuelPlan({ ...shared, intensity: "intense" });
    const max = computeExerciseFuelPlan({ ...shared, intensity: "intense", effortShape: "max" });
    const moderate = computeExerciseFuelPlan({ ...shared, intensity: "moderate" });
    expect(max.bolusReductionBand).toBe(moderate.bolusReductionBand);
    expect(max.bolusReductionBand).not.toBe(steady.bolusReductionBand);
    expect(max.exerciseEffectNote).toMatch(/raise glucose/i);
    expect(max.notes.join(" ")).toMatch(/climb/i);
  });

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
    expect(short.breakdown.preBufferGrams).toBe(20);
    expect(long.breakdown.preBufferGrams).toBe(40);
    // Court sports carry a +10% "during" nudge on top of the capped 80g intensity/duration base.
    expect(long.breakdown.duringGrams).toBe(90);
    expect(long.breakdown.preBufferGrams).toBeGreaterThan(short.breakdown.preBufferGrams);
  });

  it("scales the low-BG carb top-up by exercise intensity (harder effort burns through BG faster)", () => {
    const build = (intensity: "light" | "moderate" | "intense") =>
      computeExerciseFuelPlan({
        exerciseType: "cardio",
        intensity,
        durationMinutes: 45,
        minutesUntilStart: 30,
        fasted: false,
        mealType: "snack",
        currentBg: 4.8,
        bgUnits: "mmol/L",
        settings,
        isPump: false,
        profile: { dateOfBirth: "1990-01-01", bodyWeightKg: 70 },
      });
    const light = build("light");
    const moderate = build("moderate");
    const intense = build("intense");
    expect(light.breakdown.lowBgCarbTopUpGrams ?? 0).toBeLessThanOrEqual(moderate.breakdown.lowBgCarbTopUpGrams ?? 0);
    expect(intense.breakdown.lowBgCarbTopUpGrams ?? 0).toBeGreaterThan(moderate.breakdown.lowBgCarbTopUpGrams ?? 0);
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
    expect(r.preCorrection).toBeNull();
  });

  it("offers a reduced correction when BG is elevated and no meal carbs are planned", () => {
    const r = computeExerciseFuelPlan({
      exerciseType: "cardio",
      intensity: "moderate",
      durationMinutes: 45,
      minutesUntilStart: 30,
      fasted: false,
      mealType: "snack",
      currentBg: 12.8,
      bgTrend: "flat",
      bgUnits: "mmol/L",
      settings,
      isPump: false,
    });
    expect(r.mealCarbs).toBe(0);
    expect(r.mealCarbsSkipReason).toBe("elevated_bg");
    expect(r.insulin).toBeNull();
    expect(r.preCorrection).not.toBeNull();
    expect(r.preCorrection!.severity).toBe("elevated");
    expect(r.preCorrection!.units).toBeGreaterThan(0);
    expect(r.preCorrection!.reductionPercent).toBeGreaterThan(0);
    expect(r.preCorrection!.units).toBeLessThanOrEqual(r.preCorrection!.fullUnitsBeforeReduction);
    expect(r.headline).toContain("Reduced correction");
    expect(r.notes.length).toBeLessThanOrEqual(2);
    expect(r.notes.some((n) => n.toLowerCase().includes("reduced correction"))).toBe(true);
  });

  it("marks very-high BG correction as secondary to ketones/fluids", () => {
    const r = computeExerciseFuelPlan({
      exerciseType: "cardio",
      intensity: "moderate",
      durationMinutes: 45,
      minutesUntilStart: 30,
      fasted: false,
      mealType: "snack",
      currentBg: 15,
      bgTrend: "flat",
      bgUnits: "mmol/L",
      settings,
      isPump: false,
    });
    expect(r.mealCarbsSkipReason).toBe("high_bg");
    expect(r.preCorrection).not.toBeNull();
    expect(r.preCorrection!.severity).toBe("very_high");
    expect(r.preCorrection!.units).toBeGreaterThan(0);
    expect(r.notes.some((n) => n.includes("ketones"))).toBe(true);
  });

  it("does not offer a standalone correction while BG is falling", () => {
    const r = computeExerciseFuelPlan({
      exerciseType: "cardio",
      intensity: "moderate",
      durationMinutes: 45,
      minutesUntilStart: 30,
      fasted: false,
      mealType: "snack",
      currentBg: 12.8,
      bgTrend: "falling",
      bgUnits: "mmol/L",
      settings,
      isPump: false,
    });
    expect(r.preCorrection).toBeNull();
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

  it("scales the suggested pre-exercise carbs with how low BG is, not just whether it's below the line", () => {
    const mild = computeExerciseFuelPlan({
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
      profile: { dateOfBirth: "1990-01-01" },
    });
    const low = computeExerciseFuelPlan({
      exerciseType: "cardio",
      intensity: "moderate",
      durationMinutes: 45,
      minutesUntilStart: 30,
      fasted: false,
      mealType: "snack",
      currentBg: 4.8,
      bgUnits: "mmol/L",
      settings,
      isPump: false,
      profile: { dateOfBirth: "1990-01-01" },
    });
    const veryLow = computeExerciseFuelPlan({
      exerciseType: "cardio",
      intensity: "moderate",
      durationMinutes: 45,
      minutesUntilStart: 30,
      fasted: false,
      mealType: "snack",
      currentBg: 3.2,
      bgUnits: "mmol/L",
      settings,
      isPump: false,
      profile: { dateOfBirth: "1990-01-01" },
    });

    // Same session (same baseline buffer) but progressively lower BG should suggest
    // progressively more carbs — not a single flat number for "anything below 7".
    expect(mild.breakdown.preBufferGrams).toBe(low.breakdown.preBufferGrams);
    expect(low.mealCarbs).toBeGreaterThan(mild.mealCarbs);
    expect(veryLow.mealCarbs).toBeGreaterThan(low.mealCarbs);
    expect(low.breakdown.lowBgCarbTopUpGrams).toBeGreaterThan(0);
    expect(veryLow.breakdown.lowBgCarbTopUpGrams).toBeGreaterThan(low.breakdown.lowBgCarbTopUpGrams ?? 0);
    expect(low.notes.some((n) => n.includes("Added ~"))).toBe(true);
  });

  it("does not add a low-BG top-up once BG reaches the ideal starting band", () => {
    const r = computeExerciseFuelPlan({
      exerciseType: "cardio",
      intensity: "moderate",
      durationMinutes: 45,
      minutesUntilStart: 30,
      fasted: true,
      mealType: "snack",
      currentBg: 8,
      bgUnits: "mmol/L",
      settings,
      isPump: false,
    });
    expect(r.breakdown.lowBgCarbTopUpGrams).toBeUndefined();
    expect(r.mealCarbs).toBe(r.breakdown.preBufferGrams);
  });

  it("scales the low-BG carb top-up by body weight when a profile weight is set", () => {
    const heavier = computeExerciseFuelPlan({
      exerciseType: "cardio",
      intensity: "moderate",
      durationMinutes: 45,
      minutesUntilStart: 30,
      fasted: false,
      mealType: "snack",
      currentBg: 4,
      bgUnits: "mmol/L",
      settings,
      isPump: false,
      profile: { dateOfBirth: "1990-01-01", bodyWeightKg: 100 },
    });
    const lighter = computeExerciseFuelPlan({
      exerciseType: "cardio",
      intensity: "moderate",
      durationMinutes: 45,
      minutesUntilStart: 30,
      fasted: false,
      mealType: "snack",
      currentBg: 4,
      bgUnits: "mmol/L",
      settings,
      isPump: false,
      profile: { dateOfBirth: "1990-01-01", bodyWeightKg: 45 },
    });
    // Lighter body weight is more sensitive to carbs, so needs less to reach the same target.
    expect((lighter.breakdown.lowBgCarbTopUpGrams ?? 0)).toBeLessThanOrEqual(heavier.breakdown.lowBgCarbTopUpGrams ?? 0);
  });

  it("falls back to a flat, conservative top-up for minors instead of a weight-based estimate", () => {
    const minor = computeExerciseFuelPlan({
      exerciseType: "cardio",
      intensity: "moderate",
      durationMinutes: 45,
      minutesUntilStart: 30,
      fasted: false,
      mealType: "snack",
      currentBg: 3.0,
      bgUnits: "mmol/L",
      settings,
      isPump: false,
      profile: { dateOfBirth: "2015-01-01" },
    });
    expect(minor.breakdown.lowBgCarbTopUpGrams).toBe(10);
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

  it("leaves out interval dosing for strength, matching the coach", () => {
    const r = computeExerciseFuelPlan({
      exerciseType: "strength",
      intensity: "moderate",
      durationMinutes: 45,
      minutesUntilStart: 30,
      fasted: false,
      currentBg: 8.5,
      bgTrend: "flat",
      bgUnits: "mmol/L",
      settings,
      isPump: false,
      preFuelIntent: "none",
    });
    expect(r.sessionFuel.doseGrams).toBeUndefined();
    expect(buildExerciseFuelSummary(r, "mmol/L", settings).carry.everyMinutes).toBeUndefined();
  });
});

describe("computeExerciseFuelPlan with a pre-fuel intent", () => {
  const base = {
    exerciseType: "cardio" as const,
    intensity: "moderate" as const,
    durationMinutes: 45,
    minutesUntilStart: 30,
    fasted: false,
    mealType: "snack",
    bgTrend: "flat" as const,
    bgUnits: "mmol/L",
    settings,
    isPump: false,
  };

  it("top_up never returns insulin, even when fasted with a large buffer", () => {
    for (const currentBg of [4.8, 6.5, 8, 12]) {
      const r = computeExerciseFuelPlan({ ...base, preFuelIntent: "top_up", fasted: true, currentBg, mealCarbsGrams: 60 });
      expect(r.insulin).toBeNull();
      expect(r.userEnteredMealCarbs).toBe(false);
    }
  });

  it("top_up sizes carbs when below the start range", () => {
    const r = computeExerciseFuelPlan({ ...base, preFuelIntent: "top_up", currentBg: 6.2 });
    expect(r.mealCarbs).toBeGreaterThan(0);
    expect(r.treatFirst).toBe(false);
    const s = buildExerciseFuelSummary(r, "mmol/L", settings);
    expect(s.eat).toEqual({ grams: r.mealCarbs, kind: "top_up" });
    expect(s.insulin.kind).toBe("none");
    expect(s.insulin.reason).toMatch(/no insulin for a top-up/i);
  });

  it("top_up in range returns 0g with a reason", () => {
    const r = computeExerciseFuelPlan({ ...base, preFuelIntent: "top_up", currentBg: 8 });
    expect(r.mealCarbs).toBe(0);
    expect(r.mealCarbsSkipReason).toBe("in_range_fed");
    const s = buildExerciseFuelSummary(r, "mmol/L", settings);
    expect(s.eat).toBeNull();
    expect(s.eatNote).toMatch(/already in the start range/i);
    expect(s.carry.grams).toBeGreaterThan(0);
  });

  it("meal returns a reduced bolus", () => {
    const r = computeExerciseFuelPlan({ ...base, preFuelIntent: "meal", mealCarbsGrams: 50, currentBg: 8.5 });
    expect(r.insulin).not.toBeNull();
    expect(r.insulin!.totalUnits).toBeGreaterThan(0);
    expect(r.insulin!.adjustedUnits).toBeLessThan(r.insulin!.standardUnits);
    const s = buildExerciseFuelSummary(r, "mmol/L", settings);
    expect(s.eat).toEqual({ grams: 50, kind: "meal" });
    expect(s.insulin.kind).toBe("meal_bolus");
    expect(s.insulin.units).toBe(r.insulin!.totalUnits);
    expect(s.insulin.reason).toMatch(/% less than your usual/);
    expect(s.why).toMatch(/when you start/);
  });

  it("meal at a hypo reading gives treat first and no insulin", () => {
    const r = computeExerciseFuelPlan({ ...base, preFuelIntent: "meal", mealCarbsGrams: 50, currentBg: 3.5 });
    expect(r.insulin).toBeNull();
    expect(r.treatFirst).toBe(true);
    expect(r.treatFirstReason).toBe("hypo");
    expect(r.treatFirstGrams).toBeGreaterThanOrEqual(15);
    const s = buildExerciseFuelSummary(r, "mmol/L", settings);
    expect(s.eat?.kind).toBe("treat_first");
    expect(s.insulin.kind).toBe("none");
    expect(s.why).toMatch(/hypo range/);
  });

  it("meal at a low-but-not-hypo reading keeps today's reduced dose", () => {
    const r = computeExerciseFuelPlan({ ...base, preFuelIntent: "meal", mealCarbsGrams: 48, currentBg: 5.5 });
    expect(r.treatFirst).toBe(false);
    expect(r.insulin).not.toBeNull();
  });

  it("none with high BG gives a correction only", () => {
    const r = computeExerciseFuelPlan({ ...base, preFuelIntent: "none", currentBg: 12.8 });
    expect(r.mealCarbs).toBe(0);
    expect(r.insulin).toBeNull();
    expect(r.preCorrection).not.toBeNull();
    const s = buildExerciseFuelSummary(r, "mmol/L", settings);
    expect(s.eat).toBeNull();
    expect(s.insulin.kind).toBe("correction");
    expect(s.insulin.units).toBe(r.preCorrection!.units);
  });

  it("none in range: nothing to eat, carry only", () => {
    const r = computeExerciseFuelPlan({ ...base, preFuelIntent: "none", currentBg: 8, fasted: true });
    expect(r.mealCarbs).toBe(0);
    const s = buildExerciseFuelSummary(r, "mmol/L", settings);
    expect(s.eat).toBeNull();
    expect(s.eatNote).toMatch(/Nothing to eat/);
    expect(s.insulin.units).toBe(0);
  });

  it("none still says treat first when BG is low", () => {
    const r = computeExerciseFuelPlan({ ...base, preFuelIntent: "none", currentBg: 4.9 });
    expect(r.treatFirst).toBe(true);
    expect(r.mealCarbs).toBeGreaterThan(0);
    const s = buildExerciseFuelSummary(r, "mmol/L", settings);
    expect(s.eat?.kind).toBe("treat_first");
    expect(s.insulin.units).toBe(0);
  });

  it("ignores entered carbs unless the intent is meal", () => {
    const r = computeExerciseFuelPlan({ ...base, preFuelIntent: "none", mealCarbsGrams: 60, currentBg: 8 });
    expect(r.mealCarbs).toBe(0);
    expect(r.insulin).toBeNull();
  });

  it("legacy calls without an intent behave as before", () => {
    const meal = computeExerciseFuelPlan({ ...base, mealCarbsGrams: 50, currentBg: 8.5 });
    expect(meal.preFuelIntent).toBe("meal");
    expect(meal.userEnteredMealCarbs).toBe(true);
    const suggested = computeExerciseFuelPlan({ ...base, fasted: true, currentBg: 8 });
    expect(suggested.preFuelIntent).toBe("top_up");
    expect(suggested.mealCarbsIsSuggested).toBe(true);
  });

  it("asks for BG when it is missing", () => {
    const r = computeExerciseFuelPlan({ ...base, preFuelIntent: "meal", mealCarbsGrams: 50 });
    const s = buildExerciseFuelSummary(r, "mmol/L", settings);
    expect(s.insulin.reason).toMatch(/Add your BG/);
    const none = buildExerciseFuelSummary(computeExerciseFuelPlan({ ...base, preFuelIntent: "none" }), "mmol/L", settings);
    expect(none.eatNote).toMatch(/Add your BG/);
  });
});

describe("buildExerciseFuelActionLines", () => {
  const base = {
    exerciseType: "cardio" as const,
    intensity: "moderate" as const,
    durationMinutes: 45,
    minutesUntilStart: 30,
    fasted: false,
    bgUnits: "mmol/L",
    settings,
    isPump: false,
    bgTrend: "flat" as const,
  };

  it("gives meal eat + insulin, at most two lines", () => {
    const lines = buildExerciseFuelActionLines(
      computeExerciseFuelPlan({ ...base, preFuelIntent: "meal", mealCarbsGrams: 50, currentBg: 8.5 }),
      "mmol/L",
      settings,
    );
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({ label: "Eat", value: "50g" });
    expect(lines[1]?.label).toBe("Take");
    expect(lines[1]?.value).toMatch(/u$/);
  });

  it("gives snack size for a low top-up", () => {
    const lines = buildExerciseFuelActionLines(
      computeExerciseFuelPlan({ ...base, preFuelIntent: "top_up", currentBg: 6.2 }),
      "mmol/L",
      settings,
    );
    expect(lines[0]?.label).toBe("Snack");
    expect(lines[0]?.value).toMatch(/g$/);
    expect(lines.length).toBeLessThanOrEqual(2);
  });

  it("gives treat first when BG is hypo", () => {
    const lines = buildExerciseFuelActionLines(
      computeExerciseFuelPlan({ ...base, preFuelIntent: "top_up", currentBg: 3.8 }),
      "mmol/L",
      settings,
    );
    expect(lines[0]?.label).toBe("Treat first");
  });

  it("gives carry for not eating when in range", () => {
    const lines = buildExerciseFuelActionLines(
      computeExerciseFuelPlan({ ...base, preFuelIntent: "none", currentBg: 8.4 }),
      "mmol/L",
      settings,
    );
    expect(lines[0]).toMatchObject({ label: "Carry" });
    expect(lines).toHaveLength(1);
  });

  it("omits carry when compact (Before step)", () => {
    const lines = buildExerciseFuelActionLines(
      computeExerciseFuelPlan({ ...base, preFuelIntent: "meal", mealCarbsGrams: 50, currentBg: 8.5 }),
      "mmol/L",
      settings,
      { includeCarry: false },
    );
    expect(lines.every((l) => l.label !== "Carry")).toBe(true);
    expect(lines.length).toBeLessThanOrEqual(2);
  });
});

describe("exerciseFuelInputFromSession", () => {
  const session = {
    id: "s1",
    exerciseName: "Run",
    exerciseType: "cardio" as const,
    intensity: "moderate" as const,
    durationMinutes: 45,
    phase: "pre" as const,
    startedAt: new Date(Date.now() - 10 * 60_000).toISOString(),
    recoveryMinutes: 120,
    midCheckDone: false,
    preChecklist: { bgChecked: false, carbsConsidered: false, basalAdjusted: false },
    preBg: 7.4,
    preTrend: "flat" as const,
    preRapidInsulin2h: "yes" as const,
    prePlan: { intent: "meal" as const, carbsGrams: 40, mealType: "lunch", minutesUntilStart: 30 },
  };

  it("counts down the start time and prefers the live BG", () => {
    const input = exerciseFuelInputFromSession(session, {
      bgUnits: "mmol/L",
      settings,
      isPump: false,
      currentBg: 9.1,
    });
    expect(input).not.toBeNull();
    expect(input!.minutesUntilStart).toBe(20);
    expect(input!.currentBg).toBe(9.1);
    expect(input!.preFuelIntent).toBe("meal");
    expect(input!.mealCarbsGrams).toBe(40);
    expect(input!.rapidInsulinLast2h).toBe(true);
  });

  it("returns null without a plan", () => {
    expect(
      exerciseFuelInputFromSession({ ...session, prePlan: undefined }, { bgUnits: "mmol/L", settings, isPump: false }),
    ).toBeNull();
  });
});

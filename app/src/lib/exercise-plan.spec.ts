import { describe, expect, it } from "vitest";
import { calculateExercisePlan, calculateExercisePlanFromMessage } from "./exercise-plan";

const baseCtx = {
  exerciseType: "cardio",
  durationMinutes: 45,
  intensity: "moderate" as const,
  minutesUntilStart: 60,
  bgUnits: "mmol/L" as const,
};

describe("calculateExercisePlan", () => {
  it("returns structured plan for baseline context", () => {
    const r = calculateExercisePlan(baseCtx);
    expect(r.duration).toBe(45);
    expect(r.intensity).toBe("moderate");
    expect(r.exerciseType).toBe("Cardio");
    expect(r.pre.bolusReduction).toMatch(/\d/);
    expect(r.during.tips.length).toBeGreaterThan(0);
    expect(r.pumpTips.pre.length).toBeGreaterThan(0);
  });

  it("adds contextual notes when recent insulin and moderate intensity", () => {
    const r = calculateExercisePlan({
      ...baseCtx,
      lastInsulinTiming: "lt_1h",
    });
    expect(r.pre.contextualNotes?.some((n) => n.toLowerCase().includes("insulin"))).toBe(true);
    expect(r.during.checkBg || r.during.carbsNeeded > 0).toBe(true);
  });

  it("flags low BG in contextual notes", () => {
    const r = calculateExercisePlan({
      ...baseCtx,
      currentBg: 4.2,
    });
    expect(r.pre.contextualNotes?.some((n) => n.toLowerCase().includes("low"))).toBe(true);
  });

  it("uses minutesUntilStart in timing kicker", () => {
    const soon = calculateExercisePlan({ ...baseCtx, minutesUntilStart: 30 });
    expect(soon.pre.timing).toBe("Starting soon");
    const ahead = calculateExercisePlan({ ...baseCtx, minutesUntilStart: 120 });
    expect(ahead.pre.timing).toBe("Planning ahead");
  });

  it("nudges carb targets by exercise type (same intensity and duration)", () => {
    const ctx = { ...baseCtx, durationMinutes: 60, intensity: "moderate" as const };
    const cardio = calculateExercisePlan({ ...ctx, exerciseType: "cardio" });
    const strength = calculateExercisePlan({ ...ctx, exerciseType: "strength" });
    const yoga = calculateExercisePlan({ ...ctx, exerciseType: "yoga" });
    // Moderate 60 min: base during carbs > 0; cardio bumps during vs strength reduction
    expect(cardio.during.carbsNeeded).toBeGreaterThanOrEqual(strength.during.carbsNeeded);
    expect(yoga.post.carbs).toBeLessThan(cardio.post.carbs);
    expect(strength.post.carbs).toBeGreaterThanOrEqual(cardio.post.carbs);
    expect(cardio.pre.contextualNotes?.some((n) => n.includes("activity type"))).toBe(true);
  });

  it("adds contextual notes for planned pre-exercise snack with bolus", () => {
    const r = calculateExercisePlan({
      ...baseCtx,
      plannedPreExerciseFuel: "snack_bolus",
      minutesUntilPreExerciseFuel: 25,
      minutesUntilStart: 60,
    });
    const notes = r.pre.contextualNotes ?? [];
    expect(notes.some((n) => n.includes("Pre-exercise snack with bolus"))).toBe(true);
    expect(notes.some((n) => n.toLowerCase().includes("stacking"))).toBe(true);
    expect(r.during.tips.some((t) => t.includes("pre-exercise snack or meal"))).toBe(true);
  });

  it("notes when planned fuel is after session start time", () => {
    const r = calculateExercisePlan({
      ...baseCtx,
      plannedPreExerciseFuel: "meal_bolus",
      minutesUntilPreExerciseFuel: 90,
      minutesUntilStart: 45,
    });
    expect(
      r.pre.contextualNotes?.some((n) => n.includes("after your session was due to start")),
    ).toBe(true);
  });

  it("uses planned pre-exercise meal timing only (no duplicate generic meal line)", () => {
    const withMealBolus = calculateExercisePlan({
      ...baseCtx,
      plannedPreExerciseFuel: "meal_bolus",
      minutesUntilPreExerciseFuel: 40,
    });
    expect(withMealBolus.pre.contextualNotes?.some((n) => n.startsWith("Meal in ~"))).toBe(false);
    expect(
      withMealBolus.pre.contextualNotes?.some((n) => n.includes("Pre-exercise meal with bolus")),
    ).toBe(true);
  });

  it("legacy about_to_eat with mismatched minutesUntilNextMeal defers to planned fuel tip (no conflict warning)", () => {
    const r = calculateExercisePlan({
      ...baseCtx,
      nutritionContext: "about_to_eat",
      minutesUntilNextMeal: 60,
      plannedPreExerciseFuel: "meal_bolus",
      minutesUntilPreExerciseFuel: 20,
    });
    expect(r.pre.contextualNotes?.some((n) => n.includes("different meal timings"))).toBe(false);
    expect(r.pre.contextualNotes?.some((n) => n.includes("Pre-exercise meal with bolus in ~20 min"))).toBe(true);
  });

  it("adds generic meal timing line for legacy about_to_eat when no planned fuel", () => {
    const r = calculateExercisePlan({
      ...baseCtx,
      nutritionContext: "about_to_eat",
      minutesUntilNextMeal: 40,
    });
    expect(r.pre.contextualNotes?.some((n) => n.startsWith("Meal in ~40 min"))).toBe(true);
  });
});

describe("calculateExercisePlanFromMessage", () => {
  it("parses legacy message", () => {
    const r = calculateExercisePlanFromMessage("moderate cardio for 30 minutes", "mmol/L");
    expect(r.duration).toBe(30);
    expect(r.exerciseType).toBe("Cardio");
  });

  it("detects court sports from tennis wording", () => {
    const r = calculateExercisePlanFromMessage("moderate tennis for 45 minutes", "mmol/L");
    expect(r.exerciseType).toBe("Court sports");
  });
});

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
});

describe("calculateExercisePlanFromMessage", () => {
  it("parses legacy message", () => {
    const r = calculateExercisePlanFromMessage("moderate cardio for 30 minutes", "mmol/L");
    expect(r.duration).toBe(30);
    expect(r.exerciseType).toBe("Cardio");
  });
});

import { describe, expect, it } from "vitest";
import {
  calculateMealDose,
  comparePlannedBolusToPreview,
  getExerciseMealBolusPreview,
  mealDoseHoursFromPlannerMinutes,
  parseOptionalBolusUnits,
  plannedBolusCompareMessage,
} from "./meal-dose";
import type { UserSettings } from "./storage";

const settingsWithSnackRatio: UserSettings = {
  snackRatio: "1:10g",
};

describe("mealDoseHoursFromPlannerMinutes", () => {
  it("matches planner and adviser (ceil hours, min 1)", () => {
    expect(mealDoseHoursFromPlannerMinutes(0)).toBe(1);
    expect(mealDoseHoursFromPlannerMinutes(30)).toBe(1);
    expect(mealDoseHoursFromPlannerMinutes(90)).toBe(2);
    expect(mealDoseHoursFromPlannerMinutes(120)).toBe(2);
  });
});

describe("calculateMealDose before exercise", () => {
  it("reduces dose more when exercise is sooner (before, within 1h)", () => {
    const within1h = calculateMealDose(60, "snack", settingsWithSnackRatio, "mmol/L", "before", 1);
    const later = calculateMealDose(60, "snack", settingsWithSnackRatio, "mmol/L", "before", 3);
    expect(within1h.exerciseContext).toBe("before");
    expect(later.exerciseContext).toBe("before");
    expect(within1h.exerciseReduction).toBe(40);
    expect(later.exerciseReduction).toBe(20);
    expect(within1h.standardDose).toBeDefined();
    expect(later.standardDose).toBeDefined();
    expect(within1h.dose!).toBeLessThan(later.dose!);
  });

  it("returns no_ratios when ratios and TDD missing", () => {
    const r = calculateMealDose(40, "snack", {}, "mmol/L", "before", 1);
    expect(r.error).toBe("no_ratios");
  });
});

describe("calculateMealDose exercise meta modifiers", () => {
  it("increases post-exercise reduction for intense long cardio", () => {
    const r = calculateMealDose(60, "snack", settingsWithSnackRatio, "mmol/L", "after", 1, {
      exerciseType: "cardio",
      intensity: "intense",
      durationMinutes: 120,
    });
    expect(r.exerciseContext).toBe("after");
    expect(r.exerciseReduction).toBeGreaterThanOrEqual(40);
  });

  it("decreases post-exercise reduction for strength", () => {
    const r = calculateMealDose(60, "snack", settingsWithSnackRatio, "mmol/L", "after", 1, {
      exerciseType: "strength",
      intensity: "moderate",
      durationMinutes: 45,
    });
    expect(r.exerciseContext).toBe("after");
    expect(r.exerciseReduction).toBeLessThanOrEqual(30);
  });
});

describe("getExerciseMealBolusPreview", () => {
  it("delegates to calculateMealDose with hours from minutes", () => {
    const fromHelper = getExerciseMealBolusPreview(60, "snack", settingsWithSnackRatio, "mmol/L", 45);
    const direct = calculateMealDose(60, "snack", settingsWithSnackRatio, "mmol/L", "before", 1);
    expect(fromHelper.dose).toBe(direct.dose);
    expect(fromHelper.exerciseReduction).toBe(direct.exerciseReduction);
  });
});

describe("comparePlannedBolusToPreview", () => {
  it("returns null for empty or invalid input", () => {
    expect(comparePlannedBolusToPreview("", 5)).toBeNull();
    expect(comparePlannedBolusToPreview("  ", 5)).toBeNull();
    expect(comparePlannedBolusToPreview("abc", 5)).toBeNull();
    expect(comparePlannedBolusToPreview("-1", 5)).toBeNull();
    expect(comparePlannedBolusToPreview("5", 0)).toBeNull();
    expect(comparePlannedBolusToPreview("5", -1)).toBeNull();
  });

  it("parses decimals with comma", () => {
    const r = comparePlannedBolusToPreview("4,5", 4.5);
    expect(r?.kind).toBe("close");
    expect(r?.userUnits).toBe(4.5);
  });

  it("classifies close when within rounding band", () => {
    expect(comparePlannedBolusToPreview("5", 5)?.kind).toBe("close");
    expect(comparePlannedBolusToPreview("5.3", 5)?.kind).toBe("close");
    expect(comparePlannedBolusToPreview("10", 9.5)?.kind).toBe("close");
  });

  it("classifies moderate delta", () => {
    const r = comparePlannedBolusToPreview("10", 8.5);
    expect(r?.kind).toBe("moderate");
    expect(r?.deltaAbs).toBe(1.5);
  });

  it("classifies large delta", () => {
    expect(comparePlannedBolusToPreview("5", 8)?.kind).toBe("large");
    expect(comparePlannedBolusToPreview("10", 7)?.kind).toBe("large");
  });

  it("plannedBolusCompareMessage returns non-empty for each kind", () => {
    const close = comparePlannedBolusToPreview("5", 5)!;
    const mod = comparePlannedBolusToPreview("10", 8.5)!;
    const large = comparePlannedBolusToPreview("2", 8)!;
    expect(plannedBolusCompareMessage(close).length).toBeGreaterThan(10);
    expect(plannedBolusCompareMessage(mod).length).toBeGreaterThan(10);
    expect(plannedBolusCompareMessage(large).length).toBeGreaterThan(10);
  });
});

describe("parseOptionalBolusUnits", () => {
  it("returns null for empty or invalid", () => {
    expect(parseOptionalBolusUnits("")).toBeNull();
    expect(parseOptionalBolusUnits("x")).toBeNull();
  });

  it("parses positive numbers", () => {
    expect(parseOptionalBolusUnits("3.5")).toBe(3.5);
    expect(parseOptionalBolusUnits("0")).toBe(0);
  });
});

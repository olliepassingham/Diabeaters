import { describe, expect, it } from "vitest";
import {
  calculateMealDose,
  calculateSplitDose,
  comparePlannedBolusToPreview,
  getExerciseMealBolusPreview,
  getMealDoseRoundingGuide,
  mealDoseHoursFromPlannerMinutes,
  parseOptionalBolusUnits,
  plannedBolusCompareMessage,
} from "./meal-dose";
import type { UserSettings } from "./storage";

const settingsWithSnackRatio: UserSettings = {
  snackRatio: "1:10g",
};

describe("getMealDoseRoundingGuide", () => {
  it("returns down/up options with suggested dose flagged", () => {
    const guide = getMealDoseRoundingGuide(8.5, 9, "mmol/L");
    expect(guide?.exactLabel).toBe("8.5u");
    expect(guide?.options).toHaveLength(2);
    expect(guide?.options[0]).toMatchObject({ label: "8u", isSuggested: false });
    expect(guide?.options[1]).toMatchObject({ label: "9u", isSuggested: true });
  });

  it("returns null when exact dose rounds to a single whole unit", () => {
    expect(getMealDoseRoundingGuide(8, 8, "mmol/L")).toBeNull();
  });
});

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

  it("estimates dose from MDI short + long acting when explicit TDD is unset", () => {
    const r = calculateMealDose(
      50,
      "snack",
      { shortActingUnitsPerDay: 25, longActingUnitsPerDay: 15 },
      "mmol/L",
    );
    expect(r.error).toBeUndefined();
    expect(r.dose).toBe(4);
  });
});

describe("calculateMealDose input validation", () => {
  it("returns invalid_carbs for zero carbs, even with ratios set", () => {
    const r = calculateMealDose(0, "snack", settingsWithSnackRatio, "mmol/L");
    expect(r.error).toBe("invalid_carbs");
    expect(r.dose).toBe(0);
  });

  it("returns invalid_carbs for negative carbs", () => {
    const r = calculateMealDose(-10, "snack", settingsWithSnackRatio, "mmol/L");
    expect(r.error).toBe("invalid_carbs");
  });

  it("returns invalid_carbs for non-finite carbs", () => {
    const r = calculateMealDose(NaN, "snack", settingsWithSnackRatio, "mmol/L");
    expect(r.error).toBe("invalid_carbs");
  });

  it("returns no_ratios (not invalid_carbs) when carbs are valid but no ratio/TDD exists", () => {
    const r = calculateMealDose(40, "snack", {}, "mmol/L");
    expect(r.error).toBe("no_ratios");
  });

  it("uses explicit tdd as a fallback when no meal ratio is set", () => {
    const r = calculateMealDose(50, "snack", { tdd: 50 }, "mmol/L");
    expect(r.error).toBeUndefined();
    // 500 rule: 500 / 50 = 10g per unit -> 50g / 10 = 5u
    expect(r.dose).toBe(5);
  });

  it("computes a normal dose from a saved ratio with no exercise context", () => {
    const r = calculateMealDose(50, "snack", settingsWithSnackRatio, "mmol/L");
    expect(r.error).toBeUndefined();
    expect(r.dose).toBe(5);
    expect(r.exerciseContext).toBeUndefined();
  });
});

describe("calculateSplitDose", () => {
  it("splits 70/30 for low fat with a 1.5h delay", () => {
    const r = calculateSplitDose(10, "low");
    expect(r.totalUnits).toBe(10);
    expect(r.firstDose).toBe(7);
    expect(r.secondDose).toBe(3);
    expect(r.secondDoseDelay).toBe(1.5);
    expect(r.splitRatio).toBe("70/30");
  });

  it("splits 60/40 for medium fat with a 2h delay", () => {
    const r = calculateSplitDose(10, "medium");
    expect(r.firstDose).toBe(6);
    expect(r.secondDose).toBe(4);
    expect(r.secondDoseDelay).toBe(2);
    expect(r.splitRatio).toBe("60/40");
  });

  it("splits 50/50 for high fat with a 3h delay", () => {
    const r = calculateSplitDose(9, "high");
    expect(r.firstDose).toBe(5);
    expect(r.secondDose).toBe(4);
    expect(r.secondDoseDelay).toBe(3);
    expect(r.splitRatio).toBe("50/50");
  });

  it("rounds the exact total before splitting so first+second matches the whole-unit total", () => {
    const r = calculateSplitDose(8.6, "high");
    expect(r.totalUnits).toBe(9);
    expect(r.firstDose + r.secondDose).toBe(9);
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

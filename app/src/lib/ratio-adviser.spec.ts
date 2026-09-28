import { describe, expect, it } from "vitest";
import { assessMealRatio, compareLaterBg, illustrateRatioStep } from "./ratio-adviser";

const base = {
  ratio: "1:10",
  correctionFactor: 2,
  targetLow: 4,
  targetHigh: 10,
  bgUnits: "mmol/L" as const,
  roundIncrement: 1,
};

describe("assessMealRatio", () => {
  it("covers carbs and expects to stay put when glucose is already in range", () => {
    const check = assessMealRatio({ ...base, carbs: 40, currentBg: 6 });
    expect(check?.carbBolusExact).toBe(4);
    expect(check?.correctionExact).toBe(0);
    expect(check?.totalRounded).toBe(4);
    expect(check?.expectedLanding).toBe(6);
  });

  it("adds a correction above target and lands on the top of the range", () => {
    const check = assessMealRatio({ ...base, carbs: 40, currentBg: 14 });
    expect(check?.correctionExact).toBe(2);
    expect(check?.totalExact).toBe(6);
    expect(check?.totalRounded).toBe(6);
    expect(check?.expectedLanding).toBe(10);
  });

  it("reduces the meal dose when glucose is below range", () => {
    const check = assessMealRatio({ ...base, carbs: 40, currentBg: 3, correctionFactor: 2 });
    expect(check?.correctionExact).toBeCloseTo(-0.5, 5);
    expect(check?.totalExact).toBeCloseTo(3.5, 5);
    expect(check?.totalRounded).toBe(4);
  });

  it("skips the landing when ISF is missing", () => {
    const check = assessMealRatio({ ...base, carbs: 40, currentBg: 14, correctionFactor: null });
    expect(check?.correctionExact).toBe(0);
    expect(check?.totalRounded).toBe(4);
    expect(check?.expectedLanding).toBeNull();
  });
});

describe("compareLaterBg", () => {
  it("reads the 2-hour reading against the target", () => {
    expect(compareLaterBg(7, 4, 10)).toBe("held");
    expect(compareLaterBg(11, 4, 10)).toBe("high");
    expect(compareLaterBg(3.5, 4, 10)).toBe("low");
  });
});

describe("illustrateRatioStep", () => {
  it("tightens 1:10 to 1:8 and recalculates the same carbs", () => {
    const step = illustrateRatioStep({
      gramsPerUnit: 10,
      direction: "tighten",
      carbs: 40,
      roundIncrement: 1,
      ratioFormat: "per10g",
    });
    expect(step?.gramsPerUnit).toBe(8);
    expect(step?.storageRatio).toBe("1:8");
    expect(step?.currentCarbBolusRounded).toBe(4);
    expect(step?.carbBolusRounded).toBe(5);
  });

  it("loosens 1:10 to 1:12", () => {
    const step = illustrateRatioStep({
      gramsPerUnit: 10,
      direction: "loosen",
      carbs: 40,
      roundIncrement: 1,
      ratioFormat: "1toXg",
    });
    expect(step?.gramsPerUnit).toBe(12);
    expect(step?.ratioLabel).toBe("1:12g");
    expect(step?.carbBolusRounded).toBe(3);
  });
});

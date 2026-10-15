import { describe, expect, it } from "vitest";

import { formatRatioForDisplay } from "@/lib/ratio-utils";
import { sickDayMealRatioAdjustment } from "@/lib/sick-day-meal-ratios";

describe("sickDayMealRatioAdjustment", () => {
  it("uses the sick-day guide percentages", () => {
    expect(sickDayMealRatioAdjustment("minor").multiplier).toBe(1.1);
    expect(sickDayMealRatioAdjustment("mild").multiplier).toBe(1.1);
    expect(sickDayMealRatioAdjustment("moderate").multiplier).toBe(1.2);
    expect(sickDayMealRatioAdjustment("").multiplier).toBe(1.2);
    expect(sickDayMealRatioAdjustment("severe").multiplier).toBe(1.3);
  });

  it("shows the same meal ratio as dividing grams per unit by the guide multiplier", () => {
    const usual = "1:10";
    const gpu = 10;
    for (const severity of ["minor", "moderate", "severe"]) {
      const adjustment = sickDayMealRatioAdjustment(severity);
      const fromFactor = formatRatioForDisplay(gpu * adjustment.gramsPerUnitFactor, "per10g");
      const fromGuide = formatRatioForDisplay(gpu / adjustment.multiplier, "per10g");
      expect(fromFactor).toBe(fromGuide);
      expect(fromFactor).not.toBe(usual);
    }
    expect(formatRatioForDisplay(10 * sickDayMealRatioAdjustment("minor").gramsPerUnitFactor, "per10g")).toBe("1.1u:10g");
    expect(formatRatioForDisplay((10 / 1.5) * sickDayMealRatioAdjustment("minor").gramsPerUnitFactor, "per10g")).toBe("1.7u:10g");
  });
});

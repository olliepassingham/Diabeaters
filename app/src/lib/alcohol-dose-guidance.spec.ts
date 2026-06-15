import { describe, expect, it } from "vitest";
import { buildAlcoholDoseGuidance, formatAlcoholDoseRange } from "@/lib/alcohol-dose-guidance";

describe("buildAlcoholDoseGuidance", () => {
  it("returns wider reduction range for heavier drinking", () => {
    const light = buildAlcoholDoseGuidance({
      standardDose: 12,
      exactDose: 12,
      drinkingIntensity: "light",
    });
    const heavy = buildAlcoholDoseGuidance({
      standardDose: 12,
      exactDose: 12,
      drinkingIntensity: "long_or_heavy",
    });

    expect(light.riskLevel).toBe("aware");
    expect(heavy.riskLevel).toBe("high");
    expect(heavy.considerMaxDose).toBeLessThan(light.considerMaxDose);
    expect(heavy.reductionPctMax).toBeGreaterThan(light.reductionPctMax);
  });

  it("formats a dose range for display", () => {
    const guidance = buildAlcoholDoseGuidance({
      standardDose: 10,
      exactDose: 10.2,
      drinkingIntensity: "moderate",
      carbsG: 80,
      mealType: "dinner",
      situation: "meal_with_drinks",
    });
    expect(formatAlcoholDoseRange(guidance)).toMatch(/\d+–\d+u/);
    expect(guidance.contextLabel).toContain("80g dinner");
  });

  it("narrows range toward lower end when BG is low and falling", () => {
    const withoutBg = buildAlcoholDoseGuidance({
      standardDose: 10,
      exactDose: 10,
      drinkingIntensity: "moderate",
    });
    const guidance = buildAlcoholDoseGuidance({
      standardDose: 10,
      exactDose: 10,
      drinkingIntensity: "moderate",
      bgSkipped: false,
      bgValue: 4.8,
      bgTrend: "falling",
      bgUnits: "mmol/L",
    });
    expect(guidance.bgUsed).toBe(true);
    expect(guidance.bgNote).toMatch(/falling/i);
    expect(guidance.considerMaxDose).toBeLessThan(withoutBg.considerMaxDose);
    expect(guidance.suggestedLeanDose).toBe(guidance.considerMinDose);
  });

  it("leans higher when BG is high and rising", () => {
    const withoutBg = buildAlcoholDoseGuidance({
      standardDose: 12,
      exactDose: 12,
      drinkingIntensity: "light",
    });
    const guidance = buildAlcoholDoseGuidance({
      standardDose: 12,
      exactDose: 12,
      drinkingIntensity: "light",
      bgSkipped: false,
      bgValue: 11,
      bgTrend: "rising",
      bgUnits: "mmol/L",
    });
    expect(guidance.considerMinDose).toBeGreaterThan(withoutBg.considerMinDose);
    expect(guidance.suggestedLeanDose).toBe(guidance.considerMaxDose);
  });
});

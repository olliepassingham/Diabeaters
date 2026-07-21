import { describe, expect, it } from "vitest";
import { computeMealImpact, mealCompositionSummaryLabel, type MealComposition } from "./meal-impact";

function composition(overrides: Partial<MealComposition> = {}): MealComposition {
  return {
    carbType: "balanced",
    hasFat: false,
    hasProtein: false,
    hasFibre: false,
    ...overrides,
  };
}

describe("computeMealImpact", () => {
  it("classifies a sugary drink as a quick spike with no tail risk", () => {
    const impact = computeMealImpact(composition({ carbType: "liquid_sugars" }));
    expect(impact.pattern).toBe("quick_spike");
    expect(impact.patternLabel).toBe("Quick spike");
    expect(impact.tailRisk).toBe(false);
    expect(impact.tailWindowLabel).toBeUndefined();
    expect(impact.chart.totalHours).toBe(4);
  });

  it("classifies a balanced plate as a steady rise", () => {
    const impact = computeMealImpact(composition({ carbType: "balanced" }));
    expect(impact.pattern).toBe("steady_rise");
    expect(impact.tailRisk).toBe(false);
  });

  it("classifies a starchy meal with fat and protein as slow & extended, with tail risk", () => {
    const impact = computeMealImpact(
      composition({ carbType: "starchy", hasFat: true, hasProtein: true }),
    );
    expect(impact.pattern).toBe("slow_extended");
    expect(impact.tailRisk).toBe(true);
    expect(impact.tailWindowLabel).toBe("~3-6 h later");
    expect(impact.chart.totalHours).toBe(6);
    expect(impact.chart.tailTimeHours).toBeGreaterThan(impact.chart.peakTimeHours);
  });

  it("classifies fast carbs plus fat as spike-then-tail (e.g. chocolate, ice cream)", () => {
    const impact = computeMealImpact(composition({ carbType: "quick_refined", hasFat: true }));
    expect(impact.pattern).toBe("spike_then_tail");
    expect(impact.patternLabel).toBe("Spike, then a delayed tail");
    expect(impact.tailRisk).toBe(true);
  });

  it("sets tailRisk whenever fat is present, regardless of carb type", () => {
    for (const carbType of ["liquid_sugars", "quick_refined", "fruit", "starchy", "balanced", "unsure"] as const) {
      const impact = computeMealImpact(composition({ carbType, hasFat: true }));
      expect(impact.tailRisk).toBe(true);
    }
  });

  it("never sets tailRisk when fat is absent, regardless of protein/fibre", () => {
    const impact = computeMealImpact(composition({ hasProtein: true, hasFibre: true }));
    expect(impact.tailRisk).toBe(false);
  });

  it("keeps slowScore within the documented 0-1 bounds for every combination", () => {
    const carbTypes = ["liquid_sugars", "quick_refined", "fruit", "starchy", "balanced", "unsure"] as const;
    for (const carbType of carbTypes) {
      for (const hasFat of [false, true]) {
        for (const hasProtein of [false, true]) {
          for (const hasFibre of [false, true]) {
            const impact = computeMealImpact(composition({ carbType, hasFat, hasProtein, hasFibre }));
            expect(impact.slowScore).toBeGreaterThan(0);
            expect(impact.slowScore).toBeLessThan(1);
            expect(impact.chart.peakHeight).toBeGreaterThan(0);
            expect(impact.chart.peakHeight).toBeLessThanOrEqual(1);
            expect(impact.chart.peakTimeHours).toBeLessThanOrEqual(impact.chart.totalHours);
          }
        }
      }
    }
  });

  it("always returns at least one management tip and ends with the 'typical pattern' disclaimer", () => {
    const impact = computeMealImpact(composition());
    expect(impact.managementTips.length).toBeGreaterThan(0);
    expect(impact.managementTips[impact.managementTips.length - 1]).toMatch(/typical pattern only/i);
  });

  it("mentions the split-dose calculator and a later BG check for slow/tail patterns", () => {
    const impact = computeMealImpact(composition({ carbType: "starchy", hasFat: true }));
    const joined = impact.managementTips.join(" ").toLowerCase();
    expect(joined).toContain("split-dose calculator");
    expect(joined).toContain("3-5 hours");
  });

  it("mentions pre-bolusing for quick-spike patterns", () => {
    const impact = computeMealImpact(composition({ carbType: "liquid_sugars" }));
    const joined = impact.managementTips.join(" ").toLowerCase();
    expect(joined).toContain("pre-bolus");
  });

  it("adds a fibre-specific tip only when hasFibre is set", () => {
    const withFibre = computeMealImpact(composition({ hasFibre: true }));
    const withoutFibre = computeMealImpact(composition({ hasFibre: false }));
    expect(withFibre.managementTips.some((t) => t.toLowerCase().includes("fibre"))).toBe(true);
    expect(withoutFibre.managementTips.some((t) => t.toLowerCase().includes("fibre can smooth"))).toBe(false);
  });
});

describe("mealCompositionSummaryLabel", () => {
  it("returns the base carb type label with no extras", () => {
    expect(mealCompositionSummaryLabel(composition({ carbType: "balanced" }))).toBe("Balanced plate");
  });

  it("appends extras in order when present", () => {
    expect(
      mealCompositionSummaryLabel(composition({ carbType: "starchy", hasFat: true, hasProtein: true, hasFibre: true })),
    ).toBe("Starchy + fat + protein + fibre");
  });
});

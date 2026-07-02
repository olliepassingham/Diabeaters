import { describe, expect, it } from "vitest";

import { bedtimeTrendReduction, calculateBedtimeCorrectionDose } from "./bedtime-correction-dose";

describe("bedtimeTrendReduction", () => {
  it("uses higher multiplier when rising and well above target", () => {
    expect(bedtimeTrendReduction("rising", { wellAboveTarget: true }).multiplier).toBe(0.85);
    expect(bedtimeTrendReduction("rising", { wellAboveTarget: false }).multiplier).toBe(0.75);
  });

  it("uses smaller multiplier when falling", () => {
    expect(bedtimeTrendReduction("falling", { wellAboveTarget: false }).multiplier).toBe(0.3);
  });
});

describe("calculateBedtimeCorrectionDose", () => {
  const base = {
    bgMmol: 17,
    targetHighMmol: 8,
    correctionFactor: 3,
    bgUnits: "mmol/L" as const,
    insulinHours: 5,
    wellAboveTarget: true,
    exercisedToday: false,
    hadAlcohol: false,
    sickDayActive: false,
  };

  it("returns higher dose when rising than when steady", () => {
    const rising = calculateBedtimeCorrectionDose({ ...base, bgTrend: "rising" });
    const steady = calculateBedtimeCorrectionDose({ ...base, bgTrend: "steady" });
    expect(rising?.suggestedDose).toBeGreaterThan(steady?.suggestedDose ?? 0);
    expect(rising?.pctOfFullDose).toBeGreaterThan(steady?.pctOfFullDose ?? 0);
  });

  it("returns lower dose when falling than when steady", () => {
    const falling = calculateBedtimeCorrectionDose({ ...base, bgTrend: "falling" });
    const steady = calculateBedtimeCorrectionDose({ ...base, bgTrend: "steady" });
    expect(falling?.suggestedDose).toBeLessThan(steady?.suggestedDose ?? Infinity);
  });

  it("applies IOB reduction on top of trend reduction", () => {
    const noIob = calculateBedtimeCorrectionDose({ ...base, bgTrend: "steady", insulinHours: 5 });
    const withIob = calculateBedtimeCorrectionDose({ ...base, bgTrend: "steady", insulinHours: 0.5 });
    expect(withIob?.suggestedDose).toBeLessThan(noIob?.suggestedDose ?? Infinity);
    expect(withIob?.iobReduction).toBe(0.6);
  });

  it("pctOfFullDose reflects pre-round math not rounded units", () => {
    const res = calculateBedtimeCorrectionDose({
      ...base,
      bgMmol: 10.6,
      wellAboveTarget: false,
      bgTrend: "steady",
    });
    expect(res).not.toBeNull();
    if (!res) return;
    expect(res.fullDose).toBe(1);
    expect(res.pctOfFullDose).toBe(50);
  });

  it("returns null without correction factor", () => {
    expect(calculateBedtimeCorrectionDose({ ...base, correctionFactor: 0, bgTrend: "steady" })).toBeNull();
  });
});

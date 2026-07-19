import { describe, expect, it } from "vitest";

import {
  bedtimeTrendReduction,
  calculateBedtimeCorrectionDose,
  resolveBedtimeCorrectionAim,
} from "./bedtime-correction-dose";

describe("bedtimeTrendReduction", () => {
  it("uses higher multiplier when rising and well above target", () => {
    expect(bedtimeTrendReduction("rising", { wellAboveTarget: true }).multiplier).toBe(0.85);
    expect(bedtimeTrendReduction("rising", { wellAboveTarget: false }).multiplier).toBe(0.75);
  });

  it("uses smaller multiplier when falling", () => {
    expect(bedtimeTrendReduction("falling", { wellAboveTarget: false }).multiplier).toBe(0.3);
  });

  it("floors the multiplier and adds an overnight note when the user usually rises overnight, even if currently falling", () => {
    const result = bedtimeTrendReduction("falling", { wellAboveTarget: false, overnightUsualTrend: "rise" });
    expect(result.multiplier).toBeCloseTo(0.6);
    expect(result.overnightNote).toMatch(/usually rise overnight/i);
  });

  it("caps the multiplier and adds a caution note when the user usually falls overnight, even if currently rising", () => {
    const result = bedtimeTrendReduction("rising", { wellAboveTarget: true, overnightUsualTrend: "fall" });
    expect(result.multiplier).toBeCloseTo(0.35);
    expect(result.overnightNote).toMatch(/usually fall overnight/i);
  });

  it("leaves the multiplier untouched when overnight pattern is not set", () => {
    expect(bedtimeTrendReduction("steady", { wellAboveTarget: false }).multiplier).toBe(0.5);
    expect(
      bedtimeTrendReduction("steady", { wellAboveTarget: false, overnightUsualTrend: "not_sure" }).multiplier,
    ).toBe(0.5);
  });
});

describe("resolveBedtimeCorrectionAim", () => {
  it("aims lower in the range when the user usually rises overnight", () => {
    expect(resolveBedtimeCorrectionAim(4, 10, "rise")).toBeCloseTo(5.5);
  });

  it("aims higher than the range top when the user usually falls overnight", () => {
    expect(resolveBedtimeCorrectionAim(4, 10, "fall")).toBeCloseTo(11.5);
  });

  it("aims at the top of the range when the pattern is unknown or steady", () => {
    expect(resolveBedtimeCorrectionAim(4, 10, "not_sure")).toBe(10);
    expect(resolveBedtimeCorrectionAim(4, 10, "steady")).toBe(10);
  });
});

describe("calculateBedtimeCorrectionDose", () => {
  const base = {
    bgMmol: 17,
    targetLowMmol: 4,
    targetHighMmol: 8,
    correctionFactor: 3,
    bgUnits: "mmol/L" as const,
    insulinHours: 5,
    overnightUsualTrend: "not_sure" as const,
    wellAboveTarget: true,
    exercisedToday: false,
    hadAlcohol: false,
    sickDayActive: false,
  };

  function doseOf(result: ReturnType<typeof calculateBedtimeCorrectionDose>) {
    return result.status === "dose" ? result.suggestedDose : null;
  }

  it("returns higher dose when rising than when steady", () => {
    const rising = calculateBedtimeCorrectionDose({ ...base, bgTrend: "rising" });
    const steady = calculateBedtimeCorrectionDose({ ...base, bgTrend: "steady" });
    expect(doseOf(rising)).toBeGreaterThan(doseOf(steady) ?? 0);
  });

  it("returns lower dose when falling than when steady", () => {
    const falling = calculateBedtimeCorrectionDose({ ...base, bgTrend: "falling" });
    const steady = calculateBedtimeCorrectionDose({ ...base, bgTrend: "steady" });
    expect(doseOf(falling)).toBeLessThan(doseOf(steady) ?? Infinity);
  });

  it("applies IOB reduction on top of trend reduction", () => {
    const noIob = calculateBedtimeCorrectionDose({ ...base, bgTrend: "steady", insulinHours: 5 });
    const withIob = calculateBedtimeCorrectionDose({ ...base, bgTrend: "steady", insulinHours: 0.5 });
    expect(doseOf(withIob)).toBeLessThan(doseOf(noIob) ?? Infinity);
  });

  it("distinguishes a missing correction factor from a dose that is simply too small", () => {
    const missingIsf = calculateBedtimeCorrectionDose({ ...base, correctionFactor: 0, bgTrend: "steady" });
    expect(missingIsf.status).toBe("no_isf");

    // Small full dose + cautious falling reduction rounds to 0, but ISF *is* set — must not be
    // reported as a missing correction factor.
    const tooSmall = calculateBedtimeCorrectionDose({
      ...base,
      bgMmol: 10.6,
      targetHighMmol: 10,
      wellAboveTarget: false,
      bgTrend: "falling",
    });
    expect(tooSmall.status).toBe("dose_too_small");
  });

  it("says no correction is needed when BG is at or under the target, regardless of ISF", () => {
    const inRange = calculateBedtimeCorrectionDose({ ...base, correctionFactor: 0, bgMmol: 7, bgTrend: "steady" });
    expect(inRange.status).toBe("no_correction_needed");
  });

  describe("overnight pattern reproduces the reported bug and fixes it", () => {
    // BG 13.4, falling right now, default 4-10 range, ISF 3 — this used to report "dose not
    // calculated / add your correction factor" even with a correction factor set, and separately
    // suggested a 5g snack that would have made things worse.
    const reported = {
      bgMmol: 13.4,
      targetLowMmol: 4,
      targetHighMmol: 10,
      correctionFactor: 3,
      bgUnits: "mmol/L" as const,
      insulinHours: 6,
      bgTrend: "falling" as const,
      wellAboveTarget: true,
      exercisedToday: false,
      hadAlcohol: false,
      sickDayActive: false,
    };

    it("without a known overnight pattern, is honestly reported as too small (not a missing ISF)", () => {
      const result = calculateBedtimeCorrectionDose({ ...reported, overnightUsualTrend: "not_sure" });
      expect(result.status).toBe("dose_too_small");
    });

    it("when the user says they usually rise overnight, gives a real, non-zero correction dose", () => {
      const result = calculateBedtimeCorrectionDose({ ...reported, overnightUsualTrend: "rise" });
      expect(result.status).toBe("dose");
      if (result.status !== "dose") return;
      expect(result.suggestedDose).toBeGreaterThan(0);
      expect(result.targetBg).toBeLessThan(reported.targetHighMmol);
      expect(result.overnightTrendNote).toMatch(/usually rise overnight/i);
    });

    it("when the user says they usually fall overnight, is more conservative than the neutral case", () => {
      const neutral = calculateBedtimeCorrectionDose({ ...reported, bgTrend: "rising", overnightUsualTrend: "not_sure" });
      const fallPattern = calculateBedtimeCorrectionDose({ ...reported, bgTrend: "rising", overnightUsualTrend: "fall" });
      expect(neutral.status).toBe("dose");
      if (fallPattern.status === "dose" && neutral.status === "dose") {
        expect(fallPattern.suggestedDose).toBeLessThanOrEqual(neutral.suggestedDose);
        expect(fallPattern.targetBg).toBeGreaterThan(neutral.targetBg);
      }
    });
  });
});

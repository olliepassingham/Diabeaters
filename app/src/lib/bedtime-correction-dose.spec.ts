import { describe, expect, it } from "vitest";

import {
  bedtimeExtraCautionMultiplier,
  bedtimeTrendReduction,
  calculateBedtimeCorrectionDose,
  classifyBedtimeHighSeverity,
  resolveBedtimeCorrectionAim,
} from "./bedtime-correction-dose";

describe("classifyBedtimeHighSeverity", () => {
  it("is moderate close to target, high a bit further, very_high once far above", () => {
    expect(classifyBedtimeHighSeverity(11, 10)).toBe("moderate");
    expect(classifyBedtimeHighSeverity(13, 10)).toBe("high");
    expect(classifyBedtimeHighSeverity(17, 10)).toBe("very_high");
  });
});

describe("bedtimeTrendReduction", () => {
  it("uses a higher multiplier when rising, scaling further with severity", () => {
    expect(bedtimeTrendReduction("rising", { severity: "moderate" }).multiplier).toBe(0.75);
    expect(bedtimeTrendReduction("rising", { severity: "high" }).multiplier).toBe(0.85);
    expect(bedtimeTrendReduction("rising", { severity: "very_high" }).multiplier).toBe(0.9);
  });

  it("uses smaller multiplier when falling, but still scales up once severely high", () => {
    expect(bedtimeTrendReduction("falling", { severity: "moderate" }).multiplier).toBe(0.3);
    expect(bedtimeTrendReduction("falling", { severity: "high" }).multiplier).toBe(0.3);
    expect(bedtimeTrendReduction("falling", { severity: "very_high" }).multiplier).toBeGreaterThan(0.3);
  });

  it("scales the steady/not-sure base share up with severity, not just when rising", () => {
    expect(bedtimeTrendReduction("steady", { severity: "moderate" }).multiplier).toBe(0.5);
    expect(bedtimeTrendReduction("steady", { severity: "high" }).multiplier).toBeGreaterThan(0.5);
    expect(bedtimeTrendReduction("steady", { severity: "very_high" }).multiplier).toBeGreaterThan(
      bedtimeTrendReduction("steady", { severity: "high" }).multiplier,
    );
    expect(bedtimeTrendReduction("not_sure", { severity: "moderate" }).multiplier).toBe(0.5);
  });

  it("floors the multiplier and adds an overnight note when the user usually rises overnight, even if currently falling", () => {
    const result = bedtimeTrendReduction("falling", { severity: "moderate", overnightUsualTrend: "rise" });
    expect(result.multiplier).toBeCloseTo(0.6);
    expect(result.overnightNote).toMatch(/usually rise overnight/i);
  });

  it("caps the multiplier and adds a caution note when the user usually falls overnight, even if currently rising", () => {
    const result = bedtimeTrendReduction("rising", { severity: "high", overnightUsualTrend: "fall" });
    expect(result.multiplier).toBeCloseTo(0.35);
    expect(result.overnightNote).toMatch(/usually fall overnight/i);
  });

  it("leaves the multiplier untouched when overnight pattern is not set", () => {
    expect(bedtimeTrendReduction("steady", { severity: "moderate" }).multiplier).toBe(0.5);
    expect(
      bedtimeTrendReduction("steady", { severity: "moderate", overnightUsualTrend: "not_sure" }).multiplier,
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

describe("bedtimeExtraCautionMultiplier", () => {
  it("returns a multiplier of 1 and no note when nothing is selected", () => {
    const result = bedtimeExtraCautionMultiplier({ exercisedToday: false, hadAlcohol: false, recentHypos: false });
    expect(result.multiplier).toBe(1);
    expect(result.note).toBe("");
  });

  it("reduces the multiplier for each factor and stacks them multiplicatively", () => {
    const exerciseOnly = bedtimeExtraCautionMultiplier({ exercisedToday: true, hadAlcohol: false, recentHypos: false });
    const alcoholOnly = bedtimeExtraCautionMultiplier({ exercisedToday: false, hadAlcohol: true, recentHypos: false });
    const hypoOnly = bedtimeExtraCautionMultiplier({ exercisedToday: false, hadAlcohol: false, recentHypos: true });
    const all = bedtimeExtraCautionMultiplier({ exercisedToday: true, hadAlcohol: true, recentHypos: true });

    expect(exerciseOnly.multiplier).toBeCloseTo(0.85);
    expect(alcoholOnly.multiplier).toBeCloseTo(0.85);
    expect(hypoOnly.multiplier).toBeCloseTo(0.8);
    expect(all.multiplier).toBeCloseTo(0.85 * 0.85 * 0.8);
    expect(all.multiplier).toBeLessThan(Math.min(exerciseOnly.multiplier, alcoholOnly.multiplier, hypoOnly.multiplier));
  });

  it("names every active factor in the note, in a readable list", () => {
    const one = bedtimeExtraCautionMultiplier({ exercisedToday: true, hadAlcohol: false, recentHypos: false });
    expect(one.note).toBe("Made more cautious for exercise today.");

    const two = bedtimeExtraCautionMultiplier({ exercisedToday: true, hadAlcohol: true, recentHypos: false });
    expect(two.note).toBe("Made more cautious for exercise today and alcohol.");

    const three = bedtimeExtraCautionMultiplier({ exercisedToday: true, hadAlcohol: true, recentHypos: true });
    expect(three.note).toBe("Made more cautious for exercise today, alcohol, and a recent hypo.");
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
    exercisedToday: false,
    hadAlcohol: false,
    recentHypos: false,
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
      bgMmol: 9.4,
      targetHighMmol: 8.5,
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
      exercisedToday: false,
      hadAlcohol: false,
      recentHypos: false,
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

  describe("every 'Extras' switch actually adjusts the suggested dose", () => {
    // Severity is "very_high" here (excess 12 > 6), so the severity floor is in play — this is
    // deliberate: it lets us confirm both that each switch reduces the dose, AND that stacking
    // all three still doesn't crush a genuinely severe high via the floor rescuing it.
    const highBg = {
      bgMmol: 20,
      targetLowMmol: 4,
      targetHighMmol: 8,
      correctionFactor: 1,
      bgUnits: "mmol/L" as const,
      insulinHours: 5,
      bgTrend: "steady" as const,
      overnightUsualTrend: "not_sure" as const,
      sickDayActive: false,
    };

    it("has no effect on the dose when none of the extras are selected", () => {
      const baseline = calculateBedtimeCorrectionDose({
        ...highBg,
        exercisedToday: false,
        hadAlcohol: false,
        recentHypos: false,
      });
      expect(doseOf(baseline)).toBe(8);
    });

    it("exercise alone lowers the suggested dose", () => {
      const result = calculateBedtimeCorrectionDose({
        ...highBg,
        exercisedToday: true,
        hadAlcohol: false,
        recentHypos: false,
      });
      expect(doseOf(result)).toBe(7);
    });

    it("alcohol alone lowers the suggested dose", () => {
      const result = calculateBedtimeCorrectionDose({
        ...highBg,
        exercisedToday: false,
        hadAlcohol: true,
        recentHypos: false,
      });
      expect(doseOf(result)).toBe(7);
    });

    it("recent hypos alone lowers the suggested dose (more than exercise or alcohol alone)", () => {
      const result = calculateBedtimeCorrectionDose({
        ...highBg,
        exercisedToday: false,
        hadAlcohol: false,
        recentHypos: true,
      });
      expect(doseOf(result)).toBe(6);
    });

    it("stacks all three for an even more cautious dose, while the severity floor still keeps it well above zero", () => {
      const result = calculateBedtimeCorrectionDose({
        ...highBg,
        exercisedToday: true,
        hadAlcohol: true,
        recentHypos: true,
      });
      expect(doseOf(result)).toBe(5);
      expect(doseOf(result)).toBeGreaterThan(0);
      if (result.status !== "dose") throw new Error("expected a dose");
      expect(result.exerciseWarning).toMatch(/exercise/i);
      expect(result.alcoholWarning).toMatch(/alcohol/i);
      expect(result.hypoWarning).toMatch(/hypo/i);
      expect(result.extraCautionNote).toBe("Made more cautious for exercise today, alcohol, and a recent hypo.");
    });

    it("mentions the active extras in the dose_too_small note when they push a small dose to zero", () => {
      const reported = {
        bgMmol: 13.4,
        targetLowMmol: 4,
        targetHighMmol: 10,
        correctionFactor: 3,
        bgUnits: "mmol/L" as const,
        insulinHours: 6,
        bgTrend: "falling" as const,
        overnightUsualTrend: "not_sure" as const,
        exercisedToday: false,
        sickDayActive: false,
      };
      const withAlcohol = calculateBedtimeCorrectionDose({ ...reported, hadAlcohol: true, recentHypos: false });
      expect(withAlcohol.status).toBe("dose_too_small");
      if (withAlcohol.status !== "dose_too_small") return;
      expect(withAlcohol.note).toMatch(/alcohol/i);
    });
  });

  describe("severe high overnight no longer gets crushed to almost nothing by stacked caution", () => {
    // The exact scenario reported: BG 16.4 mmol/L, flat trend, target 4-10, usual overnight
    // rise, and insulin given less than an hour ago. Previously: 0.6 (trend) × 0.4 (IOB) = 24%
    // of a ~4.2u full dose → rounded to 1u despite a genuinely severe high.
    const severe = {
      bgMmol: 16.4,
      targetLowMmol: 4,
      targetHighMmol: 10,
      correctionFactor: 3,
      bgUnits: "mmol/L" as const,
      insulinHours: 0.5,
      bgTrend: "steady" as const,
      overnightUsualTrend: "rise" as const,
      exercisedToday: true,
      hadAlcohol: false,
      recentHypos: false,
      sickDayActive: false,
    };

    it("suggests a meaningfully larger share of full dose than the old flat 24%", () => {
      const result = calculateBedtimeCorrectionDose(severe);
      expect(result.status).toBe("dose");
      if (result.status !== "dose") return;
      expect(result.pctOfFullDose).toBeGreaterThan(35);
      expect(result.suggestedDose).toBeGreaterThanOrEqual(2);
    });

    it("still applies the recent-insulin warning even though the dose is larger", () => {
      const result = calculateBedtimeCorrectionDose(severe);
      expect(result.status).toBe("dose");
      if (result.status !== "dose") return;
      expect(result.iobWarning).toMatch(/active insulin/i);
    });

    it("a moderately-high reading (not severe) is unaffected by the new floor", () => {
      // exercisedToday is turned off here since this test is isolating the severity-floor
      // behaviour, not the extra-caution reduction (covered separately above).
      const mild = calculateBedtimeCorrectionDose({
        ...severe,
        bgMmol: 12,
        insulinHours: 5,
        overnightUsualTrend: "not_sure" as const,
        exercisedToday: false,
      });
      expect(mild.status).toBe("dose");
      if (mild.status !== "dose") return;
      expect(mild.pctOfFullDose).toBeLessThanOrEqual(50);
    });

    it("does not override genuine falling-trend caution with the severity floor", () => {
      const stillFalling = calculateBedtimeCorrectionDose({ ...severe, bgTrend: "falling" });
      const steady = calculateBedtimeCorrectionDose(severe);
      expect(stillFalling.status).toBe("dose");
      expect(steady.status).toBe("dose");
      if (stillFalling.status !== "dose" || steady.status !== "dose") return;
      expect(stillFalling.suggestedDose).toBeLessThan(steady.suggestedDose);
    });

    it("does not override a usually-falls-overnight pattern with the severity floor", () => {
      const usuallyFalls = calculateBedtimeCorrectionDose({ ...severe, overnightUsualTrend: "fall" });
      const usuallyRises = calculateBedtimeCorrectionDose(severe);
      expect(usuallyRises.status).toBe("dose");
      if (usuallyRises.status !== "dose") return;
      // Genuine "usually falls overnight" caution should stay well below the rise-pattern dose —
      // either rounding all the way down to "too small to bother", or landing clearly lower.
      if (usuallyFalls.status === "dose") {
        expect(usuallyFalls.suggestedDose).toBeLessThan(usuallyRises.suggestedDose);
      } else {
        expect(usuallyFalls.status).toBe("dose_too_small");
      }
    });
  });
});

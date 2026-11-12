import { describe, expect, it } from "vitest";

import {
  bedtimeExtraCautionMultiplier,
  bedtimeMinActionableDose,
  bedtimeTrendReduction,
  calculateBedtimeCorrectionDose,
  classifyBedtimeHighSeverity,
  defaultBedtimeTargetMmol,
  resolveBedtimeCorrectionAim,
  resolveBedtimeCorrectionThreshold,
} from "./bedtime-correction-dose";

describe("classifyBedtimeHighSeverity", () => {
  it("is moderate close to target, high a bit further, very_high once far above", () => {
    expect(classifyBedtimeHighSeverity(11, 10)).toBe("moderate");
    expect(classifyBedtimeHighSeverity(13, 10)).toBe("high");
    expect(classifyBedtimeHighSeverity(15.4, 10)).toBe("very_high");
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

describe("resolveBedtimeCorrectionThreshold", () => {
  it("starts correcting lower in the range when the user usually rises overnight", () => {
    expect(resolveBedtimeCorrectionThreshold(4, 10, "rise")).toBeCloseTo(5.5);
  });

  it("waits until above the range top when the user usually falls overnight", () => {
    expect(resolveBedtimeCorrectionThreshold(4, 10, "fall")).toBeCloseTo(11.5);
  });

  it("starts correcting at the top of the range when the pattern is unknown or steady", () => {
    expect(resolveBedtimeCorrectionThreshold(4, 10, "not_sure")).toBe(10);
    expect(resolveBedtimeCorrectionThreshold(4, 10, "steady")).toBe(10);
  });
});

describe("resolveBedtimeCorrectionAim", () => {
  it("aims at the middle of the target range by default", () => {
    expect(defaultBedtimeTargetMmol(4, 10)).toBe(7);
    expect(resolveBedtimeCorrectionAim(4, 10, "not_sure")).toBe(7);
    expect(resolveBedtimeCorrectionAim(4, 10, "steady")).toBe(7);
  });

  it("uses the user's own bedtime target when set", () => {
    expect(resolveBedtimeCorrectionAim(4, 10, "not_sure", 8)).toBe(8);
  });

  it("nudges the aim a little lower when the user usually rises overnight", () => {
    expect(resolveBedtimeCorrectionAim(4, 10, "rise")).toBeCloseTo(6.5);
    expect(resolveBedtimeCorrectionAim(4, 10, "rise", 5)).toBe(5);
  });

  it("nudges the aim a little higher (but never above the range) when the user usually falls overnight", () => {
    expect(resolveBedtimeCorrectionAim(4, 10, "fall")).toBe(8);
    expect(resolveBedtimeCorrectionAim(4, 10, "fall", 9.5)).toBe(10);
  });

  it("keeps a bedtime target inside the target range", () => {
    expect(resolveBedtimeCorrectionAim(4, 10, "not_sure", 3)).toBe(4);
    expect(resolveBedtimeCorrectionAim(4, 10, "not_sure", 14)).toBe(10);
  });
});

describe("bedtimeMinActionableDose", () => {
  it("is half a unit for pens and 0.2u for pumps", () => {
    expect(bedtimeMinActionableDose(1)).toBe(0.5);
    expect(bedtimeMinActionableDose(0.5)).toBe(0.5);
    expect(bedtimeMinActionableDose(0.05)).toBe(0.2);
  });
});

describe("bedtimeExtraCautionMultiplier", () => {
  it("returns a multiplier of 1 and no note when nothing is selected", () => {
    const result = bedtimeExtraCautionMultiplier({ exerciseOvernightCaution: false, hadAlcohol: false, recentHypos: false });
    expect(result.multiplier).toBe(1);
    expect(result.note).toBe("");
  });

  it("reduces the multiplier for each factor and stacks them multiplicatively", () => {
    const exerciseOnly = bedtimeExtraCautionMultiplier({ exerciseOvernightCaution: true, hadAlcohol: false, recentHypos: false });
    const alcoholOnly = bedtimeExtraCautionMultiplier({ exerciseOvernightCaution: false, hadAlcohol: true, recentHypos: false });
    const hypoOnly = bedtimeExtraCautionMultiplier({ exerciseOvernightCaution: false, hadAlcohol: false, recentHypos: true });
    const all = bedtimeExtraCautionMultiplier({ exerciseOvernightCaution: true, hadAlcohol: true, recentHypos: true });

    expect(exerciseOnly.multiplier).toBeCloseTo(0.85);
    expect(alcoholOnly.multiplier).toBeCloseTo(0.85);
    expect(hypoOnly.multiplier).toBeCloseTo(0.8);
    expect(all.multiplier).toBeCloseTo(0.85 * 0.85 * 0.8);
    expect(all.multiplier).toBeLessThan(Math.min(exerciseOnly.multiplier, alcoholOnly.multiplier, hypoOnly.multiplier));
  });

  it("names every active factor in the note, in a readable list", () => {
    const one = bedtimeExtraCautionMultiplier({ exerciseOvernightCaution: true, hadAlcohol: false, recentHypos: false });
    expect(one.note).toBe("Made more cautious for recent or harder exercise.");

    const two = bedtimeExtraCautionMultiplier({ exerciseOvernightCaution: true, hadAlcohol: true, recentHypos: false });
    expect(two.note).toBe("Made more cautious for recent or harder exercise and alcohol.");

    const three = bedtimeExtraCautionMultiplier({ exerciseOvernightCaution: true, hadAlcohol: true, recentHypos: true });
    expect(three.note).toBe("Made more cautious for recent or harder exercise, alcohol, and a recent hypo.");
  });
});

describe("calculateBedtimeCorrectionDose", () => {
  const base = {
    bgMmol: 17,
    targetLowMmol: 4,
    targetHighMmol: 8,
    correctionFactor: 1,
    bgUnits: "mmol/L" as const,
    insulinHours: 5,
    overnightUsualTrend: "not_sure" as const,
    exerciseOvernightCaution: false,
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
      correctionFactor: 3,
      bgTrend: "falling",
    });
    expect(tooSmall.status).toBe("dose_too_small");
  });

  it("corrects towards the middle of the range, not the top, once above the threshold", () => {
    const result = calculateBedtimeCorrectionDose({ ...base, bgTrend: "steady" });
    expect(result.status).toBe("dose");
    if (result.status !== "dose") return;
    expect(result.targetBg).toBe(6);
    expect(result.fullDose).toBe(11);
  });

  it("uses the user's bedtime target for the aim but not for when to start correcting", () => {
    const aimed = calculateBedtimeCorrectionDose({ ...base, bgTrend: "steady", bedtimeTargetMmol: 5 });
    const defaultAim = calculateBedtimeCorrectionDose({ ...base, bgTrend: "steady" });
    expect(aimed.status).toBe("dose");
    if (aimed.status !== "dose" || defaultAim.status !== "dose") return;
    expect(aimed.targetBg).toBe(5);
    expect(aimed.suggestedDose).toBeGreaterThan(defaultAim.suggestedDose);

    const inRange = calculateBedtimeCorrectionDose({ ...base, bgMmol: 7.5, bgTrend: "steady", bedtimeTargetMmol: 5 });
    expect(inRange.status).toBe("no_correction_needed");
  });

  it("gives the same dose in mg/dL as in mmol/L", () => {
    const mmol = calculateBedtimeCorrectionDose({ ...base, bgTrend: "steady" });
    // Correction factor is entered in the user's own units.
    const mgdl = calculateBedtimeCorrectionDose({ ...base, bgUnits: "mg/dL", correctionFactor: 18, bgTrend: "steady" });
    expect(mmol.status).toBe("dose");
    expect(mgdl.status).toBe("dose");
    if (mmol.status !== "dose" || mgdl.status !== "dose") return;
    expect(mgdl.suggestedDose).toBe(mmol.suggestedDose);
    expect(mgdl.targetBg).toBe(108);
    expect(mgdl.currentBg).toBe(306);
  });

  it("rounds once, so a pen does not lose a unit to double rounding", () => {
    // Exact full dose 2.4u × 0.65 share = 1.56u → 2u. Rounding the full dose first (2u × 0.65 = 1.3u) gave 1u.
    const result = calculateBedtimeCorrectionDose({
      ...base,
      bgMmol: 13.2,
      targetLowMmol: 4,
      targetHighMmol: 8,
      correctionFactor: 3,
      bgTrend: "steady",
    });
    expect(result.status).toBe("dose");
    if (result.status !== "dose") return;
    expect(result.suggestedDose).toBe(2);
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
      exerciseOvernightCaution: false,
      hadAlcohol: false,
      recentHypos: false,
      sickDayActive: false,
    };

    it("without a known overnight pattern, gives a small real dose aimed at the middle of the range", () => {
      const result = calculateBedtimeCorrectionDose({ ...reported, overnightUsualTrend: "not_sure" });
      expect(result.status).toBe("dose");
      if (result.status !== "dose") return;
      expect(result.targetBg).toBe(7);
      expect(result.suggestedDose).toBe(1);
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
        exerciseOvernightCaution: false,
        hadAlcohol: false,
        recentHypos: false,
      });
      expect(doseOf(baseline)).toBe(9);
    });

    it("exercise alone lowers the suggested dose", () => {
      const result = calculateBedtimeCorrectionDose({
        ...highBg,
        exerciseOvernightCaution: true,
        hadAlcohol: false,
        recentHypos: false,
      });
      expect(doseOf(result)).toBe(8);
    });

    it("alcohol alone lowers the suggested dose", () => {
      const result = calculateBedtimeCorrectionDose({
        ...highBg,
        exerciseOvernightCaution: false,
        hadAlcohol: true,
        recentHypos: false,
      });
      expect(doseOf(result)).toBe(8);
    });

    it("recent hypos alone lowers the suggested dose (more than exercise or alcohol alone)", () => {
      const result = calculateBedtimeCorrectionDose({
        ...highBg,
        exerciseOvernightCaution: false,
        hadAlcohol: false,
        recentHypos: true,
      });
      expect(doseOf(result)).toBe(7);
    });

    it("stacks all three for an even more cautious dose, while the severity floor still keeps it well above zero", () => {
      const result = calculateBedtimeCorrectionDose({
        ...highBg,
        exerciseOvernightCaution: true,
        hadAlcohol: true,
        recentHypos: true,
      });
      expect(doseOf(result)).toBe(6);
      expect(doseOf(result)).toBeGreaterThan(0);
      if (result.status !== "dose") throw new Error("expected a dose");
      expect(result.exerciseWarning).toMatch(/exercise/i);
      expect(result.alcoholWarning).toMatch(/alcohol/i);
      expect(result.hypoWarning).toMatch(/hypo/i);
      expect(result.extraCautionNote).toBe("Made more cautious for recent or harder exercise, alcohol, and a recent hypo.");
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
        overnightUsualTrend: "fall" as const,
        exerciseOvernightCaution: false,
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
      exerciseOvernightCaution: true,
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
      // exerciseOvernightCaution is turned off here since this test is isolating the severity-floor
      // behaviour, not the extra-caution reduction (covered separately above).
      const mild = calculateBedtimeCorrectionDose({
        ...severe,
        bgMmol: 12,
        insulinHours: 5,
        overnightUsualTrend: "not_sure" as const,
        exerciseOvernightCaution: false,
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

  describe("high bedtime reading with alcohol, IOB, and a usual overnight rise", () => {
    // Reported: 15.4 mmol/L, stable, alcohol, insulin in the last couple of hours, usual overnight
    // rise. Stacked caution used to land around 33% / 2u — too small if levels typically climb.
    const reported = {
      bgMmol: 15.4,
      targetLowMmol: 4,
      targetHighMmol: 10,
      correctionFactor: 1.65,
      bgUnits: "mmol/L" as const,
      insulinHours: 1.5,
      bgTrend: "steady" as const,
      overnightUsualTrend: "rise" as const,
      exerciseOvernightCaution: false,
      hadAlcohol: true,
      recentHypos: false,
      sickDayActive: false,
    };

    it("keeps a meaningful share of the full correction instead of ~33%", () => {
      const result = calculateBedtimeCorrectionDose(reported);
      expect(result.status).toBe("dose");
      if (result.status !== "dose") return;
      expect(result.pctOfFullDose).toBeGreaterThanOrEqual(45);
      expect(result.suggestedDose).toBeGreaterThanOrEqual(3);
      expect(result.alcoholWarning).toMatch(/alcohol/i);
      expect(result.iobWarning).toMatch(/insulin/i);
    });

    it("is still more cautious than the same night without alcohol", () => {
      const withAlcohol = calculateBedtimeCorrectionDose(reported);
      const without = calculateBedtimeCorrectionDose({ ...reported, hadAlcohol: false });
      expect(withAlcohol.status).toBe("dose");
      expect(without.status).toBe("dose");
      if (withAlcohol.status !== "dose" || without.status !== "dose") return;
      expect(withAlcohol.suggestedDose).toBeLessThanOrEqual(without.suggestedDose);
    });
  });

  it("subtracts pump IOB from the full dose instead of using hours-since-insulin", () => {
    const noIob = calculateBedtimeCorrectionDose({ ...base, bgTrend: "steady", insulinHours: 5 });
    const withIob = calculateBedtimeCorrectionDose({
      ...base,
      bgTrend: "steady",
      insulinHours: 5,
      pumpIobUnits: 2,
    });
    expect(noIob.status).toBe("dose");
    expect(withIob.status).toBe("dose");
    if (noIob.status !== "dose" || withIob.status !== "dose") return;
    expect(withIob.suggestedDose).toBeLessThan(noIob.suggestedDose);
    expect(withIob.iobWarning).toMatch(/IOB/i);
    expect(withIob.hasIOB).toBe(true);
  });

  it("reports dose_too_small when pump IOB covers the standard correction", () => {
    const result = calculateBedtimeCorrectionDose({
      ...base,
      bgTrend: "steady",
      bgMmol: 10,
      targetHighMmol: 8,
      correctionFactor: 3,
      pumpIobUnits: 8,
    });
    expect(result.status).toBe("dose_too_small");
    if (result.status !== "dose_too_small") return;
    expect(result.note).toMatch(/IOB already covers/i);
  });

  it("does not shrink the dose for light daily training that is not overnight-caution exercise", () => {
    const params = {
      bgMmol: 20,
      targetLowMmol: 4,
      targetHighMmol: 8,
      correctionFactor: 1,
      bgUnits: "mmol/L" as const,
      insulinHours: 5,
      bgTrend: "steady" as const,
      overnightUsualTrend: "not_sure" as const,
      hadAlcohol: false,
      recentHypos: false,
      sickDayActive: false,
    };
    const light = calculateBedtimeCorrectionDose({ ...params, exerciseOvernightCaution: false });
    const harder = calculateBedtimeCorrectionDose({ ...params, exerciseOvernightCaution: true });
    expect(light.status).toBe("dose");
    expect(harder.status).toBe("dose");
    if (light.status !== "dose" || harder.status !== "dose") return;
    expect(light.extraCautionMultiplier).toBe(1);
    expect(harder.extraCautionMultiplier).toBeCloseTo(0.85);
    expect(harder.suggestedDose).toBeLessThan(light.suggestedDose);
    expect(light.exerciseWarning).toBe("");
    expect(light.extraCautionNote).toBe("");
  });

  describe("personal adjustment from similar nights", () => {
    const steady = { ...base, bgTrend: "steady" as const };

    it("scales the cautious dose and keeps the base dose for logging", () => {
      const plain = calculateBedtimeCorrectionDose(steady);
      const up = calculateBedtimeCorrectionDose({
        ...steady,
        personalAdjustment: { multiplier: 1.2, reason: "Adjusted up 20%: on 2 similar nights you ended above 8." },
      });
      expect(plain.status).toBe("dose");
      expect(up.status).toBe("dose");
      if (plain.status !== "dose" || up.status !== "dose") return;
      expect(up.baseSuggestedDose).toBe(plain.suggestedDose);
      expect(up.suggestedDose).toBeGreaterThan(plain.suggestedDose);
      expect(up.personalAdjustment).toBeCloseTo(1.2);
      expect(up.personalAdjustmentNote).toMatch(/Adjusted up 20%/);
      expect(plain.personalAdjustment).toBe(1);
      expect(plain.personalAdjustmentNote).toBe("");
    });

    it("never goes above a full correction to the bedtime target", () => {
      // Rising + very high: the caution share is already 90%, so +30% would overshoot.
      const result = calculateBedtimeCorrectionDose({
        ...base,
        bgTrend: "rising",
        personalAdjustment: { multiplier: 1.3, reason: "Adjusted up 30%." },
      });
      expect(result.status).toBe("dose");
      if (result.status !== "dose") return;
      expect(result.suggestedDose).toBeLessThanOrEqual(result.fullDose);
      expect(result.personalAdjustment).toBeLessThan(1.3);
      expect(result.personalAdjustmentNote).toMatch(/Capped at a full correction/);
    });

    it("never goes above the full correction after pump IOB", () => {
      const result = calculateBedtimeCorrectionDose({
        ...base,
        bgTrend: "rising",
        pumpIobUnits: 4,
        roundIncrement: 0.05,
        personalAdjustment: { multiplier: 1.3, reason: "Adjusted up 30%." },
      });
      expect(result.status).toBe("dose");
      if (result.status !== "dose") return;
      expect(result.suggestedDose).toBeLessThanOrEqual(11 - 4);
    });

    it("clamps out-of-range multipliers to 0.7–1.3", () => {
      const huge = calculateBedtimeCorrectionDose({ ...steady, personalAdjustment: { multiplier: 5, reason: "x" } });
      const tiny = calculateBedtimeCorrectionDose({ ...steady, personalAdjustment: { multiplier: 0.1, reason: "x" } });
      if (huge.status !== "dose" || tiny.status !== "dose") throw new Error("expected doses");
      expect(huge.personalAdjustment).toBeLessThanOrEqual(1.3);
      expect(tiny.personalAdjustment).toBeCloseTo(0.7);
    });

    it("is ignored on sick days", () => {
      const result = calculateBedtimeCorrectionDose({
        ...steady,
        sickDayActive: true,
        personalAdjustment: { multiplier: 1.3, reason: "Adjusted up 30%." },
      });
      if (result.status !== "dose") throw new Error("expected a dose");
      expect(result.personalAdjustment).toBe(1);
      expect(result.suggestedDose).toBe(result.baseSuggestedDose);
    });
  });

  it("lets pump users take small corrections of 0.2u or more", () => {
    const result = calculateBedtimeCorrectionDose({
      bgMmol: 9.2,
      targetLowMmol: 4,
      targetHighMmol: 8,
      correctionFactor: 4,
      bgUnits: "mmol/L",
      insulinHours: 5,
      bgTrend: "falling",
      overnightUsualTrend: "not_sure",
      exerciseOvernightCaution: false,
      hadAlcohol: false,
      recentHypos: false,
      sickDayActive: false,
      roundIncrement: 0.05,
    });
    expect(result.status).toBe("dose");
    if (result.status !== "dose") return;
    expect(result.suggestedDose).toBeGreaterThanOrEqual(0.2);
    expect(result.suggestedDose).toBeLessThan(0.5);
  });

  it("treats pump suggestions under 0.2u as too small instead of recommending a micro-dose", () => {
    const result = calculateBedtimeCorrectionDose({
      bgMmol: 8.2,
      targetLowMmol: 4,
      targetHighMmol: 8,
      correctionFactor: 4,
      bgUnits: "mmol/L",
      insulinHours: 5,
      bgTrend: "falling",
      overnightUsualTrend: "not_sure",
      exerciseOvernightCaution: false,
      hadAlcohol: false,
      recentHypos: false,
      sickDayActive: false,
      roundIncrement: 0.05,
    });
    expect(result.status).toBe("dose_too_small");
    if (result.status !== "dose_too_small") return;
    expect(result.rawDose).toBeGreaterThan(0);
    expect(result.rawDose).toBeLessThanOrEqual(0.2);
    expect(result.note).toMatch(/less than 0\.2u/i);
    expect(result.note).toMatch(/recheck/i);
  });
});

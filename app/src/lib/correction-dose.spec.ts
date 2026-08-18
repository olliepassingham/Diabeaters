import { describe, expect, it } from "vitest";
import {
  computeSimpleCorrectionDose,
  getDefaultCorrectionTargetHigh,
} from "./correction-dose";

describe("computeSimpleCorrectionDose", () => {
  it("returns invalid_isf when correction factor is missing or non-positive", () => {
    expect(
      computeSimpleCorrectionDose({
        currentBg: 12,
        targetBg: 8,
        correctionFactor: 0,
        bgUnits: "mmol/L",
      }),
    ).toEqual({ status: "invalid_isf" });
    expect(
      computeSimpleCorrectionDose({
        currentBg: 12,
        targetBg: 8,
        correctionFactor: -2,
        bgUnits: "mmol/L",
      }),
    ).toEqual({ status: "invalid_isf" });
  });

  it("returns no_correction_needed when BG is at or below target", () => {
    expect(
      computeSimpleCorrectionDose({
        currentBg: 8,
        targetBg: 8,
        correctionFactor: 3,
        bgUnits: "mmol/L",
      }).status,
    ).toBe("no_correction_needed");
    expect(
      computeSimpleCorrectionDose({
        currentBg: 7,
        targetBg: 8,
        correctionFactor: 3,
        bgUnits: "mmol/L",
      }).status,
    ).toBe("no_correction_needed");
  });

  it("computes mmol/L example: diff 6 / ISF 3 = 2.0 units", () => {
    const r = computeSimpleCorrectionDose({
      currentBg: 14,
      targetBg: 8,
      correctionFactor: 3,
      bgUnits: "mmol/L",
    });
    expect(r.status).toBe("dose");
    if (r.status === "dose") {
      expect(r.fullDoseRounded).toBe(2);
      expect(r.exactDose).toBe(2);
      expect(r.diff).toBe(6);
    }
  });

  it("computes mg/dL example and rounds full dose to whole units", () => {
    const r = computeSimpleCorrectionDose({
      currentBg: 250,
      targetBg: 144,
      correctionFactor: 50,
      bgUnits: "mg/dL",
    });
    expect(r.status).toBe("dose");
    if (r.status === "dose") {
      expect(r.diff).toBe(106);
      expect(r.fullDoseRounded).toBe(2);
    }
  });

  it("rounds pump corrections to 0.05u", () => {
    const r = computeSimpleCorrectionDose({
      currentBg: 12.2,
      targetBg: 8,
      correctionFactor: 3,
      bgUnits: "mmol/L",
      roundIncrement: 0.05,
    });
    expect(r.status).toBe("dose");
    if (r.status === "dose") {
      expect(r.exactDose).toBeCloseTo(1.4);
      expect(r.fullDoseRounded).toBe(1.4);
    }
  });
});

describe("getDefaultCorrectionTargetHigh", () => {
  it("uses settings when set", () => {
    expect(getDefaultCorrectionTargetHigh({ targetBgHigh: 7 }, "mmol/L")).toBe(7);
    expect(getDefaultCorrectionTargetHigh({ targetBgHigh: 140 }, "mg/dL")).toBe(140);
  });

  it("falls back to app defaults when unset", () => {
    expect(getDefaultCorrectionTargetHigh({}, "mmol/L")).toBe(8.0);
    expect(getDefaultCorrectionTargetHigh({}, "mg/dL")).toBe(144);
  });
});

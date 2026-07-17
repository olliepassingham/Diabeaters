import { describe, expect, it } from "vitest";
import {
  classifyGlucoseTirBand,
  computeGlucoseWindowSummary,
  percentsFromCounts,
} from "./window-summary";

describe("classifyGlucoseTirBand", () => {
  it("uses consensus extremes and user targets (mmol)", () => {
    expect(classifyGlucoseTirBand(2.8, 4, 10, "mmol/L")).toBe("very_low");
    expect(classifyGlucoseTirBand(3.5, 4, 10, "mmol/L")).toBe("low");
    expect(classifyGlucoseTirBand(7, 4, 10, "mmol/L")).toBe("in_range");
    expect(classifyGlucoseTirBand(12, 4, 10, "mmol/L")).toBe("high");
    expect(classifyGlucoseTirBand(15, 4, 10, "mmol/L")).toBe("very_high");
  });

  it("uses mg/dL extremes", () => {
    expect(classifyGlucoseTirBand(50, 70, 180, "mg/dL")).toBe("very_low");
    expect(classifyGlucoseTirBand(260, 70, 180, "mg/dL")).toBe("very_high");
  });
});

describe("percentsFromCounts", () => {
  it("sums to 100 with largest-remainder rounding", () => {
    const percents = percentsFromCounts(
      { very_low: 1, low: 1, in_range: 5, high: 2, very_high: 1 },
      10,
    );
    expect(Object.values(percents).reduce((a, b) => a + b, 0)).toBe(100);
    expect(percents.in_range).toBe(50);
  });
});

describe("computeGlucoseWindowSummary", () => {
  it("returns null for empty input", () => {
    expect(computeGlucoseWindowSummary([], 4, 10, "mmol/L")).toBeNull();
  });

  it("computes average and band percents for a window", () => {
    // 2.8 VL, 3.5 L, 5 IR, 6 IR, 12 H, 15 VH → avg (2.8+3.5+5+6+12+15)/6 = 7.383 → 7.4
    const summary = computeGlucoseWindowSummary([2.8, 3.5, 5, 6, 12, 15], 4, 10, "mmol/L");
    expect(summary).not.toBeNull();
    expect(summary!.sampleCount).toBe(6);
    expect(summary!.average).toBe(7.4);
    expect(summary!.counts).toEqual({
      very_low: 1,
      low: 1,
      in_range: 2,
      high: 1,
      very_high: 1,
    });
    expect(Object.values(summary!.percents).reduce((a, b) => a + b, 0)).toBe(100);
    expect(summary!.percents.in_range).toBe(33);
  });

  it("rounds mg/dL averages to whole numbers", () => {
    const summary = computeGlucoseWindowSummary([100, 110, 120], 70, 180, "mg/dL");
    expect(summary!.average).toBe(110);
  });
});

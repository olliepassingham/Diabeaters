import { describe, expect, it } from "vitest";

import {
  computeHypoCarbEquivalents,
  formatFastCarbsWithPrimaryTreatment,
  formatPrimaryTreatmentShort,
  normalizePrimaryHypoTreatment,
} from "./hypo-treatment-display";

describe("hypo-treatment-display", () => {
  it("computes tablet and juice equivalents from carbs", () => {
    const eq = computeHypoCarbEquivalents(15);
    expect(eq.carbsGrams).toBe(15);
    expect(eq.glucoseTablets).toBe(4);
    expect(eq.juiceMl).toBe(150);
    expect(eq.jellyBabies).toBe(3);
  });

  it("formats primary treatment short line", () => {
    expect(formatPrimaryTreatmentShort(15, "glucose_tablets")).toBe("about 4 glucose tablets");
    expect(formatPrimaryTreatmentShort(15, "other")).toBeNull();
  });

  it("formats fast carbs with primary treatment", () => {
    expect(formatFastCarbsWithPrimaryTreatment(15, "juice")).toContain("150");
    expect(formatFastCarbsWithPrimaryTreatment(15, undefined)).toBe("~15g fast carbs");
  });

  it("normalizes stored treatment id", () => {
    expect(normalizePrimaryHypoTreatment("glucose_tablets")).toBe("glucose_tablets");
    expect(normalizePrimaryHypoTreatment("invalid")).toBeUndefined();
  });
});

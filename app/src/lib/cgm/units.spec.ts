import { describe, expect, it } from "vitest";
import { convertGlucoseValue, mgDlToMmol, mmolToMgDl } from "@/lib/cgm/units";

describe("cgm units", () => {
  it("converts mg/dL to mmol/L", () => {
    expect(mgDlToMmol(90)).toBe(5);
  });

  it("converts mmol/L to mg/dL", () => {
    expect(mmolToMgDl(5)).toBe(90);
  });

  it("convertGlucoseValue is identity on same units", () => {
    expect(convertGlucoseValue(6.2, "mmol/L", "mmol/L")).toBe(6.2);
  });
});

import { describe, expect, it } from "vitest";

import {
  formatWeightInputFromKg,
  formatWeightLabel,
  getBodyWeightKgFromProfile,
  parseWeightInputToKg,
  resolveHypoCalculatorWeightKg,
} from "./body-weight";
import type { UserProfile } from "./storage";

describe("body-weight", () => {
  it("parses kg and lbs to kg", () => {
    expect(parseWeightInputToKg("70", "kg")).toBeCloseTo(70, 5);
    expect(parseWeightInputToKg("154", "lbs")).toBeCloseTo(69.85, 1);
  });

  it("reads stored profile weight", () => {
    const profile: Partial<UserProfile> = { bodyWeightKg: 62, weightDisplayUnit: "kg" };
    expect(getBodyWeightKgFromProfile(profile)).toBe(62);
    expect(formatWeightLabel(62, "kg")).toBe("62 kg");
    expect(formatWeightInputFromKg(62, "kg")).toBe("62");
  });

  it("uses profile weight when useProfileWeight is true", () => {
    const result = resolveHypoCalculatorWeightKg({
      profile: { bodyWeightKg: 55, dateOfBirth: "2010-01-01" },
      useProfileWeight: true,
      inputValue: "",
      inputUnit: "kg",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.weightKg).toBe(55);
      expect(result.fromProfile).toBe(true);
    }
  });

  it("requires explicit weight for unknown DOB when not on profile", () => {
    const result = resolveHypoCalculatorWeightKg({
      profile: { dateOfBirth: "" },
      useProfileWeight: false,
      inputValue: "",
      inputUnit: "kg",
    });
    expect(result.ok).toBe(false);
  });

  it("defaults to 70 kg for adults without profile or input", () => {
    const result = resolveHypoCalculatorWeightKg({
      profile: { dateOfBirth: "1990-06-01" },
      useProfileWeight: false,
      inputValue: "",
      inputUnit: "kg",
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.weightKg).toBe(70);
  });
});

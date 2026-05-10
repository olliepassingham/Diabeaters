import { describe, expect, it } from "vitest";
import { defaultCarerScopesForAgeBand, defaultCarerScopesFromProfileDob } from "./carer-scopes-by-age";

describe("defaultCarerScopesForAgeBand", () => {
  it("enables clinical_settings for child band", () => {
    const s = defaultCarerScopesForAgeBand("child");
    expect(s.clinical_settings).toBe(true);
    expect(s.supplies).toBe(true);
    expect(s.emergency_info).toBe(true);
  });

  it("keeps clinical_settings off for teen, adult, unknown", () => {
    for (const b of ["teen", "adult", "unknown"] as const) {
      expect(defaultCarerScopesForAgeBand(b).clinical_settings).toBe(false);
    }
  });
});

describe("defaultCarerScopesFromProfileDob", () => {
  it("treats under-13 DOB as child preset", () => {
    const s = defaultCarerScopesFromProfileDob("2016-01-15");
    expect(s.clinical_settings).toBe(true);
  });

  it("treats missing DOB as unknown (clinical off)", () => {
    expect(defaultCarerScopesFromProfileDob(null).clinical_settings).toBe(false);
    expect(defaultCarerScopesFromProfileDob("").clinical_settings).toBe(false);
  });
});

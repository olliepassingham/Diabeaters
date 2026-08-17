import { describe, expect, it } from "vitest";
import {
  checkInPatientPrompt,
  checkInResponseBody,
  formatCheckInStatusLabel,
  parseGlucoseConcern,
  shouldOfferLogHypo,
} from "./hypo-check-in-copy";

describe("hypo-check-in-copy", () => {
  it("treats missing or in-range context as unknown", () => {
    expect(parseGlucoseConcern(null)).toBe("unknown");
    expect(parseGlucoseConcern("in_range")).toBe("unknown");
    expect(parseGlucoseConcern("high")).toBe("high");
    expect(parseGlucoseConcern("low")).toBe("low");
  });

  it("asks about a low or high only when that is the concern", () => {
    expect(checkInPatientPrompt("Sam", "low")).toContain("possible low");
    expect(checkInPatientPrompt("Sam", "high")).toContain("possible high");
    expect(checkInPatientPrompt("Sam", "unknown")).toBe("Sam is checking you're OK.");
    expect(checkInPatientPrompt("Sam", "high")).not.toMatch(/hypo/i);
  });

  it("never says hypo when they are sorting a high", () => {
    expect(checkInResponseBody("Ollie", "treating", "high")).toBe("Ollie is sorting a high");
    expect(checkInResponseBody("Ollie", "treating", "low")).toBe("Ollie is sorting a low");
    expect(checkInResponseBody("Ollie", "treating", "unknown")).toBe("Ollie is sorting it");
    expect(checkInResponseBody("Ollie", "ok", "high")).toBe("Ollie replied they're OK");
  });

  it("labels supporter status without assuming hypo", () => {
    expect(formatCheckInStatusLabel("treating", "high")).toBe("They're sorting a high");
    expect(formatCheckInStatusLabel("treating", "unknown")).toBe("They're sorting it");
    expect(formatCheckInStatusLabel("treating", "low")).toBe("They're sorting a low");
  });

  it("hides log-hypo when the concern is a high", () => {
    expect(shouldOfferLogHypo("high")).toBe(false);
    expect(shouldOfferLogHypo("low")).toBe(true);
    expect(shouldOfferLogHypo("unknown")).toBe(true);
  });
});

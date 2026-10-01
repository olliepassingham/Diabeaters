import { describe, expect, it } from "vitest";

import { resolveHomeGlucoseAttention, resolveHomeStatusPill } from "./home-glucose-attention";

describe("resolveHomeGlucoseAttention", () => {
  const line = { bgUnits: "mmol/L" as const, lowLine: 3.9, highLine: 10 };

  it("treats a reading on or under the low line as low", () => {
    expect(resolveHomeGlucoseAttention({ ...line, bg: 3.7, trend: "flat" })).toBe("low");
    expect(resolveHomeGlucoseAttention({ ...line, bg: 3.9, trend: "rising" })).toBe("low");
  });

  it("treats a falling reading just above the line as dropping", () => {
    expect(resolveHomeGlucoseAttention({ ...line, bg: 4.3, trend: "falling" })).toBe("dropping");
  });

  it("leaves a falling reading that is still comfortably in range alone", () => {
    expect(resolveHomeGlucoseAttention({ ...line, bg: 6.2, trend: "falling" })).toBeNull();
  });

  it("marks a reading above the saved high line", () => {
    expect(resolveHomeGlucoseAttention({ ...line, bg: 12, trend: "flat" })).toBe("high");
  });
});

describe("resolveHomeStatusPill", () => {
  it("says Low beside a hypo reading even when supplies are calm", () => {
    expect(resolveHomeStatusPill("stable", "low")).toEqual({ status: "action", label: "Low" });
  });

  it("keeps a supply warning when glucose is in range", () => {
    expect(resolveHomeStatusPill("action", null)).toEqual({ status: "action", label: "Action needed" });
    expect(resolveHomeStatusPill("stable", null).label).toBe("Stable");
  });
});

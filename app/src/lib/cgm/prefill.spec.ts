import { describe, expect, it } from "vitest";
import { bgPrefillFromReading } from "@/lib/cgm/prefill";
import type { GlucoseReading } from "@/lib/cgm/types";

describe("bgPrefillFromReading", () => {
  it("formats value and includes source label", () => {
    const reading: GlucoseReading = {
      value: 5.6,
      units: "mmol/L",
      recordedAt: new Date().toISOString(),
      source: "health_platform",
      sourceLabel: "Dexcom via Apple Health",
      trend: null,
      ageMinutes: 10,
      isStale: false,
      stalenessNote: null,
    };
    const out = bgPrefillFromReading(reading);
    expect(out.value).toBe("5.6");
    expect(out.fromCgm).toBe(true);
    expect(out.source).toContain("Dexcom via Apple Health");
  });
});

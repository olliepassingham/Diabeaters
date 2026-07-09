import { describe, expect, it } from "vitest";
import { bgFieldMatchesCgm } from "@/components/cgm-reading-source-note";
import type { BgPrefillResult } from "@/lib/cgm/prefill";

const dexcomPrefill: BgPrefillResult = {
  value: "7.2",
  source: "Dexcom Share · 3 min ago",
  fromCgm: true,
  reading: {
    value: 7.2,
    units: "mmol/L",
    recordedAt: new Date().toISOString(),
    source: "dexcom_share",
    sourceLabel: "Dexcom Share",
    trend: "flat",
    ageMinutes: 3,
    isStale: false,
    stalenessNote: null,
  },
};

describe("bgFieldMatchesCgm", () => {
  it("matches when field equals CGM value", () => {
    expect(bgFieldMatchesCgm("7.2", dexcomPrefill)).toBe(true);
    expect(bgFieldMatchesCgm("7,2", dexcomPrefill)).toBe(true);
  });

  it("does not match when user typed a different value", () => {
    expect(bgFieldMatchesCgm("8.1", dexcomPrefill)).toBe(false);
  });

  it("does not match manual prefill", () => {
    expect(
      bgFieldMatchesCgm("7.2", {
        value: "7.2",
        source: "Manual log",
        fromCgm: false,
      }),
    ).toBe(false);
  });
});

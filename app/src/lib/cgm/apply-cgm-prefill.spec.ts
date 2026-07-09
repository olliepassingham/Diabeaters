import { describe, expect, it, vi } from "vitest";
import { applyCgmPrefillToExercise, isFreshCgmPrefill } from "./apply-cgm-prefill";
import type { BgPrefillResult } from "./prefill";

describe("applyCgmPrefillToExercise", () => {
  it("applies value and exercise trend from CGM reading", () => {
    const onBg = vi.fn();
    const onTrend = vi.fn();
    const prefill: BgPrefillResult = {
      value: "7.2",
      source: "Dexcom Share · 2 min ago",
      fromCgm: true,
      reading: {
        value: 7.2,
        units: "mmol/L",
        recordedAt: new Date().toISOString(),
        source: "dexcom_share",
        sourceLabel: "Dexcom Share",
        trend: "falling",
        ageMinutes: 2,
        isStale: false,
        stalenessNote: null,
      },
    };

    applyCgmPrefillToExercise(prefill, onBg, onTrend);

    expect(onBg).toHaveBeenCalledWith("7.2");
    expect(onTrend).toHaveBeenCalledWith("falling");
  });
});

describe("isFreshCgmPrefill", () => {
  it("returns false for stale CGM readings", () => {
    const prefill: BgPrefillResult = {
      value: "5.0",
      source: "Dexcom Share",
      fromCgm: true,
      reading: {
        value: 5,
        units: "mmol/L",
        recordedAt: new Date().toISOString(),
        source: "dexcom_share",
        sourceLabel: "Dexcom Share",
        trend: "flat",
        ageMinutes: 400,
        isStale: true,
        stalenessNote: "Old",
      },
    };
    expect(isFreshCgmPrefill(prefill)).toBe(false);
  });
});

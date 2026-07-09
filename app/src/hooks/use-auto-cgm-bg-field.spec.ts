import { describe, expect, it } from "vitest";

import { isFreshCgmPrefill } from "@/lib/cgm/apply-cgm-prefill";
import type { BgPrefillResult } from "@/lib/cgm/prefill";

describe("useAutoCgmBgField helpers", () => {
  it("treats fresh CGM prefill as auto-applicable", () => {
    const prefill: BgPrefillResult = {
      value: "5.6",
      source: "Dexcom",
      fromCgm: true,
      reading: {
        value: 5.6,
        units: "mmol/L",
        recordedAt: new Date().toISOString(),
        source: "dexcom_share",
        sourceLabel: "Dexcom",
        trend: "flat",
        ageMinutes: 2,
        isStale: false,
        stalenessNote: null,
      },
    };
    expect(isFreshCgmPrefill(prefill)).toBe(true);
  });
});

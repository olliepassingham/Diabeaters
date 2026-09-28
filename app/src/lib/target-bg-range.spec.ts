import { describe, expect, it } from "vitest";
import { resolveUserTargetBgRange, targetBgRangeInputValues } from "./target-bg-range";
import type { UserSettings } from "@/lib/storage";

describe("resolveUserTargetBgRange", () => {
  it("uses settings when both bounds are set", () => {
    const settings: UserSettings = { targetBgLow: 4, targetBgHigh: 10 };
    expect(resolveUserTargetBgRange(settings, "mmol/L")).toEqual({ low: 4, high: 10 });
  });

  it("falls back to defaults when settings are missing", () => {
    expect(resolveUserTargetBgRange(undefined, "mmol/L")).toEqual({ low: 4, high: 10 });
    expect(resolveUserTargetBgRange(undefined, "mg/dL")).toEqual({ low: 72, high: 180 });
  });

  it("fills empty target fields with 4–10 or 72–180", () => {
    expect(targetBgRangeInputValues(undefined, "mmol/L")).toEqual({ low: "4", high: "10" });
    expect(targetBgRangeInputValues(undefined, "mg/dL")).toEqual({ low: "72", high: "180" });
    expect(targetBgRangeInputValues({ targetBgLow: 5, targetBgHigh: 9 }, "mmol/L")).toEqual({
      low: "5",
      high: "9",
    });
  });
});

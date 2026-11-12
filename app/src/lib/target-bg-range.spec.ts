import { describe, expect, it } from "vitest";
import { resolveUserTargetBgRange, targetBgRangeInputValues, validateBedtimeTargetBgInput } from "./target-bg-range";
import type { UserSettings } from "@/lib/storage";

describe("validateBedtimeTargetBgInput", () => {
  it("allows blank and values inside the range", () => {
    expect(validateBedtimeTargetBgInput({ bedtimeTargetBg: "", targetBgLow: "4", targetBgHigh: "10" }, "mmol/L")).toBeNull();
    expect(validateBedtimeTargetBgInput({ bedtimeTargetBg: "7.5", targetBgLow: "4", targetBgHigh: "10" }, "mmol/L")).toBeNull();
  });

  it("rejects values outside the range, using defaults when the range is blank", () => {
    expect(
      validateBedtimeTargetBgInput({ bedtimeTargetBg: "11", targetBgLow: "4", targetBgHigh: "10" }, "mmol/L"),
    ).toMatch(/within your target range/);
    expect(validateBedtimeTargetBgInput({ bedtimeTargetBg: "200", targetBgLow: "", targetBgHigh: "" }, "mg/dL")).toMatch(
      /72–180 mg\/dL/,
    );
    expect(validateBedtimeTargetBgInput({ bedtimeTargetBg: "abc", targetBgLow: "4", targetBgHigh: "10" }, "mmol/L")).toMatch(
      /Enter a number/,
    );
  });
});

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

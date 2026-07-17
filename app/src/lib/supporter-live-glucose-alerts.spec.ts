import { describe, expect, it } from "vitest";
import {
  computeSupporterLiveGlucoseAlertStatus,
  DEFAULT_SUPPORTER_LIVE_GLUCOSE_ALERT_HIGH_MMOL,
  DEFAULT_SUPPORTER_LIVE_GLUCOSE_ALERT_LOW_MMOL,
  mmolToDisplayBg,
  resolveSupporterLiveGlucoseAlertLimitsFromPrefs,
  resolveSupporterLiveGlucoseAlertLimitsMmol,
} from "./supporter-live-glucose-alerts";

describe("supporter live glucose alert limits", () => {
  it("defaults to 3.5 / 14 mmol/L", () => {
    expect(resolveSupporterLiveGlucoseAlertLimitsMmol(undefined)).toEqual({
      low: DEFAULT_SUPPORTER_LIVE_GLUCOSE_ALERT_LOW_MMOL,
      high: DEFAULT_SUPPORTER_LIVE_GLUCOSE_ALERT_HIGH_MMOL,
    });
    expect(resolveSupporterLiveGlucoseAlertLimitsFromPrefs({})).toEqual({ low: 3.5, high: 14 });
  });

  it("alerts only past supporter extremes, not patient target band", () => {
    const low = 3.5;
    const high = 14;
    // Patient target might be 4–10; 3.8 is below target but not extreme
    expect(computeSupporterLiveGlucoseAlertStatus(3.8, "mmol/L", low, high)).toBe("ok");
    expect(computeSupporterLiveGlucoseAlertStatus(11, "mmol/L", low, high)).toBe("ok");
    expect(computeSupporterLiveGlucoseAlertStatus(3.4, "mmol/L", low, high)).toBe("extreme_low");
    expect(computeSupporterLiveGlucoseAlertStatus(14.1, "mmol/L", low, high)).toBe("extreme_high");
    expect(computeSupporterLiveGlucoseAlertStatus(3.5, "mmol/L", low, high)).toBe("ok");
    expect(computeSupporterLiveGlucoseAlertStatus(14, "mmol/L", low, high)).toBe("ok");
  });

  it("compares mg/dL readings against mmol limits", () => {
    // 3.4 mmol ≈ 61 mg/dL
    expect(computeSupporterLiveGlucoseAlertStatus(61, "mg/dL", 3.5, 14)).toBe("extreme_low");
    // 14.1 mmol ≈ 254 mg/dL
    expect(computeSupporterLiveGlucoseAlertStatus(254, "mg/dL", 3.5, 14)).toBe("extreme_high");
    expect(computeSupporterLiveGlucoseAlertStatus(100, "mg/dL", 3.5, 14)).toBe("ok");
  });

  it("converts defaults for display", () => {
    expect(mmolToDisplayBg(3.5, "mg/dL")).toBe(63);
    expect(mmolToDisplayBg(14, "mg/dL")).toBe(252);
  });
});

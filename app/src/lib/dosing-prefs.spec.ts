import { describe, expect, it } from "vitest";
import { buildDosingPrefs, parseDosingPrefs, shouldApplyCloudDosingPrefs } from "./dosing-prefs";

describe("dosing prefs", () => {
  it("parses an account payload", () => {
    const parsed = parseDosingPrefs({
      dinnerRatio: "10",
      correctionFactor: 3,
      targetBgLow: 4,
      targetBgHigh: 10,
      bodyWeightKg: 70,
      weightDisplayUnit: "kg",
      updatedAt: "2026-10-09T12:00:00.000Z",
    });
    expect(parsed?.dinnerRatio).toBe("10");
    expect(parsed?.bodyWeightKg).toBe(70);
  });

  it("restores onto an empty phone and keeps a phone that already has numbers", () => {
    expect(
      shouldApplyCloudDosingPrefs({
        localHasValues: false,
        cloudUpdatedAt: "2026-10-09T12:00:00.000Z",
      }),
    ).toBe(true);
    expect(
      shouldApplyCloudDosingPrefs({
        localHasValues: true,
        cloudUpdatedAt: "2026-10-09T12:00:00.000Z",
      }),
    ).toBe(false);
    expect(
      shouldApplyCloudDosingPrefs({
        localUpdatedAt: "2026-10-09T13:00:00.000Z",
        localHasValues: true,
        cloudUpdatedAt: "2026-10-09T12:00:00.000Z",
      }),
    ).toBe(false);
  });

  it("builds a payload from local settings and weight", () => {
    const prefs = buildDosingPrefs({
      settings: { dinnerRatio: "10", correctionFactor: 3, targetBgLow: 4, targetBgHigh: 10 },
      bodyWeightKg: 70,
      weightDisplayUnit: "kg",
      updatedAt: "2026-10-09T12:00:00.000Z",
    });
    expect(prefs.dinnerRatio).toBe("10");
    expect(prefs.bodyWeightKg).toBe(70);
    expect(prefs.breakfastRatio).toBeNull();
    expect(prefs.bedtimeTargetBg).toBeNull();
    expect(prefs.bedtimeLearningEnabled).toBeNull();
  });

  it("round-trips the bedtime target and learning switch", () => {
    const prefs = buildDosingPrefs({
      settings: { targetBgLow: 4, targetBgHigh: 10, bedtimeTargetBg: 7.5, bedtimeLearningEnabled: true },
      updatedAt: "2026-10-09T12:00:00.000Z",
    });
    const parsed = parseDosingPrefs(JSON.parse(JSON.stringify(prefs)));
    expect(parsed?.bedtimeTargetBg).toBe(7.5);
    expect(parsed?.bedtimeLearningEnabled).toBe(true);
    expect(parseDosingPrefs({ updatedAt: "2026-10-09T12:00:00.000Z", bedtimeLearningEnabled: "yes" })?.bedtimeLearningEnabled).toBeNull();
  });
});

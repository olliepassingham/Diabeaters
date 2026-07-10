import { describe, expect, it } from "vitest";

import {
  buildExerciseCgmAlertCopy,
  evaluateExerciseCgmAlert,
  shouldSkipExerciseCgmAlertDueToCooldown,
} from "../../../supabase/functions/_shared/exercise-cgm-alert-eval.ts";

describe("evaluateExerciseCgmAlert (server)", () => {
  it("alerts when BG is below threshold", () => {
    const result = evaluateExerciseCgmAlert({
      bg: 5.2,
      bgUnits: "mmol/L",
      trend: "flat",
      threshold: 5.6,
      trendAware: true,
      clinicalHypoThreshold: 3.9,
      carbsIfLow: 15,
      carbLine: "about 15g fast carbs",
    });
    expect(result.shouldAlert).toBe(true);
    expect(result.reason).toBe("below_threshold");
  });

  it("respects cooldown unless BG cleared", () => {
    const recent = new Date(Date.now() - 5 * 60_000).toISOString();
    expect(
      shouldSkipExerciseCgmAlertDueToCooldown({
        lastAlertAt: recent,
        bg: 5.2,
        threshold: 5.6,
        bgUnits: "mmol/L",
      }),
    ).toBe(true);
  });
});

describe("buildExerciseCgmAlertCopy (server)", () => {
  it("includes exercise name in body", () => {
    const copy = buildExerciseCgmAlertCopy({
      bg: 5.2,
      bgUnits: "mmol/L",
      trend: "falling",
      evaluation: { shouldAlert: true, reason: "below_threshold", carbLine: "about 15g fast carbs" },
      exerciseName: "Tennis",
    });
    expect(copy.body).toContain("Tennis");
    expect(copy.body).toContain("5.2");
  });
});

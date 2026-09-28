import { describe, expect, it } from "vitest";

import {
  buildExerciseCgmAlertCopy,
  carbsGramsForExerciseAim,
  evaluateExerciseCgmAlert,
  parseExerciseAlertFuel,
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
  it("uses a short reading and carb line", () => {
    const copy = buildExerciseCgmAlertCopy({
      bg: 5.2,
      bgUnits: "mmol/L",
      trend: "falling",
      evaluation: { shouldAlert: true, reason: "below_threshold", carbLine: "15g" },
      exerciseName: "Tennis",
    });
    expect(copy.title).toBe("5.2 ↓");
    expect(copy.body).toBe("15g");
  });
});

describe("exercise alert fuel", () => {
  it("calculates grams from the live reading to the saved aim", () => {
    expect(parseExerciseAlertFuel("aim=7;kg=70")).toEqual({ aim: 7, kg: 70 });
    expect(
      carbsGramsForExerciseAim({ bg: 5.2, aim: 7, weightKg: 70, bgUnits: "mmol/L" }),
    ).toBe(8);
  });
});

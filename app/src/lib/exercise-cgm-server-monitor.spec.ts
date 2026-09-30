import { describe, expect, it } from "vitest";

import {
  buildExerciseCgmAlertCopy,
  carbsGramsForExerciseAim,
  evaluateExerciseCgmAlert,
  exerciseAlertCarbText,
  exerciseCarbFavoriteFromPrefs,
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
  it("shows glucose, the workout, and the carb amount", () => {
    const copy = buildExerciseCgmAlertCopy({
      bg: 5.2,
      bgUnits: "mmol/L",
      trend: "falling",
      evaluation: { shouldAlert: true, reason: "below_threshold", carbLine: "10g · ½ Running gel" },
      exerciseName: "Gym",
    });
    expect(copy.title).toBe("5.2 · Gym");
    expect(copy.body).toBe("10g · ½ Running gel");
    expect(`${copy.title} ${copy.body}`).not.toMatch(/kg=|guide/i);
  });
});

describe("exercise alert fuel", () => {
  it("calculates grams from the live reading to the saved aim", () => {
    expect(parseExerciseAlertFuel("aim=7;kg=70")).toEqual({ aim: 7, kg: 70 });
    expect(
      carbsGramsForExerciseAim({ bg: 5.2, aim: 7, weightKg: 70, bgUnits: "mmol/L" }),
    ).toBe(8);
  });

  it("keeps weight inside the token and shows a saved carb type", () => {
    expect(parseExerciseAlertFuel("aim=7;kg=95;per=20|Running gel")).toEqual({
      aim: 7,
      kg: 95,
      carbsPerServing: 20,
      carbLabel: "Running gel",
    });
    expect(
      exerciseAlertCarbText({ grams: 10, carbsPerServing: 20, carbLabel: "Running gel" }),
    ).toBe("10g · ½ Running gel");
    expect(exerciseAlertCarbText({ carbLine: "aim=7;kg=95" })).toBeNull();
  });

  it("reads a saved exercise carb favourite from the profile", () => {
    expect(
      exerciseCarbFavoriteFromPrefs({
        favorites: [{ id: "g1", label: "Running gel", carbsPerServing: 20 }],
        defaultByScenario: { exercise_during: "g1" },
      }),
    ).toEqual({ carbsPerServing: 20, carbLabel: "Running gel" });
    expect(exerciseCarbFavoriteFromPrefs({ favorites: [], defaultByScenario: {} })).toBeNull();
  });
});

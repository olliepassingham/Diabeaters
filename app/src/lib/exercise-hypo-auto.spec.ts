import { describe, expect, it } from "vitest";
import {
  computeExerciseHypoSuggestion,
  hypoRangeThreshold,
  isBgBelowHypoThreshold,
  needsImmediateExerciseBgTreatment,
  resolveExerciseBgForHypo,
} from "./exercise-hypo-auto";
import type { ActiveExerciseSession, UserSettings } from "./storage";

const baseSession = (): ActiveExerciseSession => ({
  id: "t",
  exerciseName: "Run",
  exerciseType: "cardio",
  intensity: "moderate",
  durationMinutes: 30,
  phase: "active",
  startedAt: new Date().toISOString(),
  exerciseStartedAt: new Date().toISOString(),
  recoveryMinutes: 60,
  midCheckDone: false,
  preChecklist: { bgChecked: false, carbsConsidered: false, basalAdjusted: false },
});

describe("exercise-hypo-auto", () => {
  it("resolveExerciseBgForHypo prefers mid over pre during active phase", () => {
    const s = { ...baseSession(), midBg: 4, preBg: 6 };
    expect(resolveExerciseBgForHypo(s)).toBe(4);
  });

  it("treats BG below target low as hypo", () => {
    const settings: UserSettings = { targetBgLow: 4, targetBgHigh: 7 };
    expect(isBgBelowHypoThreshold(3.5, settings, "mmol/L")).toBe(true);
    expect(isBgBelowHypoThreshold(4.5, settings, "mmol/L")).toBe(false);
  });

  it("hypoRangeThreshold falls back when settings missing", () => {
    expect(hypoRangeThreshold(undefined, "mmol/L")).toBe(3.9);
    expect(hypoRangeThreshold(undefined, "mg/dL")).toBe(70);
  });

  it("computeExerciseHypoSuggestion returns null when BG is comfortably in range", () => {
    const settings: UserSettings = { targetBgLow: 4, targetBgHigh: 7 };
    expect(computeExerciseHypoSuggestion(7, settings, "mmol/L", { dateOfBirth: "1990-01-01" })).toBeNull();
  });

  it("computeExerciseHypoSuggestion returns carbs when below range (adult)", () => {
    const settings: UserSettings = { targetBgLow: 4, targetBgHigh: 7 };
    const r = computeExerciseHypoSuggestion(3, settings, "mmol/L", { dateOfBirth: "1990-01-01" });
    expect(r).not.toBeNull();
    expect(r!.carbsGrams).toBeGreaterThanOrEqual(10);
    expect(r!.approximate).toBe(false);
    expect(r!.clinicalHypo).toBe(true);
  });

  it("needsImmediateExerciseBgTreatment for exercise-low falling BG", () => {
    const settings: UserSettings = { targetBgLow: 4, targetBgHigh: 7 };
    expect(
      needsImmediateExerciseBgTreatment(5, settings, "mmol/L", {
        trend: "falling",
        exerciseLowThreshold: 5.6,
      }),
    ).toBe(true);
    expect(
      needsImmediateExerciseBgTreatment(5.6, settings, "mmol/L", {
        trend: "flat",
        exerciseLowThreshold: 5.6,
      }),
    ).toBe(false);
  });

  it("computeExerciseHypoSuggestion returns carbs for 5.0 mmol/L falling during exercise", () => {
    const settings: UserSettings = { targetBgLow: 4, targetBgHigh: 7 };
    const r = computeExerciseHypoSuggestion(5, settings, "mmol/L", { dateOfBirth: "1990-01-01" }, {
      trend: "falling",
      phase: "active",
      exerciseLowThreshold: 5.6,
      carbsIfLow: 20,
    });
    expect(r).not.toBeNull();
    expect(r!.carbsGrams).toBeGreaterThanOrEqual(15);
    expect(r!.clinicalHypo).toBe(false);
  });

  it("computeExerciseHypoSuggestion returns carbs for recovery 6.0 falling", () => {
    const settings: UserSettings = { targetBgLow: 4, targetBgHigh: 7 };
    const r = computeExerciseHypoSuggestion(6, settings, "mmol/L", { dateOfBirth: "1990-01-01" }, {
      trend: "falling",
      phase: "recovery",
      exerciseLowThreshold: 5.6,
      carbsIfLow: 20,
    });
    expect(r).not.toBeNull();
    expect(r!.carbsGrams).toBeGreaterThanOrEqual(15);
  });
});

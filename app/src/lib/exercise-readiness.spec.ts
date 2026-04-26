import { describe, expect, it } from "vitest";
import { calculateExercisePlan } from "./exercise-plan";
import { getExerciseCarbPlanHintLine, getExerciseReadinessVerdict, getRecoveryReadinessVerdict } from "./exercise-readiness";

const plan = calculateExercisePlan({
  exerciseType: "cardio",
  durationMinutes: 45,
  intensity: "moderate",
  minutesUntilStart: 0,
  bgUnits: "mmol/L",
  currentBg: 7,
});

describe("getExerciseReadinessVerdict recovery phase", () => {
  it("uses BG+trend for recovery (e.g. in-range flat → ready)", () => {
    const r = getExerciseReadinessVerdict({
      exercisePlanResult: plan,
      currentBg: 7,
      bgUnits: "mmol/L",
      exerciseType: "cardio",
      intensity: "moderate",
      bgTrend: "flat",
      phase: "recovery",
    });
    expect(r.verdict).toBe("ready");
    expect(r.title).toBe("Ready");
    expect(r.detail.toLowerCase()).not.toContain("start");
    expect(r.detail.toLowerCase()).not.toContain("in range to start");
  });

  it("omits pre-session carb hint for recovery", () => {
    const r = getExerciseReadinessVerdict({
      exercisePlanResult: plan,
      currentBg: 7,
      bgUnits: "mmol/L",
      exerciseType: "cardio",
      intensity: "moderate",
      phase: "recovery",
    });
    expect(getExerciseCarbPlanHintLine(plan, r.verdict, { phase: "recovery" })).toBeNull();
  });
});

describe("getRecoveryReadinessVerdict", () => {
  it("is ready (green tone) when in range and flat", () => {
    const r = getRecoveryReadinessVerdict({
      exercisePlanResult: plan,
      currentBg: 7,
      bgUnits: "mmol/L",
      exerciseType: "cardio",
      intensity: "moderate",
      bgTrend: "flat",
      phase: "recovery",
    });
    expect(r.verdict).toBe("ready");
    expect(r.title).toBe("Ready");
  });

  it("is not_recommended (red tone) when low and falling near threshold", () => {
    const r = getRecoveryReadinessVerdict({
      exercisePlanResult: plan,
      currentBg: 6.0,
      bgUnits: "mmol/L",
      exerciseType: "cardio",
      intensity: "moderate",
      bgTrend: "falling",
      phase: "recovery",
    });
    expect(r.verdict).toBe("not_recommended");
    expect(r.title.toLowerCase()).toContain("falling");
  });

  it("is caution (amber) when in range but falling", () => {
    const r = getRecoveryReadinessVerdict({
      exercisePlanResult: plan,
      currentBg: 8,
      bgUnits: "mmol/L",
      exerciseType: "cardio",
      intensity: "moderate",
      bgTrend: "falling",
      phase: "recovery",
    });
    expect(r.verdict).toBe("caution");
  });
});

describe("getExerciseReadinessVerdict rapid insulin (pre strip)", () => {
  it("shifts ready to caution when rapid insulin in last 2h is yes", () => {
    const r = getExerciseReadinessVerdict({
      exercisePlanResult: plan,
      currentBg: 7,
      bgUnits: "mmol/L",
      exerciseType: "cardio",
      intensity: "moderate",
      bgTrend: "flat",
      phase: "pre",
      preRapidInsulin2h: "yes",
    });
    expect(r.verdict).toBe("caution");
    expect(r.title).toContain("insulin");
  });

  it("keeps not recommended for low BG even if rapid insulin is yes", () => {
    const lowPlan = calculateExercisePlan({
      exerciseType: "cardio",
      durationMinutes: 45,
      intensity: "moderate",
      minutesUntilStart: 0,
      bgUnits: "mmol/L",
      currentBg: 4,
    });
    const r = getExerciseReadinessVerdict({
      exercisePlanResult: lowPlan,
      currentBg: 4,
      bgUnits: "mmol/L",
      exerciseType: "cardio",
      intensity: "moderate",
      phase: "pre",
      preRapidInsulin2h: "yes",
    });
    expect(r.verdict).toBe("not_recommended");
  });
});

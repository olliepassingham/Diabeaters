import { describe, expect, it } from "vitest";
import { calculateExercisePlan } from "./exercise-plan";
import { getExerciseCarbPlanHintLine, getExerciseFuelPlanLines, getExerciseReadinessVerdict, getRecoveryReadinessVerdict } from "./exercise-readiness";

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

  it("includes recovery fuel hint (not pre-session copy)", () => {
    const r = getExerciseReadinessVerdict({
      exercisePlanResult: plan,
      currentBg: 7,
      bgUnits: "mmol/L",
      exerciseType: "cardio",
      intensity: "moderate",
      phase: "recovery",
    });
    const hint = getExerciseCarbPlanHintLine(plan, r.verdict, { phase: "recovery" });
    expect(hint?.toLowerCase()).toContain("delayed low");
    const recoveryFuel = getExerciseFuelPlanLines(plan, r.verdict, null, { phase: "recovery" });
    expect(recoveryFuel.some((l) => l.id === "post")).toBe(true);
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

  it("is ready when in range and rising after effort", () => {
    const r = getRecoveryReadinessVerdict({
      exercisePlanResult: plan,
      currentBg: 5.8,
      bgUnits: "mmol/L",
      exerciseType: "strength",
      intensity: "moderate",
      bgTrend: "rising",
      phase: "recovery",
    });
    expect(r.verdict).toBe("ready");
    expect(r.detail.toLowerCase()).toContain("rising");
  });
});

describe("getExerciseReadinessVerdict deeper context modifiers", () => {
  it("downgrades ready to caution when low sleep + alcohol last night", () => {
    const r = getExerciseReadinessVerdict({
      exercisePlanResult: plan,
      currentBg: 7,
      bgUnits: "mmol/L",
      exerciseType: "cardio",
      intensity: "moderate",
      bgTrend: "flat",
      phase: "pre",
      sleepHoursLastNight: 4,
      alcoholLastNight: true,
    });
    expect(r.verdict).toBe("caution");
    expect(r.detail.toLowerCase()).toContain("low sleep");
  });

  it("preserves not_recommended low BG verdict regardless of deeper context", () => {
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
      feelingOff: true,
      hypoProneHistory: true,
    });
    expect(r.verdict).toBe("not_recommended");
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

describe("getExerciseFuelPlanLines", () => {
  const strengthPlan = calculateExercisePlan({
    exerciseType: "strength",
    durationMinutes: 45,
    intensity: "moderate",
    minutesUntilStart: 0,
    bgUnits: "mmol/L",
    currentBg: 5.8,
  });

  it("includes on-hand and post-workout lines for strength pre-phase", () => {
    const lines = getExerciseFuelPlanLines(strengthPlan, "caution", null, {
      phase: "pre",
      exerciseType: "strength",
    });
    expect(lines.some((l) => l.id === "on_hand")).toBe(true);
    expect(lines.some((l) => l.id === "post")).toBe(true);
    expect(lines.find((l) => l.id === "post")?.label).toBe("After workout");
  });

  it("uses carb favourites when configured", () => {
    const fav = {
      id: "f1",
      label: "Gel",
      carbsPerServing: 15,
      unitLabel: "pack",
    };
    const profile = {
      carbSourcePreferences: {
        favorites: [fav],
        defaultByScenario: { exercise_on_hand: fav.id, exercise_during: fav.id },
      },
    };
    const lines = getExerciseFuelPlanLines(strengthPlan, "caution", profile, {
      phase: "pre",
      exerciseType: "strength",
    });
    expect(lines.find((l) => l.id === "on_hand")?.text).toContain("Gel");
  });

  it("returns empty for not_recommended verdict", () => {
    expect(getExerciseFuelPlanLines(strengthPlan, "not_recommended", null, { phase: "pre" })).toEqual([]);
  });
});

describe("getExerciseReadinessVerdict active phase trend", () => {
  const strengthPlan = calculateExercisePlan({
    exerciseType: "strength",
    durationMinutes: 45,
    intensity: "moderate",
    minutesUntilStart: 0,
    bgUnits: "mmol/L",
    currentBg: 5.8,
  });

  it("cautions when BG is borderline and falling during strength", () => {
    const r = getExerciseReadinessVerdict({
      exercisePlanResult: strengthPlan,
      currentBg: 5.8,
      bgUnits: "mmol/L",
      exerciseType: "strength",
      intensity: "moderate",
      bgTrend: "falling",
      phase: "active",
    });
    expect(r.verdict).toBe("caution");
    expect(r.detail.toLowerCase()).toContain("falling");
  });

  it("stays ready when BG is rising during strength", () => {
    const r = getExerciseReadinessVerdict({
      exercisePlanResult: strengthPlan,
      currentBg: 5.8,
      bgUnits: "mmol/L",
      exerciseType: "strength",
      intensity: "moderate",
      bgTrend: "rising",
      phase: "active",
    });
    expect(r.verdict).toBe("ready");
    expect(r.detail.toLowerCase()).toContain("rising");
  });
});

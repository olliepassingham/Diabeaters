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
    expect(hint?.toLowerCase()).toContain("have ready");
    const recoveryFuel = getExerciseFuelPlanLines(plan, r.verdict, null, { phase: "recovery" });
    expect(recoveryFuel.some((l) => l.id === "post")).toBe(true);
    expect(recoveryFuel.find((l) => l.id === "post")?.label).toBe("Have ready");
  });
});

describe("getExerciseReadinessVerdict awaitingInput flag (no BG entered yet)", () => {
  it("flags awaitingInput and uses a neutral 'Add your BG' prompt instead of a false caution", () => {
    const r = getExerciseReadinessVerdict({
      exercisePlanResult: plan,
      currentBg: null,
      bgUnits: "mmol/L",
      exerciseType: "cardio",
      intensity: "moderate",
      phase: "pre",
    });
    expect(r.awaitingInput).toBe(true);
    expect(r.title.toLowerCase()).toContain("add your bg");
    expect(r.title.toLowerCase()).not.toBe("caution");
  });

  it("does not set awaitingInput once a real BG is provided", () => {
    const r = getExerciseReadinessVerdict({
      exercisePlanResult: plan,
      currentBg: 7,
      bgUnits: "mmol/L",
      exerciseType: "cardio",
      intensity: "moderate",
      bgTrend: "flat",
      phase: "pre",
    });
    expect(r.awaitingInput).toBeFalsy();
  });

  it("is also flagged for the recovery phase when BG is missing", () => {
    const r = getRecoveryReadinessVerdict({
      exercisePlanResult: plan,
      currentBg: null,
      bgUnits: "mmol/L",
      exerciseType: "cardio",
      intensity: "moderate",
      phase: "recovery",
    });
    expect(r.awaitingInput).toBe(true);
  });

  it("skips deeper-context caution text while awaiting input, keeping the prompt focused", () => {
    const r = getExerciseReadinessVerdict({
      exercisePlanResult: plan,
      currentBg: null,
      bgUnits: "mmol/L",
      exerciseType: "cardio",
      intensity: "intense",
      phase: "pre",
      fasted: true,
      feelingOff: true,
    });
    expect(r.awaitingInput).toBe(true);
    expect(r.detail.toLowerCase()).not.toContain("fasted");
    expect(r.detail.toLowerCase()).not.toContain("feeling off");
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

describe("getExerciseReadinessVerdict pre exercise start band", () => {
  const intenseCardioPlan = calculateExercisePlan({
    exerciseType: "cardio",
    durationMinutes: 30,
    intensity: "intense",
    minutesUntilStart: 0,
    bgUnits: "mmol/L",
    currentBg: 5.6,
  });

  it("cautions (not ready) for intense cardio below ~7 mmol/L even when trend is flat", () => {
    const r = getExerciseReadinessVerdict({
      exercisePlanResult: intenseCardioPlan,
      currentBg: 5.6,
      bgUnits: "mmol/L",
      exerciseType: "cardio",
      intensity: "intense",
      bgTrend: "flat",
      phase: "pre",
    });
    expect(r.verdict).toBe("caution");
    expect(r.detail.toLowerCase()).toContain("below");
    expect(r.detail.toLowerCase()).toContain("before you start");
  });

  it("stays ready for intense cardio at ideal start", () => {
    const r = getExerciseReadinessVerdict({
      exercisePlanResult: intenseCardioPlan,
      currentBg: 7.2,
      bgUnits: "mmol/L",
      exerciseType: "cardio",
      intensity: "intense",
      bgTrend: "flat",
      phase: "pre",
    });
    expect(r.verdict).toBe("ready");
  });
});

describe("getExerciseFuelPlanLines active phase", () => {
  it("shows carry-on-you for intense 30 min cardio, not after-workout recovery", () => {
    const cardioPlan = calculateExercisePlan({
      exerciseType: "cardio",
      durationMinutes: 30,
      intensity: "intense",
      minutesUntilStart: 0,
      bgUnits: "mmol/L",
      currentBg: 5.6,
    });
    const lines = getExerciseFuelPlanLines(cardioPlan, "ready", null, {
      phase: "active",
      exerciseType: "cardio",
      intensity: "intense",
    });
    expect(lines.some((l) => l.id === "post")).toBe(false);
    expect(lines.find((l) => l.id === "during")?.label).toBe("Carry on you");
    expect(lines.find((l) => l.id === "during")?.text).toContain("30g");
  });

  it("shows Take now during active when BG is falling in approach band", () => {
    const strengthPlan = calculateExercisePlan({
      exerciseType: "strength",
      durationMinutes: 45,
      intensity: "moderate",
      minutesUntilStart: 0,
      bgUnits: "mmol/L",
      currentBg: 5.6,
    });
    const lines = getExerciseFuelPlanLines(strengthPlan, "caution", null, {
      phase: "active",
      exerciseType: "strength",
      intensity: "moderate",
      currentBg: 5.6,
      bgUnits: "mmol/L",
      trend: "falling",
    });
    expect(lines.find((l) => l.id === "on_hand")?.label).toBe("Take now");
    expect(lines.find((l) => l.id === "on_hand")?.text).toContain("15");
  });

  it("shows Take now during active when BG is below exercise low threshold", () => {
    const strengthPlan = calculateExercisePlan({
      exerciseType: "strength",
      durationMinutes: 45,
      intensity: "moderate",
      minutesUntilStart: 0,
      bgUnits: "mmol/L",
      currentBg: 5,
    });
    const lines = getExerciseFuelPlanLines(strengthPlan, "not_recommended", null, {
      phase: "active",
      exerciseType: "strength",
      intensity: "moderate",
      currentBg: 5,
      bgUnits: "mmol/L",
      trend: "falling",
    });
    expect(lines.find((l) => l.id === "on_hand")?.label).toBe("Take now");
    expect(lines.find((l) => l.id === "on_hand")?.text).toContain("15");
  });

  it("adds interval dose line for cardio longer than 30 min", () => {
    const cardioPlan = calculateExercisePlan({
      exerciseType: "cardio",
      durationMinutes: 60,
      intensity: "intense",
      minutesUntilStart: 0,
      bgUnits: "mmol/L",
    });
    const lines = getExerciseFuelPlanLines(cardioPlan, "ready", null, {
      phase: "active",
      exerciseType: "cardio",
      intensity: "intense",
    });
    expect(lines.find((l) => l.id === "during")?.text).toContain("60g");
    expect(lines.some((l) => l.label.includes("every 30 min"))).toBe(true);
  });
});

describe("getExerciseFuelPlanLines recovery phase", () => {
  it("shows large-format have-ready line for post-workout carbs", () => {
    const cardioPlan = calculateExercisePlan({
      exerciseType: "cardio",
      durationMinutes: 30,
      intensity: "intense",
      minutesUntilStart: 0,
      bgUnits: "mmol/L",
    });
    const lines = getExerciseFuelPlanLines(cardioPlan, "ready", null, { phase: "recovery" });
    expect(lines).toHaveLength(1);
    expect(lines[0]?.label).toBe("Have ready");
    expect(lines[0]?.text).toContain("35g");
    expect(lines[0]?.text.toLowerCase()).not.toContain("delayed low");
  });

  it("shows Take now when recovery BG is borderline and falling", () => {
    const strengthPlan = calculateExercisePlan({
      exerciseType: "strength",
      durationMinutes: 45,
      intensity: "moderate",
      minutesUntilStart: 0,
      bgUnits: "mmol/L",
      currentBg: 6,
    });
    const lines = getExerciseFuelPlanLines(strengthPlan, "not_recommended", null, {
      phase: "recovery",
      exerciseType: "strength",
      currentBg: 6,
      bgUnits: "mmol/L",
      trend: "falling",
    });
    expect(lines.find((l) => l.id === "on_hand")?.label).toBe("Take now");
    expect(lines.find((l) => l.id === "on_hand")?.text).toContain("15");
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

  it("uses Take now label when intense cardio BG is below ideal start", () => {
    const cardioPlan = calculateExercisePlan({
      exerciseType: "cardio",
      durationMinutes: 30,
      intensity: "intense",
      minutesUntilStart: 0,
      bgUnits: "mmol/L",
      currentBg: 5.6,
    });
    const lines = getExerciseFuelPlanLines(cardioPlan, "caution", null, {
      phase: "pre",
      exerciseType: "cardio",
      currentBg: 5.6,
      bgUnits: "mmol/L",
      intensity: "intense",
    });
    expect(lines.find((l) => l.id === "on_hand")?.label).toBe("Take now");
  });

  it("includes pre-workout lines only (no recovery) for strength pre-phase", () => {
    const lines = getExerciseFuelPlanLines(strengthPlan, "caution", null, {
      phase: "pre",
      exerciseType: "strength",
    });
    expect(lines.some((l) => l.id === "on_hand")).toBe(true);
    expect(lines.find((l) => l.id === "on_hand")?.label).toBe("Have ready");
    expect(lines.some((l) => l.id === "post")).toBe(false);
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

  it("returns empty for not_recommended when BG context is missing", () => {
    expect(getExerciseFuelPlanLines(strengthPlan, "not_recommended", null, { phase: "pre" })).toEqual([]);
  });

  it("shows Take now with carb favourites for pre low BG treat-first", () => {
    const cardioPlan = calculateExercisePlan({
      exerciseType: "cardio",
      durationMinutes: 45,
      intensity: "intense",
      minutesUntilStart: 0,
      bgUnits: "mmol/L",
      currentBg: 5.4,
    });
    const fav = {
      id: "f1",
      label: "Glucose tabs",
      carbsPerServing: 4,
      unitLabel: "tablet",
    };
    const profile = {
      carbSourcePreferences: {
        favorites: [fav],
        defaultByScenario: { exercise_on_hand: fav.id },
      },
    };
    const lines = getExerciseFuelPlanLines(cardioPlan, "not_recommended", profile, {
      phase: "pre",
      currentBg: 5.4,
      bgUnits: "mmol/L",
      exerciseType: "cardio",
      intensity: "intense",
    });
    expect(lines).toHaveLength(1);
    expect(lines[0]?.label).toBe("Take now");
    expect(lines[0]?.text).toContain("Glucose tabs");
  });
});

describe("getRecoveryReadinessVerdict phase-aware delayed-low band", () => {
  it("flags a borderline-low reading as not_recommended in recovery even without a confirmed falling trend", () => {
    const r = getRecoveryReadinessVerdict({
      exercisePlanResult: plan,
      currentBg: 5.9, // within the recovery-widened band (5.6 + 0.9 margin + 0.5 recovery extra = 7.0), trend unknown
      bgUnits: "mmol/L",
      exerciseType: "cardio",
      intensity: "moderate",
      bgTrend: "not_sure",
      phase: "recovery",
    });
    expect(r.verdict).toBe("not_recommended");
  });

  it("still treats a clearly rising reading in that same band as ready", () => {
    const r = getRecoveryReadinessVerdict({
      exercisePlanResult: plan,
      currentBg: 5.9,
      bgUnits: "mmol/L",
      exerciseType: "cardio",
      intensity: "moderate",
      bgTrend: "rising",
      phase: "recovery",
    });
    expect(r.verdict).toBe("ready");
  });

  it("also flags a flat reading in the widened band — must match needsImmediateExerciseBgTreatment so the hero verdict and the hypo 'treat now' banner never contradict each other", () => {
    const r = getRecoveryReadinessVerdict({
      exercisePlanResult: plan,
      currentBg: 5.9,
      bgUnits: "mmol/L",
      exerciseType: "cardio",
      intensity: "moderate",
      bgTrend: "flat",
      phase: "recovery",
    });
    expect(r.verdict).toBe("not_recommended");
  });
});

describe("getExerciseReadinessVerdict deeper context — full factor set", () => {
  it("escalates ready to caution for a single strong factor alone (beta-blocker)", () => {
    const r = getExerciseReadinessVerdict({
      exercisePlanResult: plan,
      currentBg: 7,
      bgUnits: "mmol/L",
      exerciseType: "cardio",
      intensity: "moderate",
      bgTrend: "flat",
      phase: "pre",
      betaBlockerToday: true,
    });
    expect(r.verdict).toBe("caution");
    expect(r.detail.toLowerCase()).toContain("beta-blocker");
  });

  it("escalates ready to caution for a single strong factor alone (GLP-1)", () => {
    const r = getExerciseReadinessVerdict({
      exercisePlanResult: plan,
      currentBg: 7,
      bgUnits: "mmol/L",
      exerciseType: "cardio",
      intensity: "moderate",
      bgTrend: "flat",
      phase: "pre",
      glp1Last24h: true,
    });
    expect(r.verdict).toBe("caution");
    expect(r.detail.toLowerCase()).toContain("glp-1");
  });

  it("escalates ready to caution when heat/altitude combines with moderate-or-harder effort", () => {
    const r = getExerciseReadinessVerdict({
      exercisePlanResult: plan,
      currentBg: 7,
      bgUnits: "mmol/L",
      exerciseType: "cardio",
      intensity: "intense",
      bgTrend: "flat",
      phase: "pre",
      environments: ["outdoor_hot"],
    });
    expect(r.verdict).toBe("caution");
    expect(r.detail.toLowerCase()).toContain("heat");
  });

  it("does not escalate a single mild factor alone (caffeine) — just notes it", () => {
    const r = getExerciseReadinessVerdict({
      exercisePlanResult: plan,
      currentBg: 7,
      bgUnits: "mmol/L",
      exerciseType: "cardio",
      intensity: "moderate",
      bgTrend: "flat",
      phase: "pre",
      caffeineLast2h: true,
    });
    expect(r.verdict).toBe("ready");
    expect(r.detail.toLowerCase()).toContain("caffeine");
  });

  it("stacks two mild factors (caffeine + competitive) into an escalation", () => {
    const r = getExerciseReadinessVerdict({
      exercisePlanResult: plan,
      currentBg: 7,
      bgUnits: "mmol/L",
      exerciseType: "cardio",
      intensity: "moderate",
      bgTrend: "flat",
      phase: "pre",
      caffeineLast2h: true,
      competitive: true,
    });
    expect(r.verdict).toBe("caution");
  });

  it("treats fasted as only a mild note for light intensity", () => {
    const r = getExerciseReadinessVerdict({
      exercisePlanResult: plan,
      currentBg: 7,
      bgUnits: "mmol/L",
      exerciseType: "walking",
      intensity: "light",
      bgTrend: "flat",
      phase: "pre",
      fasted: true,
    });
    expect(r.verdict).toBe("ready");
  });

  it("treats fasted as a strong factor for intense effort", () => {
    const r = getExerciseReadinessVerdict({
      exercisePlanResult: plan,
      currentBg: 7,
      bgUnits: "mmol/L",
      exerciseType: "cardio",
      intensity: "intense",
      bgTrend: "flat",
      phase: "pre",
      fasted: true,
    });
    expect(r.verdict).toBe("caution");
  });
});

describe("getExerciseReadinessVerdict active-phase symptom escalation", () => {
  it("escalates ready to caution when moderate symptoms are logged mid-session", () => {
    const r = getExerciseReadinessVerdict({
      exercisePlanResult: plan,
      currentBg: 7,
      bgUnits: "mmol/L",
      exerciseType: "cardio",
      intensity: "moderate",
      bgTrend: "flat",
      phase: "active",
      symptomSeverity: "moderate",
    });
    expect(r.verdict).toBe("caution");
  });

  it("escalates to not_recommended (stop and check) when severe symptoms are logged, even if BG looks fine", () => {
    const r = getExerciseReadinessVerdict({
      exercisePlanResult: plan,
      currentBg: 7,
      bgUnits: "mmol/L",
      exerciseType: "cardio",
      intensity: "moderate",
      bgTrend: "flat",
      phase: "active",
      symptomSeverity: "severe",
    });
    expect(r.verdict).toBe("not_recommended");
    expect(r.title.toLowerCase()).toContain("stop");
  });

  it("ignores mild symptoms for the verdict (still tracked for the hypo carb estimate elsewhere)", () => {
    const r = getExerciseReadinessVerdict({
      exercisePlanResult: plan,
      currentBg: 7,
      bgUnits: "mmol/L",
      exerciseType: "cardio",
      intensity: "moderate",
      bgTrend: "flat",
      phase: "active",
      symptomSeverity: "mild",
    });
    expect(r.verdict).toBe("ready");
  });

  it("does not soften an already not_recommended low-BG verdict's title", () => {
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
      phase: "active",
      symptomSeverity: "severe",
    });
    expect(r.verdict).toBe("not_recommended");
    expect(r.title.toLowerCase()).toContain("low bg");
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

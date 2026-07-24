import { describe, expect, it } from "vitest";
import {
  calculateExercisePlan,
  calculateExercisePlanFromMessage,
  getRecoveryInsulinHeadline,
  getRecoveryEducationBulletsFromPlan,
} from "./exercise-plan";

const baseCtx = {
  exerciseType: "cardio",
  durationMinutes: 45,
  intensity: "moderate" as const,
  minutesUntilStart: 60,
  bgUnits: "mmol/L" as const,
};

describe("getRecoveryInsulinHeadline", () => {
  it("mentions bolus reduction for MDI", () => {
    const plan = calculateExercisePlan({ ...baseCtx, intensity: "moderate" });
    const line = getRecoveryInsulinHeadline(plan, false, false);
    expect(line).toContain(plan.post.bolusReduction);
    expect(line.toLowerCase()).toContain("bolus");
  });

  it("uses closed-loop pump copy when settings flag is on", () => {
    const plan = calculateExercisePlan(baseCtx, { usesClosedLoop: true });
    const joined = [
      ...plan.pumpTips.pre,
      ...plan.pumpTips.during,
      ...plan.pumpTips.post,
      ...plan.pumpTips.recovery,
    ].join(" ");
    expect(joined).not.toMatch(/temp basal|temporary basal/i);
    expect(joined).toMatch(/IOB|30–60 min/i);
  });

  it("uses pump post copy when isPump", () => {
    const plan = calculateExercisePlan({ ...baseCtx, intensity: "moderate" });
    const line = getRecoveryInsulinHeadline(plan, true, false);
    expect(line).toContain("temp basal");
  });
});

describe("getRecoveryEducationBulletsFromPlan", () => {
  it("includes bolus reduction and monitoring window", () => {
    const plan = calculateExercisePlan(baseCtx);
    const bullets = getRecoveryEducationBulletsFromPlan(plan, false);
    expect(bullets.some((b) => b.includes(plan.post.bolusReduction))).toBe(true);
    expect(bullets.some((b) => b.includes(plan.recovery.monitorHours))).toBe(true);
  });

  it("adds pump tips when isPump", () => {
    const plan = calculateExercisePlan(baseCtx);
    const bullets = getRecoveryEducationBulletsFromPlan(plan, true);
    expect(bullets.some((b) => b.toLowerCase().includes("basal"))).toBe(true);
  });
});

describe("calculateExercisePlan", () => {
  it("returns structured plan for baseline context", () => {
    const r = calculateExercisePlan(baseCtx);
    expect(r.duration).toBe(45);
    expect(r.intensity).toBe("moderate");
    expect(r.exerciseType).toBe("Cardio");
    expect(r.pre.bolusReduction).toMatch(/\d/);
    expect(r.during.tips.length).toBeGreaterThan(0);
    expect(r.pumpTips.pre.length).toBeGreaterThan(0);
  });

  it("adds contextual notes when recent insulin and moderate intensity", () => {
    const r = calculateExercisePlan({
      ...baseCtx,
      lastInsulinTiming: "lt_1h",
    });
    expect(r.pre.contextualNotes?.some((n) => n.toLowerCase().includes("insulin"))).toBe(true);
    expect(r.during.checkBg || r.during.carbsNeeded > 0).toBe(true);
  });

  it("flags low BG in contextual notes", () => {
    const r = calculateExercisePlan({
      ...baseCtx,
      currentBg: 4.2,
    });
    expect(r.pre.contextualNotes?.some((n) => n.toLowerCase().includes("low"))).toBe(true);
  });

  it("uses minutesUntilStart in timing kicker", () => {
    const soon = calculateExercisePlan({ ...baseCtx, minutesUntilStart: 30 });
    expect(soon.pre.timing).toBe("Starting soon");
    const ahead = calculateExercisePlan({ ...baseCtx, minutesUntilStart: 120 });
    expect(ahead.pre.timing).toBe("Planning ahead");
  });

  it("scales intense pre carbs by duration", () => {
    const short = calculateExercisePlan({ ...baseCtx, intensity: "intense", durationMinutes: 25 });
    const mid = calculateExercisePlan({ ...baseCtx, intensity: "intense", durationMinutes: 45 });
    const long = calculateExercisePlan({ ...baseCtx, intensity: "intense", durationMinutes: 120 });
    expect(short.pre.carbsIfLow).toBe(20);
    expect(mid.pre.carbsIfLow).toBe(30);
    expect(long.pre.carbsIfLow).toBe(40);
  });

  it("keeps scaling carbs and bolus reduction continuously with duration — no flat plateau across a wide range", () => {
    // Old behaviour: any intense session from 61-300 min got an identical flat 30g pre-buffer
    // and any moderate session from 45-300 min got the same during-carbs formula collapsing to
    // a handful of repeated values. Duration should keep mattering the whole way through.
    const durations = [10, 20, 30, 45, 60, 90, 120, 180, 240, 300];
    for (const intensity of ["light", "moderate", "intense"] as const) {
      const plans = durations.map((durationMinutes) =>
        calculateExercisePlan({ ...baseCtx, intensity, durationMinutes }),
      );
      for (let i = 1; i < plans.length; i++) {
        expect(plans[i]!.pre.carbsIfLow).toBeGreaterThanOrEqual(plans[i - 1]!.pre.carbsIfLow);
        expect(plans[i]!.during.carbsNeeded).toBeGreaterThanOrEqual(plans[i - 1]!.during.carbsNeeded);
        expect(plans[i]!.post.carbs).toBeGreaterThanOrEqual(plans[i - 1]!.post.carbs);
      }
      // At least one of pre/during/post should differ between a 60 min and a 240 min session —
      // i.e. the old "flat after one breakpoint" behaviour is gone.
      const at60 = plans[durations.indexOf(60)]!;
      const at240 = plans[durations.indexOf(240)]!;
      const anyDifference =
        at60.pre.carbsIfLow !== at240.pre.carbsIfLow ||
        at60.during.carbsNeeded !== at240.during.carbsNeeded ||
        at60.post.carbs !== at240.post.carbs;
      expect(anyDifference).toBe(true);
    }
  });

  it("shifts the bolus-reduction band with duration, anchored at 45 min", () => {
    const anchor = calculateExercisePlan({ ...baseCtx, intensity: "moderate", durationMinutes: 45 });
    const short = calculateExercisePlan({ ...baseCtx, intensity: "moderate", durationMinutes: 15 });
    const long = calculateExercisePlan({ ...baseCtx, intensity: "moderate", durationMinutes: 150 });
    const lo = (r: typeof anchor) => parseInt(r.pre.bolusReduction.match(/^(\d+)/)?.[1] ?? "0", 10);
    expect(anchor.pre.bolusReduction).toBe("25-35%");
    expect(lo(short)).toBeLessThan(lo(anchor));
    expect(lo(long)).toBeGreaterThan(lo(anchor));
  });

  it("nudges carb targets by exercise type (same intensity and duration)", () => {
    const ctx = { ...baseCtx, durationMinutes: 60, intensity: "moderate" as const };
    const cardio = calculateExercisePlan({ ...ctx, exerciseType: "cardio" });
    const strength = calculateExercisePlan({ ...ctx, exerciseType: "strength" });
    const yoga = calculateExercisePlan({ ...ctx, exerciseType: "yoga" });
    // Moderate 60 min: base during carbs > 0; cardio bumps during vs strength reduction
    expect(cardio.during.carbsNeeded).toBeGreaterThanOrEqual(strength.during.carbsNeeded);
    expect(yoga.post.carbs).toBeLessThan(cardio.post.carbs);
    expect(strength.post.carbs).toBeGreaterThanOrEqual(cardio.post.carbs);
    expect(cardio.pre.contextualNotes?.some((n) => n.includes("activity type"))).toBe(true);
  });

  it("does not let a mild type nudge collapse into a much larger cut at a 5g rounding boundary", () => {
    // Regression: 20 min moderate strength used to round to 5g ("Have ready ~5g fast carbs") —
    // a 50% cut — because the ~8% strength trim was re-rounded on top of an already-rounded base
    // (11.5g -> 10g -> x0.92 -> floor to 5g). It should land close to a cardio session of the
    // same length/intensity (which rounds to 10g), not half of it.
    const ctx = { ...baseCtx, durationMinutes: 20, intensity: "moderate" as const };
    const cardio = calculateExercisePlan({ ...ctx, exerciseType: "cardio" });
    const strength = calculateExercisePlan({ ...ctx, exerciseType: "strength" });
    expect(cardio.pre.carbsIfLow).toBe(10);
    expect(strength.pre.carbsIfLow).toBeGreaterThanOrEqual(cardio.pre.carbsIfLow - 5);
    expect(strength.pre.carbsIfLow).not.toBeLessThan(cardio.pre.carbsIfLow / 2);
  });

  it("adjusts post-exercise bolus reduction by exercise type (strength < cardio)", () => {
    const ctx = { ...baseCtx, durationMinutes: 60, intensity: "moderate" as const };
    const cardio = calculateExercisePlan({ ...ctx, exerciseType: "cardio" });
    const strength = calculateExercisePlan({ ...ctx, exerciseType: "strength" });
    const cardioLo = parseInt(cardio.post.bolusReduction.match(/^(\d+)/)?.[1] ?? "0", 10);
    const strengthLo = parseInt(strength.post.bolusReduction.match(/^(\d+)/)?.[1] ?? "0", 10);
    expect(strengthLo).toBeLessThanOrEqual(cardioLo);
  });

  it("adds contextual notes for planned pre-exercise snack with bolus", () => {
    const r = calculateExercisePlan({
      ...baseCtx,
      plannedPreExerciseFuel: "snack_bolus",
      minutesUntilPreExerciseFuel: 25,
      minutesUntilStart: 60,
    });
    const notes = r.pre.contextualNotes ?? [];
    expect(notes.some((n) => n.includes("Pre-exercise snack with bolus"))).toBe(true);
    expect(notes.some((n) => n.toLowerCase().includes("stacking"))).toBe(true);
    expect(r.during.tips.some((t) => t.includes("pre-exercise snack or meal"))).toBe(true);
  });

  it("notes when planned fuel is after session start time", () => {
    const r = calculateExercisePlan({
      ...baseCtx,
      plannedPreExerciseFuel: "meal_bolus",
      minutesUntilPreExerciseFuel: 90,
      minutesUntilStart: 45,
    });
    expect(
      r.pre.contextualNotes?.some((n) => n.includes("after your session was due to start")),
    ).toBe(true);
  });

  it("uses planned pre-exercise meal timing only (no duplicate generic meal line)", () => {
    const withMealBolus = calculateExercisePlan({
      ...baseCtx,
      plannedPreExerciseFuel: "meal_bolus",
      minutesUntilPreExerciseFuel: 40,
    });
    expect(withMealBolus.pre.contextualNotes?.some((n) => n.startsWith("Meal in ~"))).toBe(false);
    expect(
      withMealBolus.pre.contextualNotes?.some((n) => n.includes("Pre-exercise meal with bolus")),
    ).toBe(true);
  });

  it("legacy about_to_eat with mismatched minutesUntilNextMeal defers to planned fuel tip (no conflict warning)", () => {
    const r = calculateExercisePlan({
      ...baseCtx,
      nutritionContext: "about_to_eat",
      minutesUntilNextMeal: 60,
      plannedPreExerciseFuel: "meal_bolus",
      minutesUntilPreExerciseFuel: 20,
    });
    expect(r.pre.contextualNotes?.some((n) => n.includes("different meal timings"))).toBe(false);
    expect(r.pre.contextualNotes?.some((n) => n.includes("Pre-exercise meal with bolus in ~20 min"))).toBe(true);
  });

  it("adds generic meal timing line for legacy about_to_eat when no planned fuel", () => {
    const r = calculateExercisePlan({
      ...baseCtx,
      nutritionContext: "about_to_eat",
      minutesUntilNextMeal: 40,
    });
    expect(r.pre.contextualNotes?.some((n) => n.startsWith("Meal in ~40 min"))).toBe(true);
  });
});

describe("calculateExercisePlan deeper context modifiers", () => {
  it("adds heat-related caution and bumps during carbs in hot outdoor sessions", () => {
    const baseline = calculateExercisePlan({ ...baseCtx, durationMinutes: 60 });
    const hot = calculateExercisePlan({
      ...baseCtx,
      durationMinutes: 60,
      environment: "outdoor_hot",
    });
    expect(hot.during.carbsNeeded).toBeGreaterThanOrEqual(baseline.during.carbsNeeded);
    expect(hot.pre.contextualNotes?.some((n) => n.toLowerCase().includes("hot"))).toBe(true);
  });

  it("combines hot and altitude pre-session guidance when both environments apply", () => {
    const ctx = { ...baseCtx, durationMinutes: 60 };
    const hot = calculateExercisePlan({ ...ctx, environments: ["outdoor_hot"] });
    const hotAltitude = calculateExercisePlan({ ...ctx, environments: ["outdoor_hot", "altitude"] });
    const hotNotes = hot.pre.contextualNotes ?? [];
    const bothNotes = hotAltitude.pre.contextualNotes ?? [];
    expect(hotNotes.some((n) => n.toLowerCase().includes("hot"))).toBe(true);
    expect(hotNotes.some((n) => n.toLowerCase().includes("altitude"))).toBe(false);
    expect(bothNotes.some((n) => n.toLowerCase().includes("hot"))).toBe(true);
    expect(bothNotes.some((n) => n.toLowerCase().includes("altitude"))).toBe(true);
  });

  it("warns about low sleep and beta-blockers in pre tips", () => {
    const r = calculateExercisePlan({
      ...baseCtx,
      sleepHoursLastNight: 4,
    });
    expect(r.pre.contextualNotes?.some((n) => n.includes("4h sleep"))).toBe(true);
  });

  it("biases bolus reduction higher when history is hypo-prone", () => {
    const baseline = calculateExercisePlan({ ...baseCtx });
    const biased = calculateExercisePlan({
      ...baseCtx,
      historyBias: { totalSessions: 5, typicalResponse: "dropped", hypoProne: true },
    });
    const baselineLo = parseInt(baseline.pre.bolusReduction.match(/^(\d+)/)?.[1] ?? "0", 10);
    const biasedLo = parseInt(biased.pre.bolusReduction.match(/^(\d+)/)?.[1] ?? "0", 10);
    expect(biasedLo).toBeGreaterThan(baselineLo);
    expect(biased.pre.contextualNotes?.some((n) => n.toLowerCase().includes("past sessions"))).toBe(true);
  });

  it("flags alcohol last night in pre and recovery tips", () => {
    const r = calculateExercisePlan({
      ...baseCtx,
      alcoholLastNight: true,
    });
    expect(r.pre.contextualNotes?.some((n) => n.toLowerCase().includes("alcohol last night"))).toBe(true);
    expect(r.recovery.tips.some((t) => t.toLowerCase().includes("alcohol"))).toBe(true);
  });

  it("bumps during/post carbs and adds digestion-timing notes for GLP-1 use", () => {
    const ctx = { ...baseCtx, durationMinutes: 60 };
    const baseline = calculateExercisePlan(ctx);
    const glp1 = calculateExercisePlan({ ...ctx, glp1Last24h: true });
    expect(glp1.during.carbsNeeded).toBeGreaterThanOrEqual(baseline.during.carbsNeeded);
    expect(glp1.pre.contextualNotes?.some((n) => n.toLowerCase().includes("glp-1"))).toBe(true);
    expect(glp1.recovery.tips.some((t) => t.toLowerCase().includes("glp-1"))).toBe(true);
  });

  it("adds masked-symptom caution copy for beta-blocker use without changing carb targets", () => {
    const ctx = { ...baseCtx, durationMinutes: 60 };
    const baseline = calculateExercisePlan(ctx);
    const betaBlocker = calculateExercisePlan({ ...ctx, betaBlockerToday: true });
    expect(betaBlocker.pre.carbsIfLow).toBe(baseline.pre.carbsIfLow);
    expect(betaBlocker.pre.contextualNotes?.some((n) => n.toLowerCase().includes("beta-blocker"))).toBe(true);
    expect(betaBlocker.during.tips.some((t) => t.toLowerCase().includes("beta-blocker"))).toBe(true);
    expect(betaBlocker.recovery.tips.some((t) => t.toLowerCase().includes("beta-blocker"))).toBe(true);
  });
});

describe("calculateExercisePlanFromMessage", () => {
  it("parses legacy message", () => {
    const r = calculateExercisePlanFromMessage("moderate cardio for 30 minutes", "mmol/L");
    expect(r.duration).toBe(30);
    expect(r.exerciseType).toBe("Cardio");
  });

  it("detects court sports from tennis wording", () => {
    const r = calculateExercisePlanFromMessage("moderate tennis for 45 minutes", "mmol/L");
    expect(r.exerciseType).toBe("Court sports");
  });
});

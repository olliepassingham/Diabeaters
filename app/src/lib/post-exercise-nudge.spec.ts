import { describe, expect, it } from "vitest";
import {
  buildSessionContextTipExtras,
  getPostExercisePersonalizedTipBullets,
  getPostExerciseTipPanel,
  inferPostExerciseLoadTier,
  insulinDeliveryForPostExerciseTips,
} from "./post-exercise-nudge";
import type { LastExerciseSummary } from "./storage";

function sum(partial: Partial<LastExerciseSummary>): LastExerciseSummary {
  return {
    endedAt: new Date().toISOString(),
    exerciseType: "cardio",
    intensity: "moderate",
    durationMinutes: 30,
    exerciseName: "Run",
    ...partial,
  };
}

describe("inferPostExerciseLoadTier", () => {
  it("rates short easy yoga as light", () => {
    expect(
      inferPostExerciseLoadTier(
        sum({ exerciseType: "yoga", intensity: "light", durationMinutes: 20 }),
      ),
    ).toBe("light");
  });

  it("rates long intense HIIT as heavy", () => {
    expect(
      inferPostExerciseLoadTier(
        sum({ exerciseType: "hiit", intensity: "intense", durationMinutes: 55 }),
      ),
    ).toBe("heavy");
  });

  it("bumps toward heavy when RPE is high on a long hard session", () => {
    expect(
      inferPostExerciseLoadTier(
        sum({
          exerciseType: "hiit",
          intensity: "intense",
          durationMinutes: 50,
          context: { midRpe: 9 },
        }),
      ),
    ).toBe("heavy");
  });
});

describe("insulinDeliveryForPostExerciseTips", () => {
  it("maps pump and pen", () => {
    expect(insulinDeliveryForPostExerciseTips({ insulinDeliveryMethod: "pump" })).toBe("pump");
    expect(insulinDeliveryForPostExerciseTips({ insulinDeliveryMethod: "  PUMP  " })).toBe("pump");
    expect(insulinDeliveryForPostExerciseTips({ insulinDeliveryMethod: "pen" })).toBe("pen");
    expect(insulinDeliveryForPostExerciseTips({ insulinDeliveryMethod: "" })).toBe("unknown");
  });
});

describe("buildSessionContextTipExtras", () => {
  it("returns alcohol-last-night line when flagged", () => {
    const lines = buildSessionContextTipExtras(
      sum({ context: { alcoholLastNight: true } }),
    );
    expect(lines.some((l) => /alcohol last night/i.test(l))).toBe(true);
  });

  it("caps at two lines when many flags are set", () => {
    const lines = buildSessionContextTipExtras(
      sum({
        context: {
          feltSymptomsDuring: true,
          betaBlockerToday: true,
          alcoholLastNight: true,
          fasted: true,
        },
      }),
    );
    expect(lines.length).toBeLessThanOrEqual(2);
    expect(lines.length).toBeGreaterThanOrEqual(1);
  });
});

describe("getPostExercisePersonalizedTipBullets", () => {
  it("mentions IOB for pump users on moderate load", () => {
    const bullets = getPostExercisePersonalizedTipBullets("moderate", sum({}), "pump", {
      mentionOvernight: false,
    });
    expect(bullets.some((b) => /IOB|pump/i.test(b))).toBe(true);
  });

  it("mentions injections for pen users on moderate load", () => {
    const bullets = getPostExercisePersonalizedTipBullets("moderate", sum({}), "pen", {
      mentionOvernight: false,
    });
    expect(bullets.some((b) => /injections/i.test(b))).toBe(true);
  });

  it("adds a type-specific line when summary is present", () => {
    const bullets = getPostExercisePersonalizedTipBullets("moderate", sum({ exerciseType: "cardio" }), "unknown", {
      mentionOvernight: false,
    });
    expect(bullets.length).toBeGreaterThanOrEqual(2);
    expect(bullets.some((b) => /cardio|high-intensity|delayed lows/i.test(b))).toBe(true);
  });

  it("adds alcohol-last-night context line", () => {
    const bullets = getPostExercisePersonalizedTipBullets(
      "moderate",
      sum({ context: { alcoholLastNight: true } }),
      "unknown",
      { mentionOvernight: false },
    );
    expect(bullets.some((b) => /alcohol last night/i.test(b))).toBe(true);
  });

  it("adds falling-trend context when recovery trend was logged", () => {
    const bullets = getPostExercisePersonalizedTipBullets(
      "moderate",
      sum({ context: { recoveryExerciseTrend: "falling" } }),
      "unknown",
      { mentionOvernight: false },
    );
    expect(bullets.some((b) => /trended down/i.test(b))).toBe(true);
  });

  it("does not use the light-walking tail copy when load tier is heavy", () => {
    const summary = sum({
      exerciseType: "walking",
      intensity: "intense",
      durationMinutes: 120,
      exerciseName: "Walking",
    });
    expect(inferPostExerciseLoadTier(summary)).toBe("heavy");
    const bullets = getPostExercisePersonalizedTipBullets("heavy", summary, "pen", {
      mentionOvernight: false,
    });
    expect(bullets.some((b) => /Lower-impact sessions disturb glucose less/i.test(b))).toBe(false);
    expect(bullets.some((b) => /long or brisk session/i.test(b))).toBe(true);
  });
});

describe("getPostExerciseTipPanel", () => {
  it("keeps at most three short actions", () => {
    const panel = getPostExerciseTipPanel(
      "moderate",
      sum({
        exerciseType: "strength",
        context: {
          feltSymptomsDuring: true,
          alcoholLastNight: true,
          recoveryExerciseTrend: "falling",
        },
      }),
      "pen",
      { mentionOvernight: false },
    );
    expect(panel.actions.length).toBeLessThanOrEqual(3);
    expect(panel.headline.toLowerCase()).not.toMatch(/moderate load/);
    for (const action of panel.actions) {
      expect(action.title.length).toBeLessThanOrEqual(36);
      expect(action.detail.length).toBeLessThanOrEqual(64);
    }
  });

  it("prefers logged context over a generic exercise-type line", () => {
    const panel = getPostExerciseTipPanel(
      "moderate",
      sum({ exerciseType: "cardio", context: { alcoholLastNight: true } }),
      "unknown",
      { mentionOvernight: false },
    );
    expect(panel.actions.some((a) => /alcohol last night/i.test(a.title))).toBe(true);
    expect(panel.actions.some((a) => a.id === "type-cardio")).toBe(false);
  });
});

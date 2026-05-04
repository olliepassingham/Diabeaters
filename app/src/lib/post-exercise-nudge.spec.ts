import { describe, expect, it } from "vitest";
import {
  getPostExercisePersonalizedTipBullets,
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
    expect(insulinDeliveryForPostExerciseTips({ insulinDeliveryMethod: "pen" })).toBe("pen");
    expect(insulinDeliveryForPostExerciseTips({ insulinDeliveryMethod: "" })).toBe("unknown");
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
});

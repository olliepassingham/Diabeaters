import { describe, expect, it } from "vitest";

import {
  buildHomeHeroNarrative,
  resolveHomeNextBestAction,
} from "./home-next-best-action";

const quietTravel = {
  promoted: false,
  label: null,
  reason: "quiet" as const,
};

describe("resolveHomeNextBestAction", () => {
  const base = {
    healthStatus: "stable" as const,
    sickDayActive: false,
    pumpFailureActive: false,
    exerciseActive: false,
    travelPromote: quietTravel,
    travelModeActive: false,
    bedtimeDue: false,
    mealMoment: null,
    mealDismissed: false,
    hasCriticalSupply: false,
    showCoach: true,
  };

  it("prioritises help when health is action", () => {
    const a = resolveHomeNextBestAction({ ...base, healthStatus: "action" });
    expect(a.id).toBe("help_now");
  });

  it("prioritises exercise over meal", () => {
    const a = resolveHomeNextBestAction({
      ...base,
      exerciseActive: true,
      mealMoment: { slot: "lunch", title: "Planning lunch?", timeLabel: "Midday" },
    });
    expect(a.id).toBe("exercise");
  });

  it("promotes travel insulin shift over meal", () => {
    const a = resolveHomeNextBestAction({
      ...base,
      travelModeActive: true,
      travelPromote: { promoted: true, label: "Insulin", reason: "insulin_shift" },
      mealMoment: { slot: "dinner", title: "Planning dinner?", timeLabel: "Evening" },
    });
    expect(a.id).toBe("travel");
    expect(a.label.toLowerCase()).toMatch(/insulin/);
  });

  it("uses meal moment when calm", () => {
    const a = resolveHomeNextBestAction({
      ...base,
      mealMoment: { slot: "breakfast", title: "Planning breakfast?", timeLabel: "Morning" },
    });
    expect(a.id).toBe("meal");
    expect(a.label).toBe("Plan breakfast");
  });

  it("falls back to coach when calm and no meal", () => {
    expect(resolveHomeNextBestAction(base).id).toBe("coach");
  });
});

describe("buildHomeHeroNarrative", () => {
  it("leads with BG when available", () => {
    const n = buildHomeHeroNarrative({
      healthStatus: "stable",
      bgValue: "6.2",
      bgUnits: "mmol/L",
      trendLabel: "flat",
      nextActionSubline: "Steady stretch — ask if anything feels off.",
    });
    expect(n.primary).toBe("6.2");
    expect(n.primarySuffix).toBe("mmol/L");
    expect(n.supporting).toMatch(/Steady/);
  });

  it("uses Steady word without BG", () => {
    const n = buildHomeHeroNarrative({
      healthStatus: "stable",
      bgValue: null,
      bgUnits: null,
      trendLabel: null,
      nextActionSubline: "Open the adviser when you eat.",
    });
    expect(n.primary).toBe("Steady");
  });
});

import { describe, expect, it } from "vitest";

import {
  buildCoachStarterContext,
  coachHourToTimeBand,
  pickCoachStarterPrompts,
} from "@/lib/ai-coach/coach-starter-prompts";
import { COACH_TOPIC_SLUGS } from "@/lib/ai-coach/topics";

describe("coach-starter-prompts", () => {
  it("maps hours to time bands", () => {
    expect(coachHourToTimeBand(8)).toBe("morning");
    expect(coachHourToTimeBand(14)).toBe("afternoon");
    expect(coachHourToTimeBand(20)).toBe("evening");
    expect(coachHourToTimeBand(23)).toBe("night");
  });

  it("returns three unique starters per topic", () => {
    const ctx = {
      timeBand: "evening" as const,
      sickDayActive: false,
      travelModeActive: false,
      pumpFailureActive: false,
      suppliesLow: false,
      hasTrackedSupplies: true,
    };
    const now = new Date(2026, 5, 9, 20, 0, 0);

    for (const topic of COACH_TOPIC_SLUGS) {
      const picks = pickCoachStarterPrompts(topic, ctx, { userId: "u1", now });
      expect(picks).toHaveLength(3);
      expect(new Set(picks).size).toBe(3);
    }
  });

  it("boosts evening starters on general topic at night", () => {
    const eveningCtx = {
      timeBand: "evening" as const,
      sickDayActive: false,
      travelModeActive: false,
      pumpFailureActive: false,
      suppliesLow: false,
      hasTrackedSupplies: false,
    };
    const morningCtx = { ...eveningCtx, timeBand: "morning" as const };
    const now = new Date(2026, 5, 9, 20, 0, 0);

    const eveningPicks = pickCoachStarterPrompts("general", eveningCtx, { userId: "u1", now });
    const morningPicks = pickCoachStarterPrompts("general", morningCtx, {
      userId: "u1",
      now: new Date(2026, 5, 9, 8, 0, 0),
    });

    expect(eveningPicks.some((q) => /evening checks/i.test(q))).toBe(true);
    expect(morningPicks.some((q) => /dawn phenomenon/i.test(q))).toBe(true);
  });

  it("is stable within the same day and user", () => {
    const ctx = buildCoachStarterContext(new Date(2026, 5, 9, 15, 0, 0));
    const a = pickCoachStarterPrompts("general", ctx, {
      userId: "stable-user",
      now: new Date(2026, 5, 9, 9, 0, 0),
    });
    const b = pickCoachStarterPrompts("general", ctx, {
      userId: "stable-user",
      now: new Date(2026, 5, 9, 21, 0, 0),
    });
    expect(a).toEqual(b);
  });

  it("can rotate between days", () => {
    const ctx = {
      timeBand: "afternoon" as const,
      sickDayActive: false,
      travelModeActive: false,
      pumpFailureActive: false,
      suppliesLow: false,
      hasTrackedSupplies: false,
    };
    const day1 = pickCoachStarterPrompts("general", ctx, {
      userId: "u1",
      now: new Date(2026, 5, 9, 12, 0, 0),
    });
    const day2 = pickCoachStarterPrompts("general", ctx, {
      userId: "u1",
      now: new Date(2026, 5, 10, 12, 0, 0),
    });
    expect(day1).not.toEqual(day2);
  });
});

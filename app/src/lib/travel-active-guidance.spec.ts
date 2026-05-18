import { describe, expect, it } from "vitest";

import {
  buildActiveTravelCoachPrompt,
  buildActiveTravelTodayFocus,
  buildActiveTravelTripProfileChips,
} from "./travel-active-guidance";

const basePlan = {
  destination: "Morocco",
  travelType: "international" as const,
  timezoneChange: "none" as const,
  timezoneHours: 0,
  timezoneDirection: "none" as const,
  accessRisk: "easy" as const,
  weatherChange: "warmer" as const,
  weatherSeverity: "moderate" as const,
  tripStyle: "relax" as const,
};

const baseInput = {
  plan: basePlan,
  totalDays: 7,
  hasStarted: true,
  hasEnded: false,
  daysUntilStart: 0,
  daysRemaining: 6,
  isPumpUser: false,
};

describe("buildActiveTravelTripProfileChips", () => {
  it("includes compact labels", () => {
    const labels = buildActiveTravelTripProfileChips(basePlan).map((c) => c.label);
    expect(labels).toContain("Relaxing");
    expect(labels).toContain("International");
    expect(labels).toContain("Warmer");
  });
});

describe("buildActiveTravelTodayFocus", () => {
  it("stays short", () => {
    const focus = buildActiveTravelTodayFocus({ ...baseInput, dayNumber: 1 });
    expect(focus.length).toBeLessThan(80);
    expect(focus.split(".").length).toBeLessThanOrEqual(2);
  });

  it("prioritises heat over generic day-1 copy", () => {
    const focus = buildActiveTravelTodayFocus({ ...baseInput, dayNumber: 1 });
    expect(focus.toLowerCase()).toMatch(/cool|hypos/);
  });

  it("prioritises limited pharmacies", () => {
    const focus = buildActiveTravelTodayFocus({
      ...baseInput,
      dayNumber: 1,
      plan: { ...basePlan, weatherChange: "similar" as const, accessRisk: "limited" },
    });
    expect(focus.toLowerCase()).toContain("backup");
  });

  it("guides pre-departure briefly", () => {
    const focus = buildActiveTravelTodayFocus({
      ...baseInput,
      dayNumber: 0,
      hasStarted: false,
      daysUntilStart: 3,
    });
    expect(focus.toLowerCase()).toContain("packing");
  });
});

describe("buildActiveTravelCoachPrompt", () => {
  it("includes destination and stays under limit", () => {
    const q = buildActiveTravelCoachPrompt({ ...baseInput, dayNumber: 2 });
    expect(q).toContain("Morocco");
    expect(q.length).toBeLessThanOrEqual(500);
  });
});

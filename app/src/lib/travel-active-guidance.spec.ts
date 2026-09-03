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

  it("prioritises heat over relax style on day 1", () => {
    const focus = buildActiveTravelTodayFocus({ ...baseInput, dayNumber: 1 });
    expect(focus.toLowerCase()).toMatch(/cool|hypos/);
  });

  it("combines active trip with warmer weather on early trip days", () => {
    const focus = buildActiveTravelTodayFocus({
      ...baseInput,
      dayNumber: 1,
      plan: { ...basePlan, tripStyle: "active", weatherChange: "warmer" as const },
    });
    expect(focus.toLowerCase()).toMatch(/heat|effort|check/);
  });

  it("nudges active travellers the day before departure", () => {
    const focus = buildActiveTravelTodayFocus({
      ...baseInput,
      dayNumber: 0,
      hasStarted: false,
      daysUntilStart: 1,
      plan: { ...basePlan, tripStyle: "active", weatherChange: "similar" as const },
    });
    expect(focus.toLowerCase()).toMatch(/tomorrow|carbs|bags/);
  });

  it("nudges active travellers a few days before departure", () => {
    const focus = buildActiveTravelTodayFocus({
      ...baseInput,
      dayNumber: 0,
      hasStarted: false,
      daysUntilStart: 2,
      plan: { ...basePlan, tripStyle: "active", weatherChange: "similar" as const },
    });
    expect(focus.toLowerCase()).toMatch(/carry-on|carbs|checklist/);
  });

  it("prioritises limited pharmacies over relax style", () => {
    const focus = buildActiveTravelTodayFocus({
      ...baseInput,
      dayNumber: 1,
      plan: {
        ...basePlan,
        weatherChange: "similar" as const,
        accessRisk: "limited",
        tripStyle: "relax",
      },
    });
    expect(focus.toLowerCase()).toContain("backup");
  });

  it("uses city style when no higher-priority signals", () => {
    const focus = buildActiveTravelTodayFocus({
      ...baseInput,
      dayNumber: 3,
      plan: {
        ...basePlan,
        weatherChange: "similar" as const,
        tripStyle: "city",
      },
    });
    expect(focus.toLowerCase()).toMatch(/late meals|check/);
  });

  it("uses family style when no higher-priority signals", () => {
    const focus = buildActiveTravelTodayFocus({
      ...baseInput,
      dayNumber: 3,
      plan: {
        ...basePlan,
        weatherChange: "unknown" as const,
        tripStyle: "family",
      },
    });
    expect(focus.toLowerCase()).toMatch(/hypo plan/);
  });

  it("timezone beats trip style", () => {
    const focus = buildActiveTravelTodayFocus({
      ...baseInput,
      dayNumber: 1,
      plan: {
        ...basePlan,
        timezoneChange: "major" as const,
        timezoneHours: 6,
        timezoneDirection: "east" as const,
        tripStyle: "city",
      },
    });
    expect(focus.toLowerCase()).toMatch(/long-acting|local time|pump/);
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

  it("includes trip type and style-specific question for city breaks", () => {
    const q = buildActiveTravelCoachPrompt({
      ...baseInput,
      dayNumber: 2,
      plan: { ...basePlan, tripStyle: "city", weatherChange: "similar" as const },
    });
    expect(q).toContain("Trip type: City break");
    expect(q.toLowerCase()).toMatch(/eating out|irregular/);
  });

  it("includes activity stem for active holidays", () => {
    const q = buildActiveTravelCoachPrompt({
      ...baseInput,
      plan: { ...basePlan, tripStyle: "active", weatherChange: "similar" as const },
    });
    expect(q.toLowerCase()).toMatch(/activity|hypos/);
  });
});

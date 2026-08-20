import { describe, expect, it } from "vitest";
import {
  buildTravelWeatherRiskWarnings,
  holidaySupplyDaysNeeded,
  travelAccessBufferMultiplier,
  travelPackingBufferMultiplier,
  travelPlanStockBufferMultiplier,
  travelStockBufferCombined,
  travelWeatherAdhesivePiecesMultiplier,
  travelWeatherCgmSpareExtraCount,
  travelWeatherHypoTreatmentsMultiplier,
  travelWeatherPlanSliceFromStoredPlan,
  travelWeatherPumpPowerMultiplier,
  travelWeatherSupplyShortfallMultiplier,
  travelWeatherTestStripMultiplier,
  tripCalendarDaysBetween,
  tripSupplyDaysNeeded,
  tripSupplyOrderByDate,
} from "./travel-supply-policy";

describe("tripCalendarDaysBetween", () => {
  it("counts whole days between midnights", () => {
    expect(tripCalendarDaysBetween("2026-01-01", "2026-01-07")).toBe(6);
  });

  it("treats same start and end as one day", () => {
    expect(tripCalendarDaysBetween("2026-03-10", "2026-03-10")).toBe(1);
  });
});

describe("holidaySupplyDaysNeeded", () => {
  it("doubles trip length at minimum 1", () => {
    expect(holidaySupplyDaysNeeded(7)).toBe(14);
    expect(holidaySupplyDaysNeeded(1)).toBe(2);
  });
});

describe("tripSupplyDaysNeeded", () => {
  it("uses packing buffer for domestic easy access", () => {
    expect(tripSupplyDaysNeeded({ calendarTripDays: 7, plan: null })).toBe(11); // ceil(7 * 1.5)
  });

  it("uses international buffer when plan says so", () => {
    expect(
      tripSupplyDaysNeeded({
        calendarTripDays: 7,
        plan: { travelType: "international", accessRisk: "easy" },
      }),
    ).toBe(14);
  });
});

describe("tripSupplyOrderByDate", () => {
  it("picks the earlier of trip lead-time and stock run-out", () => {
    const today = new Date(2026, 5, 1); // 1 Jun 2026 local
    expect(
      tripSupplyOrderByDate({
        departureDate: "2026-06-20",
        daysRemaining: 40,
        leadTimeDays: 5,
        today,
      }),
    ).toBe("2026-06-15"); // departure - 5

    expect(
      tripSupplyOrderByDate({
        departureDate: "2026-07-20",
        daysRemaining: 10,
        leadTimeDays: 5,
        today,
      }),
    ).toBe("2026-06-06"); // today + 10 - 5
  });

  it("clamps past dates to today", () => {
    const today = new Date(2026, 5, 10);
    expect(
      tripSupplyOrderByDate({
        departureDate: "2026-06-12",
        daysRemaining: 3,
        leadTimeDays: 5,
        today,
      }),
    ).toBe("2026-06-10");
  });
});

describe("travelStockBufferCombined", () => {
  it("matches packing list factors", () => {
    expect(travelStockBufferCombined({ travelType: "domestic", accessRisk: "easy" })).toBe(1.5);
    expect(travelStockBufferCombined({ travelType: "international", accessRisk: "easy" })).toBe(2);
    expect(travelStockBufferCombined({ travelType: "domestic", accessRisk: "limited" })).toBe(2.25);
    expect(travelStockBufferCombined({ travelType: "international", accessRisk: "limited" })).toBe(3);
  });
});

describe("travelPlanStockBufferMultiplier", () => {
  it("defaults when plan missing", () => {
    expect(travelPlanStockBufferMultiplier(null)).toBe(1.5);
    expect(travelPlanStockBufferMultiplier(undefined)).toBe(1.5);
  });

  it("reads travelType and accessRisk", () => {
    expect(
      travelPlanStockBufferMultiplier({ travelType: "international", accessRisk: "unsure" }),
    ).toBeCloseTo(2 * 1.3, 5);
  });
});

describe("travelPackingBufferMultiplier / travelAccessBufferMultiplier", () => {
  it("exposes factors used by travel page", () => {
    expect(travelPackingBufferMultiplier("domestic")).toBe(1.5);
    expect(travelAccessBufferMultiplier("unsure")).toBe(1.3);
  });
});

describe("travel weather multipliers", () => {
  it("returns 1 when climate is similar or unknown", () => {
    expect(travelWeatherHypoTreatmentsMultiplier({ weatherChange: "similar", weatherSeverity: "moderate" })).toBe(1);
    expect(travelWeatherAdhesivePiecesMultiplier({ weatherChange: "unknown", weatherSeverity: "extreme" })).toBe(1);
  });

  it("increases hypo and adhesive bumps for warmer extreme", () => {
    const wx = { weatherChange: "warmer" as const, weatherSeverity: "extreme" as const };
    expect(travelWeatherHypoTreatmentsMultiplier(wx)).toBeGreaterThan(1.4);
    expect(travelWeatherAdhesivePiecesMultiplier(wx)).toBe(1.6);
    expect(travelWeatherCgmSpareExtraCount(wx)).toBe(1);
    expect(travelWeatherPumpPowerMultiplier(wx)).toBe(1.2);
  });

  it("adds CGM spare for moderate heat only", () => {
    expect(
      travelWeatherCgmSpareExtraCount({ weatherChange: "warmer", weatherSeverity: "moderate" }),
    ).toBe(1);
    expect(
      travelWeatherCgmSpareExtraCount({ weatherChange: "warmer", weatherSeverity: "slight" }),
    ).toBe(0);
  });

  it("bumps test strips for meaningful climate change", () => {
    expect(travelWeatherTestStripMultiplier({ weatherChange: "colder", weatherSeverity: "moderate" })).toBe(1.1);
  });
});

describe("buildTravelWeatherRiskWarnings", () => {
  it("returns nothing for similar or unknown", () => {
    expect(buildTravelWeatherRiskWarnings({ weatherChange: "similar", weatherSeverity: "moderate" })).toHaveLength(0);
    expect(buildTravelWeatherRiskWarnings({ weatherChange: "unknown", weatherSeverity: "slight" })).toHaveLength(0);
  });

  it("returns one warning for warmer moderate", () => {
    const w = buildTravelWeatherRiskWarnings({ weatherChange: "warmer", weatherSeverity: "moderate" });
    expect(w).toHaveLength(1);
    expect(w[0].severity).toBe("medium");
  });
});

describe("travelWeatherPlanSliceFromStoredPlan", () => {
  it("defaults when plan missing", () => {
    expect(travelWeatherPlanSliceFromStoredPlan(null)).toEqual({
      weatherChange: "unknown",
      weatherSeverity: "moderate",
    });
  });

  it("reads valid fields", () => {
    expect(
      travelWeatherPlanSliceFromStoredPlan({ weatherChange: "warmer", weatherSeverity: "extreme" }),
    ).toEqual({ weatherChange: "warmer", weatherSeverity: "extreme" });
  });
});

describe("travelWeatherSupplyShortfallMultiplier", () => {
  const intervals = { cgmDays: 14, siteChangeDays: 3, reservoirChangeDays: 3 };

  it("is 1 for unknown climate on cgm", () => {
    expect(
      travelWeatherSupplyShortfallMultiplier("cgm", { weatherChange: "unknown", weatherSeverity: "moderate" }, 14, intervals),
    ).toBe(1);
  });

  it("bumps cgm in heat for a 14-day trip", () => {
    const m = travelWeatherSupplyShortfallMultiplier(
      "cgm",
      { weatherChange: "warmer", weatherSeverity: "moderate" },
      14,
      intervals,
    );
    expect(m).toBeGreaterThan(1);
  });
});

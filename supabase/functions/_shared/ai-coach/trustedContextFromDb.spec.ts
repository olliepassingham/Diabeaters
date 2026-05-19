import { describe, expect, it } from "vitest";
import {
  buildSuppliesCoachSummary,
  deriveScenarioFlagsFromRows,
  scenarioStateFlag,
} from "./trustedContextFromDb.ts";

describe("scenarioStateFlag / deriveScenarioFlagsFromRows", () => {
  it("detects sick day from snake or camel case", () => {
    expect(scenarioStateFlag({ sick_day_active: true }, ["sick_day_active", "sickDayActive"])).toBe(true);
    expect(scenarioStateFlag({ sickDayActive: "true" }, ["sick_day_active", "sickDayActive"])).toBe(true);
    expect(scenarioStateFlag({ sick_day_active: false }, ["sick_day_active", "sickDayActive"])).toBe(false);
  });

  it("merges rows for sick_day and travel keys", () => {
    expect(
      deriveScenarioFlagsFromRows([
        { scenario_key: "sick_day", state: { sick_day_active: true } },
        { scenario_key: "travel", state: { travel_active: true } },
      ]),
    ).toEqual({ sickDayActive: true, travelModeActive: true, travelTripStyle: undefined });
    expect(deriveScenarioFlagsFromRows([{ scenario_key: "travel", state: { travelModeActive: 1 } }])).toEqual({
      sickDayActive: false,
      travelModeActive: true,
      travelTripStyle: undefined,
    });
  });

  it("reads travel_trip_style when travel is active", () => {
    expect(
      deriveScenarioFlagsFromRows([
        { scenario_key: "travel", state: { travel_active: true, travel_trip_style: "active" } },
      ]),
    ).toEqual({ sickDayActive: false, travelModeActive: true, travelTripStyle: "active" });
  });
});

describe("buildSuppliesCoachSummary", () => {
  it("returns undefined for empty rows", () => {
    expect(buildSuppliesCoachSummary([])).toBeUndefined();
  });

  it("counts critical slots and buckets unknown categories into other", () => {
    const s = buildSuppliesCoachSummary([
      { category: "cgm", quantity: 2, days_remaining_cached: 10 },
      { category: "infusion_set", quantity: 0, days_remaining_cached: null },
      { category: "weird", quantity: 1, days_remaining_cached: null },
    ]);
    expect(s?.trackedSlots).toBe(3);
    expect(s?.criticalOrEmptySlots).toBe(1);
    expect(s?.slotsByCategory.cgm).toBe(1);
    expect(s?.slotsByCategory.infusion_set).toBe(1);
    expect(s?.slotsByCategory.other).toBe(1);
  });

  it("treats low days_remaining_cached as critical", () => {
    const s = buildSuppliesCoachSummary([
      { category: "insulin", quantity: 5, days_remaining_cached: 2 },
    ]);
    expect(s?.criticalOrEmptySlots).toBe(1);
  });
});

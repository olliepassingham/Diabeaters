import { describe, expect, it, vi, afterEach } from "vitest";
import {
  getHealthStatus,
  getTodayGlanceLine,
  shouldOmitHeroGlanceLineDuplicatingTodayCard,
} from "./dashboard-health-status";
import { storage } from "./storage";
import type { ScenarioState, Supply } from "./storage";

const emptyScenario = {
  travelModeActive: false,
  sickDayActive: false,
  travelDestination: undefined,
  travelEndDate: undefined,
  sickDaySeverity: undefined,
} as ScenarioState;

const dummySupply = { id: "t", name: "Test strips" } as Supply;

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getHealthStatus", () => {
  it("returns watch when any supply is low (not critical)", () => {
    vi.spyOn(storage, "getSupplyStatus").mockReturnValue("low");
    expect(getHealthStatus([dummySupply], emptyScenario)).toBe("watch");
  });

  it("returns stable when supplies are ok", () => {
    vi.spyOn(storage, "getSupplyStatus").mockReturnValue("ok");
    expect(getHealthStatus([dummySupply], emptyScenario)).toBe("stable");
  });

  it("returns stable when only travel mode is active", () => {
    vi.spyOn(storage, "getSupplyStatus").mockReturnValue("ok");
    const travelScenario = {
      ...emptyScenario,
      travelModeActive: true,
      travelDestination: "Morocco",
    } as ScenarioState;
    expect(getHealthStatus([dummySupply], travelScenario)).toBe("stable");
  });
});

describe("getTodayGlanceLine", () => {
  it("still mentions travel when pill stays stable", () => {
    vi.spyOn(storage, "getSupplyStatus").mockReturnValue("ok");
    const travelScenario = {
      ...emptyScenario,
      travelModeActive: true,
      travelDestination: "Morocco",
    } as ScenarioState;
    const line = getTodayGlanceLine([dummySupply], travelScenario);
    expect(line.type).toBe("info");
    expect(line.message).toMatch(/travel mode active.*morocco/i);
  });

  it("does not say all clear when supplies are low", () => {
    vi.spyOn(storage, "getSupplyStatus").mockReturnValue("low");
    const line = getTodayGlanceLine([dummySupply], emptyScenario);
    expect(line.type).toBe("info");
    expect(line.message).toMatch(/running low/i);
    expect(line.message).not.toMatch(/all clear/i);
  });
});

describe("shouldOmitHeroGlanceLineDuplicatingTodayCard", () => {
  it("returns true for low-stock glance so hero can defer to Today card", () => {
    vi.spyOn(storage, "getSupplyStatus").mockReturnValue("low");
    const glance = getTodayGlanceLine([dummySupply], emptyScenario);
    expect(shouldOmitHeroGlanceLineDuplicatingTodayCard(glance, [dummySupply])).toBe(true);
  });

  it("returns true for critical-supplies glance", () => {
    vi.spyOn(storage, "getSupplyStatus").mockReturnValue("critical");
    const glance = getTodayGlanceLine([dummySupply], emptyScenario);
    expect(shouldOmitHeroGlanceLineDuplicatingTodayCard(glance, [dummySupply])).toBe(true);
  });

  it("omits travel-mode glance in hero when Active travel chip is shown", () => {
    vi.spyOn(storage, "getSupplyStatus").mockReturnValue("ok");
    const travelScenario = {
      ...emptyScenario,
      travelModeActive: true,
      travelDestination: "Morocco",
    } as ScenarioState;
    const glance = getTodayGlanceLine([dummySupply], travelScenario);
    expect(shouldOmitHeroGlanceLineDuplicatingTodayCard(glance, [dummySupply], travelScenario)).toBe(true);
  });
});

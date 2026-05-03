import { describe, expect, it } from "vitest";
import { buildTodayRailItems } from "./today-rail";
import type { Appointment, ScenarioState, Supply } from "@/lib/storage";

const sampleSupply: Supply = {
  id: "s1",
  name: "Insulin",
  type: "insulin",
  currentQuantity: 2,
  dailyUsage: 1,
};

const baseScenario: ScenarioState = {
  travelModeActive: false,
  sickDayActive: false,
};

function statusFor(_s: Supply): "critical" | "low" | "ok" {
  return "ok";
}

describe("buildTodayRailItems", () => {
  it("returns empty when nothing is active", () => {
    const items = buildTodayRailItems({
      now: new Date("2026-05-03T12:00:00Z"),
      supplies: [],
      getSupplyStatus: statusFor,
      scenarioState: baseScenario,
      activeExercise: null,
      sickDayMeds: [],
      appointments: [],
      unreadInAppCount: 0,
    });
    expect(items).toEqual([]);
  });

  it("prioritises critical supplies over low", () => {
    const supplies: Supply[] = [sampleSupply];
    const getSupplyStatus = () => "critical" as const;
    const items = buildTodayRailItems({
      now: new Date("2026-05-03T12:00:00Z"),
      supplies,
      getSupplyStatus,
      scenarioState: baseScenario,
      activeExercise: null,
      sickDayMeds: [],
      appointments: [],
      unreadInAppCount: 0,
    });
    expect(items.some((i) => i.id === "supply-critical")).toBe(true);
  });

  it("includes unread inbox when count > 0", () => {
    const items = buildTodayRailItems({
      now: new Date("2026-05-03T12:00:00Z"),
      supplies: [],
      getSupplyStatus: statusFor,
      scenarioState: baseScenario,
      activeExercise: null,
      sickDayMeds: [],
      appointments: [],
      unreadInAppCount: 2,
    });
    const inbox = items.find((i) => i.id === "inapp-unread");
    expect(inbox?.detail).toContain("2");
  });

  it("surfaces upcoming appointment within 72h", () => {
    const appt: Appointment = {
      id: "a1",
      title: "Clinic",
      type: "clinic",
      date: "2026-05-04",
      time: "10:00",
      isCompleted: false,
      createdAt: new Date().toISOString(),
    };
    const items = buildTodayRailItems({
      now: new Date("2026-05-03T12:00:00Z"),
      supplies: [],
      getSupplyStatus: statusFor,
      scenarioState: baseScenario,
      activeExercise: null,
      sickDayMeds: [],
      appointments: [appt],
      unreadInAppCount: 0,
    });
    expect(items.some((i) => i.id.startsWith("appt-"))).toBe(true);
  });
});

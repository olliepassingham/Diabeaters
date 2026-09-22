import { describe, expect, it } from "vitest";

import {
  buildStatusBarModel,
  isTravelInsulinOutboundShiftDay,
  isTravelPackingIncomplete,
  resolveTravelPromote,
} from "./status-bar-model";

describe("resolveTravelPromote", () => {
  const base = {
    travelModeActive: true,
    travelStartDate: "2026-07-01",
    travelEndDate: "2026-07-10",
    timezoneHours: 7,
    timezoneChange: "major" as const,
    packingIncomplete: false,
  };

  it("stays quiet mid-trip after insulin shift window", () => {
    const r = resolveTravelPromote({
      ...base,
      today: new Date("2026-07-08T12:00:00"),
    });
    expect(r.promoted).toBe(false);
    expect(r.reason).toBe("quiet");
    expect(r.label).toBeNull();
  });

  it("promotes insulin shift on early outbound days", () => {
    const r = resolveTravelPromote({
      ...base,
      today: new Date("2026-07-02T12:00:00"),
    });
    expect(r.promoted).toBe(true);
    expect(r.reason).toBe("insulin_shift");
    expect(r.label).toBe("Insulin");
  });

  it("promotes return day and homebound after endDate", () => {
    expect(
      resolveTravelPromote({ ...base, today: new Date("2026-07-10T12:00:00") }),
    ).toMatchObject({ promoted: true, reason: "return_day", label: "Return" });
    expect(
      resolveTravelPromote({ ...base, today: new Date("2026-07-12T12:00:00") }),
    ).toMatchObject({ promoted: true, reason: "homebound", label: "Homebound" });
  });

  it("promotes packing when incomplete on quiet days", () => {
    const r = resolveTravelPromote({
      ...base,
      packingIncomplete: true,
      today: new Date("2026-07-08T12:00:00"),
    });
    expect(r).toMatchObject({ promoted: true, reason: "packing", label: "Pack" });
  });

  it("returns none when travel inactive", () => {
    expect(resolveTravelPromote({ ...base, travelModeActive: false }).reason).toBe("none");
  });
});

describe("isTravelInsulinOutboundShiftDay", () => {
  const start = new Date("2026-07-01T12:00:00");
  const end = new Date("2026-07-10T12:00:00");

  it("is true early in trip and false after shift days", () => {
    expect(isTravelInsulinOutboundShiftDay(new Date("2026-07-01T12:00:00"), start, end, 7)).toBe(true);
    expect(isTravelInsulinOutboundShiftDay(new Date("2026-07-04T12:00:00"), start, end, 7)).toBe(true);
    expect(isTravelInsulinOutboundShiftDay(new Date("2026-07-06T12:00:00"), start, end, 7)).toBe(false);
  });
});

describe("isTravelPackingIncomplete", () => {
  it("detects unchecked items", () => {
    expect(isTravelPackingIncomplete([])).toBe(false);
    expect(isTravelPackingIncomplete([{ checked: true }])).toBe(false);
    expect(isTravelPackingIncomplete([{ checked: true }, { checked: false }])).toBe(true);
  });
});

describe("buildStatusBarModel", () => {
  it("includes quiet travel as icon-only segment plus expand section", () => {
    const model = buildStatusBarModel({
      showCgm: true,
      online: true,
      travelModeActive: true,
      travelDestination: "Spain",
      travelStartDate: "2026-07-01",
      travelEndDate: "2026-07-10",
      timezoneHours: 7,
      timezoneChange: "major",
      packingIncomplete: false,
      sickDayActive: false,
      pumpFailureActive: false,
      exerciseActive: false,
      postExerciseEducational: false,
      postExerciseSnoozed: false,
      today: new Date("2026-07-08T12:00:00"),
    });
    expect(model.visible).toBe(true);
    const travel = model.segments.find((s) => s.kind === "travel");
    expect(travel?.promoted).toBe(false);
    expect(travel?.label).toBeNull();
    expect(model.expandSections.some((s) => s.id === "travel" && s.canEnd)).toBe(true);
  });

  it("promotes exercise and sick into labeled segments", () => {
    const model = buildStatusBarModel({
      showCgm: false,
      online: true,
      travelModeActive: false,
      timezoneHours: 0,
      timezoneChange: "none",
      packingIncomplete: false,
      sickDayActive: true,
      sickDaySeverity: "mild",
      pumpFailureActive: false,
      exerciseActive: true,
      exercisePhaseLabel: "during",
      exerciseTimerLabel: "12:04",
      postExerciseEducational: false,
      postExerciseSnoozed: false,
    });
    expect(model.segments.map((s) => s.kind)).toEqual(["sick", "exercise"]);
    expect(model.segments.find((s) => s.kind === "exercise")?.label).toBe("during · 12:04");
  });
});

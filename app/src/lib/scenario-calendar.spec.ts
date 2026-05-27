import { beforeEach, describe, expect, it } from "vitest";

import {
  collectScenarioCalendarDays,
  enumerateScenarioDayKeysForRange,
  scenarioModesOnDay,
} from "./scenario-calendar";
import { storage } from "./storage";

describe("scenario-calendar", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("enumerates inclusive calendar days for yyyy-MM-dd travel", () => {
    const keys = enumerateScenarioDayKeysForRange("2026-05-10", "2026-05-12", { allowFutureEnd: true });
    expect(keys).toEqual(["2026-05-10", "2026-05-11", "2026-05-12"]);
  });

  it("caps active ranges to today when allowFutureEnd is false", () => {
    const today = new Date();
    const start = new Date(today);
    start.setDate(start.getDate() - 2);
    const future = new Date(today);
    future.setDate(future.getDate() + 10);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    const keys = enumerateScenarioDayKeysForRange(fmt(start), fmt(future), { allowFutureEnd: false });
    expect(keys).toHaveLength(3);
    expect(keys.at(-1)).toBe(fmt(today));
  });

  it("maps sick day history and active travel from storage", () => {
    storage.addScenarioHistory({
      id: "h1",
      type: "sick_day",
      startDate: "2026-03-01T08:00:00.000Z",
      endDate: "2026-03-02T20:00:00.000Z",
      notes: "",
    });

    storage.activateTravelMode("Paris", "2026-04-01", "2026-04-03");

    const map = collectScenarioCalendarDays();
    expect(scenarioModesOnDay(map, "2026-03-01")).toContain("sick_day");
    expect(scenarioModesOnDay(map, "2026-03-02")).toContain("sick_day");
    expect(scenarioModesOnDay(map, "2026-04-02")).toEqual(["travel"]);
  });
});

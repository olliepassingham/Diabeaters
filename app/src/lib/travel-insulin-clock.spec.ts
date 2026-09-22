import { describe, expect, it } from "vitest";

import {
  buildBasalAdjustmentSchedule,
  buildBasalReturnAdjustmentSchedule,
  daysNeededForTimezoneShift,
  daysPastTravelEnd,
  flipTimezoneDirection,
  isTravelInsulinHomebound,
  pickBasalRowForDay,
  shouldAutoEndTravelMode,
  timezoneChangeFromHours,
} from "./travel-insulin-clock";

describe("buildBasalAdjustmentSchedule", () => {
  it("maps a 7h east trip so travel-day 22:00 home is 05:00 local", () => {
    const rows = buildBasalAdjustmentSchedule("22:00", {
      timezoneHours: 7,
      timezoneDirection: "east",
      timezoneChange: "major",
    });
    expect(rows[0]?.localTime).toBe("05:00");
    expect(rows[0]?.homeTime).toBe("22:00");
    const onwards = rows.find((r) => r.label === "After that");
    expect(onwards?.localTime).toBe("22:00");
  });

  it("maps a 7h west trip so travel-day 22:00 home is 15:00 local", () => {
    const rows = buildBasalAdjustmentSchedule("22:00", {
      timezoneHours: 7,
      timezoneDirection: "west",
      timezoneChange: "major",
    });
    expect(rows[0]?.localTime).toBe("15:00");
    expect(rows[0]?.homeTime).toBe("22:00");
    const onwards = rows.find((r) => r.label === "After that");
    expect(onwards?.localTime).toBe("22:00");
  });

  it("picks later trip days as fully local", () => {
    const rows = buildBasalAdjustmentSchedule("22:00", {
      timezoneHours: 7,
      timezoneDirection: "east",
      timezoneChange: "major",
    });
    const day10 = pickBasalRowForDay(rows, 10);
    expect(day10?.localTime).toBe("22:00");
  });
});

describe("buildBasalReturnAdjustmentSchedule", () => {
  it("round-trips 22:00 home through 7h east and back to 22:00 home local", () => {
    const outbound = buildBasalAdjustmentSchedule("22:00", {
      timezoneHours: 7,
      timezoneDirection: "east",
      timezoneChange: "major",
    });
    const adaptedLocal = outbound.find((r) => r.label === "After that")?.localTime;
    expect(adaptedLocal).toBe("22:00");

    const homebound = buildBasalReturnAdjustmentSchedule("22:00", {
      timezoneHours: 7,
      timezoneDirection: "east",
      timezoneChange: "major",
    });
    expect(homebound[0]?.label).toBe("Return travel day");
    expect(homebound[0]?.localTime).toBe("15:00");
    const back = homebound.find((r) => r.label === "Back on home time");
    expect(back?.localTime).toBe("22:00");
    expect(pickBasalRowForDay(homebound, 10)?.localTime).toBe("22:00");
  });

  it("round-trips west outbound then return to home local", () => {
    const homebound = buildBasalReturnAdjustmentSchedule("22:00", {
      timezoneHours: 7,
      timezoneDirection: "west",
      timezoneChange: "major",
    });
    expect(homebound[0]?.localTime).toBe("05:00");
    expect(homebound.find((r) => r.label === "Back on home time")?.localTime).toBe("22:00");
  });
});

describe("daysNeededForTimezoneShift", () => {
  it("ceil-divides by 2h/day", () => {
    expect(daysNeededForTimezoneShift(0)).toBe(0);
    expect(daysNeededForTimezoneShift(2)).toBe(1);
    expect(daysNeededForTimezoneShift(7)).toBe(4);
  });
});

describe("flipTimezoneDirection", () => {
  it("flips east and west", () => {
    expect(flipTimezoneDirection("east")).toBe("west");
    expect(flipTimezoneDirection("west")).toBe("east");
    expect(flipTimezoneDirection("none")).toBe("none");
  });
});

describe("homebound lifecycle helpers", () => {
  const end = new Date("2026-07-10T12:00:00");

  it("counts days past end inclusive of return day", () => {
    expect(daysPastTravelEnd(new Date("2026-07-09T12:00:00"), end)).toBe(-1);
    expect(daysPastTravelEnd(new Date("2026-07-10T12:00:00"), end)).toBe(0);
    expect(daysPastTravelEnd(new Date("2026-07-11T12:00:00"), end)).toBe(1);
  });

  it("keeps homebound through shift window for 7h", () => {
    expect(isTravelInsulinHomebound(new Date("2026-07-10T12:00:00"), end, 7)).toBe(true);
    expect(isTravelInsulinHomebound(new Date("2026-07-14T12:00:00"), end, 7)).toBe(true);
    expect(isTravelInsulinHomebound(new Date("2026-07-15T12:00:00"), end, 7)).toBe(false);
    expect(isTravelInsulinHomebound(new Date("2026-07-09T12:00:00"), end, 7)).toBe(false);
  });

  it("auto-ends after shift window; same-day-after-end when no TZ", () => {
    expect(shouldAutoEndTravelMode(new Date("2026-07-14T12:00:00"), end, 7)).toBe(false);
    expect(shouldAutoEndTravelMode(new Date("2026-07-15T12:00:00"), end, 7)).toBe(true);
    expect(shouldAutoEndTravelMode(new Date("2026-07-10T12:00:00"), end, 0)).toBe(false);
    expect(shouldAutoEndTravelMode(new Date("2026-07-11T12:00:00"), end, 0)).toBe(true);
  });
});

describe("timezoneChangeFromHours", () => {
  it("treats 7 hours as a major shift", () => {
    expect(timezoneChangeFromHours(0)).toBe("none");
    expect(timezoneChangeFromHours(2)).toBe("minor");
    expect(timezoneChangeFromHours(7)).toBe("major");
  });
});

import { describe, expect, it } from "vitest";

import {
  buildBasalAdjustmentSchedule,
  pickBasalRowForDay,
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

describe("timezoneChangeFromHours", () => {
  it("treats 7 hours as a major shift", () => {
    expect(timezoneChangeFromHours(0)).toBe("none");
    expect(timezoneChangeFromHours(2)).toBe("minor");
    expect(timezoneChangeFromHours(7)).toBe("major");
  });
});

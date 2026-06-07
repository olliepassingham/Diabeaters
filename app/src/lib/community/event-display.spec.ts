import { describe, expect, it } from "vitest";

import {
  defaultEventStartsAtLocal,
  eventTimingLabel,
  formatEventWhen,
  getEventTiming,
  buildGoogleCalendarUrl,
} from "./event-display";

describe("event-display", () => {
  it("defaultEventStartsAtLocal returns tomorrow at 10:00", () => {
    const value = defaultEventStartsAtLocal(new Date("2026-06-07T15:30:00"));
    expect(value).toBe("2026-06-08T10:00");
  });

  it("getEventTiming labels today and past", () => {
    const now = new Date("2026-06-07T12:00:00");
    expect(getEventTiming("2026-06-06T10:00:00", now)).toBe("past");
    expect(getEventTiming("2026-06-07T18:00:00", now)).toBe("today");
    expect(eventTimingLabel("today", "2026-06-07T18:00:00", now)).toContain("Today");
  });

  it("formatEventWhen renders a readable date, not raw ISO", () => {
    const label = formatEventWhen("2026-05-23T15:49:00.000Z");
    expect(label).not.toContain("T");
    expect(label).toMatch(/May/);
  });

  it("buildGoogleCalendarUrl includes title and location", () => {
    const url = buildGoogleCalendarUrl({
      title: "Meetup",
      starts_at: "2026-06-10T10:00:00.000Z",
      location: "London",
    });
    expect(url).toContain("text=Meetup");
    expect(url).toContain("location=London");
  });
});

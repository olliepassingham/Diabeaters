import { describe, expect, it } from "vitest";
import { resolveSickDayLiveBgNudge } from "./sick-day-live-bg";

describe("resolveSickDayLiveBgNudge", () => {
  it("suggests connecting when there is no live source", () => {
    const nudge = resolveSickDayLiveBgNudge({
      liveValue: null,
      liveUnits: "mmol/L",
      hasLiveSource: false,
      loggedBg: null,
      loggedUnits: "mmol/L",
    });
    expect(nudge?.cta).toBe("connect");
    expect(nudge?.tone).toBe("info");
  });

  it("flags critically high live glucose for an update", () => {
    const nudge = resolveSickDayLiveBgNudge({
      liveValue: 23,
      liveUnits: "mmol/L",
      hasLiveSource: true,
      loggedBg: 10,
      loggedUnits: "mmol/L",
    });
    expect(nudge?.tone).toBe("urgent");
    expect(nudge?.cta).toBe("update");
    expect(nudge?.detail.toLowerCase()).toContain("does not change any dose");
  });

  it("asks for ketones when high and rising", () => {
    const nudge = resolveSickDayLiveBgNudge({
      liveValue: 15,
      liveUnits: "mmol/L",
      trend: "rising",
      hasLiveSource: true,
      loggedBg: 14,
      loggedUnits: "mmol/L",
    });
    expect(nudge?.tone).toBe("watch");
    expect(nudge?.cta).toBe("ketones");
  });

  it("suggests updating when live has drifted from the last log", () => {
    const nudge = resolveSickDayLiveBgNudge({
      liveValue: 9,
      liveUnits: "mmol/L",
      hasLiveSource: true,
      loggedBg: 6,
      loggedUnits: "mmol/L",
    });
    expect(nudge?.cta).toBe("update");
    expect(nudge?.title.toLowerCase()).toMatch(/moved|live/);
  });

  it("stays calm when live is in a quieter range", () => {
    const nudge = resolveSickDayLiveBgNudge({
      liveValue: 7.2,
      liveUnits: "mmol/L",
      trend: "flat",
      hasLiveSource: true,
      loggedBg: 7,
      loggedUnits: "mmol/L",
    });
    expect(nudge?.tone).toBe("ok");
    expect(nudge?.cta).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { mergeCloudNightSummaries, type BedtimeNightSummaryRecord } from "./bedtime-night-summaries";
import { toBedtimeStreakDayKey } from "./bedtime-overnight-window";
import type { BedtimeLog } from "./storage";

function log(partial: Partial<BedtimeLog> & Pick<BedtimeLog, "id" | "date">): BedtimeLog {
  return {
    currentBg: 6,
    bgUnits: "mmol/L",
    readinessLevel: "steady",
    hoursSinceFood: null,
    hoursSinceInsulin: null,
    exercisedToday: false,
    hadAlcohol: false,
    sickDayActive: false,
    travelModeActive: false,
    correctionGiven: null,
    notes: "",
    ...partial,
  };
}

const windowStart = "2026-09-27T21:30:00.000Z";
const streakDay = toBedtimeStreakDayKey(windowStart, 0)!;

const cloudNight: BedtimeNightSummaryRecord = {
  streakDay,
  inRangePercent: 91,
  hadLow: false,
  hadHigh: false,
  readingCount: 32,
  windowStart,
  windowEnd: "2026-09-28T05:30:00.000Z",
  headline: "In range overnight",
  computedAt: "2026-09-28T07:00:00.000Z",
};

describe("mergeCloudNightSummaries", () => {
  it("adds a night that only exists on the account", () => {
    const merged = mergeCloudNightSummaries([], [cloudNight]);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.id).toBe(`cloud-night-${streakDay}`);
    expect(merged[0]?.overnightCgmSummary?.inRangePercent).toBe(91);
    expect(merged[0]?.hoursUntilSleep).toBe(0);
  });

  it("fills a local check that has no percent yet", () => {
    const local = log({
      id: "local-1",
      date: windowStart,
      hoursUntilSleep: 0,
    });
    const merged = mergeCloudNightSummaries([local], [cloudNight]);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.id).toBe("local-1");
    expect(merged[0]?.overnightCgmSummary?.inRangePercent).toBe(91);
  });

  it("keeps a percent already stored on this phone", () => {
    const local = log({
      id: "local-1",
      date: windowStart,
      hoursUntilSleep: 0,
      overnightCgmSummary: {
        inRangePercent: 80,
        readingCount: 20,
        hadLow: true,
        hadHigh: false,
        computedAt: "2026-09-28T07:00:00.000Z",
      },
    });
    const merged = mergeCloudNightSummaries([local], [cloudNight]);
    expect(merged[0]?.overnightCgmSummary?.inRangePercent).toBe(80);
  });
});

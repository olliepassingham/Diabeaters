import { describe, expect, it } from "vitest";

import type { BedtimeLog } from "./storage";
import {
  isLearnableBedtimeNight,
  judgeBedtimeNight,
  resolveBedtimePersonalAdjustment,
  type BedtimeLearningTonight,
} from "./bedtime-personal-adjustment";

const NOW = new Date("2026-11-09T08:00:00.000Z").getTime();
const DAY = 24 * 60 * 60 * 1000;
const targets = { lowMmol: 4, highMmol: 10, bgUnits: "mmol/L" as const };
const tonight: BedtimeLearningTonight = {
  hadAlcohol: false,
  exerciseOvernightCaution: false,
  bgTrend: "steady",
  recentHypos: false,
  sickDayActive: false,
};

let seq = 0;
function night(
  daysAgo: number,
  verdict: "high" | "low" | "ok",
  overrides: Partial<BedtimeLog> = {},
  outcomeOverrides: Partial<NonNullable<BedtimeLog["outcome"]>> = {},
): BedtimeLog {
  seq += 1;
  return {
    id: `n${seq}`,
    date: new Date(NOW - daysAgo * DAY).toISOString(),
    currentBg: 13,
    bgUnits: "mmol/L",
    readinessLevel: "alert",
    hoursSinceFood: 3,
    hoursSinceInsulin: 4,
    bgTrend: "steady",
    exercisedToday: false,
    hadAlcohol: false,
    sickDayActive: false,
    travelModeActive: false,
    correctionGiven: 2,
    correctionBaseDose: 2,
    personalAdjustment: null,
    notes: "",
    actionSuggested: "correction",
    outcome: {
      reportedAt: new Date(NOW - daysAgo * DAY + 10 * 60 * 60 * 1000).toISOString(),
      overnightFeel: verdict === "high" ? "went_high" : verdict === "low" ? "went_low" : "steady",
      followedAction: "yes",
      ...outcomeOverrides,
    },
    ...overrides,
  };
}

const resolve = (logs: BedtimeLog[], t: Partial<BedtimeLearningTonight> = {}) =>
  resolveBedtimePersonalAdjustment(logs, { ...tonight, ...t }, targets, NOW);

describe("judgeBedtimeNight", () => {
  it("uses CGM first: any low wins, then where the night ended", () => {
    const base = night(1, "ok");
    expect(
      judgeBedtimeNight(
        { ...base, overnightCgmSummary: { inRangePercent: 60, readingCount: 80, hadLow: true, hadHigh: true, endValue: 12, computedAt: "" } },
        targets,
      ),
    ).toBe("low");
    expect(
      judgeBedtimeNight(
        { ...base, overnightCgmSummary: { inRangePercent: 60, readingCount: 80, hadLow: false, hadHigh: true, endValue: 11.2, computedAt: "" } },
        targets,
      ),
    ).toBe("high");
    expect(
      judgeBedtimeNight(
        { ...base, overnightCgmSummary: { inRangePercent: 80, readingCount: 80, hadLow: false, hadHigh: true, endValue: 8, computedAt: "" } },
        targets,
      ),
    ).toBe("ok");
  });

  it("falls back to how it felt and the morning reading, converting mg/dL", () => {
    expect(judgeBedtimeNight(night(1, "ok", {}, { morningBg: 3.6 }), targets)).toBe("low");
    expect(
      judgeBedtimeNight(night(1, "ok", { bgUnits: "mg/dL" }, { morningBg: 200, morningBgUnits: "mg/dL" }), targets),
    ).toBe("high");
    expect(judgeBedtimeNight(night(1, "high"), targets)).toBe("high");
  });
});

describe("isLearnableBedtimeNight", () => {
  it("needs a suggested correction that was taken", () => {
    expect(isLearnableBedtimeNight(night(1, "high"))).toBe(true);
    expect(isLearnableBedtimeNight(night(1, "high", {}, { followedAction: "no" }))).toBe(false);
    expect(isLearnableBedtimeNight(night(1, "high", {}, { followedAction: "partially" }))).toBe(false);
    expect(isLearnableBedtimeNight(night(1, "high", {}, { followedAction: "partially", unitsTaken: 1 }))).toBe(true);
    expect(isLearnableBedtimeNight(night(1, "high", { actionSuggested: "snack" }))).toBe(false);
    expect(isLearnableBedtimeNight(night(1, "high", { outcome: undefined }))).toBe(false);
  });
});

describe("resolveBedtimePersonalAdjustment", () => {
  it("makes no change with fewer than 2 similar nights", () => {
    const result = resolve([night(1, "high")]);
    expect(result.multiplier).toBe(1);
    expect(result.direction).toBe("none");
    expect(result.nights).toBe(1);
  });

  it("nudges up 10% per high night and explains why", () => {
    const result = resolve([night(1, "high"), night(2, "high"), night(3, "ok")]);
    expect(result.multiplier).toBeCloseTo(1.2);
    expect(result.direction).toBe("up");
    expect(result.reason).toMatch(/Adjusted up 20%/);
    expect(result.reason).toMatch(/2 similar nights/);
    expect(result.reason).toMatch(/above 10 mmol\/L/);
  });

  it("never goes above 1.3, and only looks at the last 5 similar nights", () => {
    const logs = [1, 2, 3, 4, 5, 6, 7].map((d) => night(d, "high"));
    const result = resolve(logs);
    expect(result.multiplier).toBe(1.3);
    expect(result.nights).toBe(5);
  });

  it("blocks any upward nudge when one of the last 3 similar nights was low", () => {
    const result = resolve([night(1, "high"), night(2, "low"), night(3, "high"), night(4, "high"), night(5, "high")]);
    expect(result.multiplier).toBe(1);
    expect(result.upwardBlockedReason).toMatch(/went low/);
    expect(result.reason).toMatch(/Not adjusted up/);
  });

  it("blocks upward nudges for a recent hypo or a falling glucose tonight", () => {
    const logs = [night(1, "high", { bgTrend: "falling" }), night(2, "high", { bgTrend: "falling" })];
    expect(resolve(logs, { recentHypos: true }).multiplier).toBe(1);
    expect(resolve(logs, { bgTrend: "falling" }).multiplier).toBe(1);
  });

  it("is off on sick days", () => {
    expect(resolve([night(1, "low"), night(2, "low")], { sickDayActive: true }).multiplier).toBe(1);
  });

  it("weights lows more than highs", () => {
    const result = resolve([night(4, "high"), night(5, "low")]);
    expect(result.multiplier).toBeCloseTo(0.95);
    expect(result.direction).toBe("down");
  });

  it("never goes below 0.7", () => {
    const result = resolve([1, 2, 3, 4, 5].map((d) => night(d, "low")));
    expect(result.multiplier).toBe(0.7);
    expect(result.reason).toMatch(/Adjusted down 30%/);
  });

  it("only compares nights with the same alcohol, exercise and rising/not-rising context", () => {
    const logs = [
      night(1, "high", { hadAlcohol: true }),
      night(2, "high", { exerciseOvernightCaution: true }),
      night(3, "high", { bgTrend: "rising" }),
      night(4, "high"),
    ];
    expect(resolve(logs).nights).toBe(1);
    expect(resolve(logs, { hadAlcohol: true }).nights).toBe(1);
    expect(resolve(logs, { bgTrend: "rising" }).nights).toBe(1);
    expect(resolve([night(1, "high", { bgTrend: undefined }), night(2, "high", { bgTrend: "falling" })]).nights).toBe(2);
  });

  it("ignores nights older than 30 days", () => {
    expect(resolve([night(31, "high"), night(40, "high")]).nights).toBe(0);
  });

  it("does not count a high night as under-dosing when much less than the suggestion was taken", () => {
    const result = resolve([
      night(1, "high", {}, { followedAction: "partially", unitsTaken: 0.5 }),
      night(2, "high", {}, { followedAction: "partially", unitsTaken: 1 }),
    ]);
    expect(result.multiplier).toBe(1);
  });

  it("scores against the base suggestion, so earlier adjustments don't compound", () => {
    const withoutStored = resolve([night(1, "high"), night(2, "high")]);
    const withStored = resolve([
      night(1, "high", { personalAdjustment: 1.2, correctionGiven: 2.4, correctionBaseDose: 2 }),
      night(2, "high", { personalAdjustment: 1.1, correctionGiven: 2.2, correctionBaseDose: 2 }),
    ]);
    expect(withStored.multiplier).toBe(withoutStored.multiplier);
    expect(withStored.multiplier).toBeCloseTo(1.2);
  });
});

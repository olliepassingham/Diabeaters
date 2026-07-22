import { beforeEach, describe, expect, it } from "vitest";
import {
  appendCgmReadings,
  clearCgmLocalHistory,
  countCgmLocalHistoryDays,
  getCgmLocalHistory,
  CGM_HISTORY_RETENTION_DAYS,
} from "./cgm-history-store";

const NOW = new Date("2026-07-22T12:00:00.000Z").getTime();
const DAY_MS = 24 * 60 * 60 * 1000;

function isoMinutesAgo(minutes: number, now: number = NOW): string {
  return new Date(now - minutes * 60_000).toISOString();
}

describe("cgm-history-store", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("stores and retrieves readings", () => {
    appendCgmReadings(
      [
        { recordedAt: isoMinutesAgo(30), valueMgDl: 120 },
        { recordedAt: isoMinutesAgo(10), valueMgDl: 140 },
      ],
      NOW,
    );
    const history = getCgmLocalHistory(CGM_HISTORY_RETENTION_DAYS, NOW);
    expect(history).toHaveLength(2);
    expect(history[0]!.valueMgDl).toBe(120);
    expect(history[1]!.valueMgDl).toBe(140);
  });

  it("ignores entries with invalid or non-positive values", () => {
    appendCgmReadings(
      [
        { recordedAt: isoMinutesAgo(10), valueMgDl: 0 },
        { recordedAt: isoMinutesAgo(10), valueMgDl: -5 },
        { recordedAt: "not-a-date", valueMgDl: 100 },
        { recordedAt: isoMinutesAgo(10), valueMgDl: NaN },
      ],
      NOW,
    );
    expect(getCgmLocalHistory(CGM_HISTORY_RETENTION_DAYS, NOW)).toHaveLength(0);
  });

  it("dedupes readings that land within the same ~minute, keeping the newest write", () => {
    appendCgmReadings([{ recordedAt: isoMinutesAgo(10), valueMgDl: 100 }], NOW);
    // A near-duplicate fetch a few seconds later for basically the same sample.
    appendCgmReadings(
      [{ recordedAt: new Date(NOW - 10 * 60_000 + 20_000).toISOString(), valueMgDl: 102 }],
      NOW,
    );
    const history = getCgmLocalHistory(CGM_HISTORY_RETENTION_DAYS, NOW);
    expect(history).toHaveLength(1);
    expect(history[0]!.valueMgDl).toBe(102);
  });

  it("merges multiple append calls without losing distinct readings", () => {
    appendCgmReadings([{ recordedAt: isoMinutesAgo(60), valueMgDl: 110 }], NOW);
    appendCgmReadings([{ recordedAt: isoMinutesAgo(30), valueMgDl: 130 }], NOW);
    appendCgmReadings([{ recordedAt: isoMinutesAgo(5), valueMgDl: 150 }], NOW);
    expect(getCgmLocalHistory(CGM_HISTORY_RETENTION_DAYS, NOW)).toHaveLength(3);
  });

  it("prunes readings older than the retention window", () => {
    const tooOld = NOW - (CGM_HISTORY_RETENTION_DAYS + 1) * DAY_MS;
    const withinWindow = NOW - 2 * DAY_MS;
    appendCgmReadings(
      [
        { recordedAt: new Date(tooOld).toISOString(), valueMgDl: 90 },
        { recordedAt: new Date(withinWindow).toISOString(), valueMgDl: 100 },
      ],
      NOW,
    );
    const history = getCgmLocalHistory(CGM_HISTORY_RETENTION_DAYS, NOW);
    expect(history).toHaveLength(1);
    expect(history[0]!.valueMgDl).toBe(100);
  });

  it("ignores readings implausibly far in the future", () => {
    appendCgmReadings([{ recordedAt: new Date(NOW + DAY_MS).toISOString(), valueMgDl: 100 }], NOW);
    expect(getCgmLocalHistory(CGM_HISTORY_RETENTION_DAYS, NOW)).toHaveLength(0);
  });

  it("caps total stored points even if appended far more than the safety bound", () => {
    const many = Array.from({ length: 5_000 }, (_, i) => ({
      recordedAt: new Date(NOW - i * 60_000).toISOString(),
      valueMgDl: 100 + (i % 20),
    }));
    appendCgmReadings(many, NOW);
    const history = getCgmLocalHistory(CGM_HISTORY_RETENTION_DAYS, NOW);
    expect(history.length).toBeLessThanOrEqual(4_500);
  });

  it("getCgmLocalHistory respects a narrower sinceDays window", () => {
    appendCgmReadings(
      [
        { recordedAt: new Date(NOW - 10 * DAY_MS).toISOString(), valueMgDl: 100 },
        { recordedAt: new Date(NOW - 2 * DAY_MS).toISOString(), valueMgDl: 110 },
      ],
      NOW,
    );
    expect(getCgmLocalHistory(CGM_HISTORY_RETENTION_DAYS, NOW)).toHaveLength(2);
    expect(getCgmLocalHistory(7, NOW)).toHaveLength(1);
  });

  it("counts distinct calendar days with data", () => {
    appendCgmReadings(
      [
        { recordedAt: new Date(NOW - 0.5 * DAY_MS).toISOString(), valueMgDl: 100 },
        { recordedAt: new Date(NOW - 1.5 * DAY_MS).toISOString(), valueMgDl: 110 },
        { recordedAt: new Date(NOW - 1.7 * DAY_MS).toISOString(), valueMgDl: 115 },
        { recordedAt: new Date(NOW - 2.5 * DAY_MS).toISOString(), valueMgDl: 120 },
      ],
      NOW,
    );
    expect(countCgmLocalHistoryDays(CGM_HISTORY_RETENTION_DAYS, NOW)).toBe(3);
  });

  it("clearCgmLocalHistory wipes stored readings", () => {
    appendCgmReadings([{ recordedAt: isoMinutesAgo(10), valueMgDl: 100 }], NOW);
    expect(getCgmLocalHistory(CGM_HISTORY_RETENTION_DAYS, NOW)).toHaveLength(1);
    clearCgmLocalHistory();
    expect(getCgmLocalHistory(CGM_HISTORY_RETENTION_DAYS, NOW)).toHaveLength(0);
  });

  it("does nothing gracefully when appended an empty array", () => {
    expect(() => appendCgmReadings([], NOW)).not.toThrow();
    expect(getCgmLocalHistory(CGM_HISTORY_RETENTION_DAYS, NOW)).toHaveLength(0);
  });
});

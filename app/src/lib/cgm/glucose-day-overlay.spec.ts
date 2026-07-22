import { describe, expect, it } from "vitest";
import { buildGlucoseDayOverlay, glucoseDayOverlayDayCount } from "./glucose-day-overlay";
import type { CgmHistoryPoint } from "@/lib/cgm/cgm-history-store";

// Wednesday, fixed local time, so day-offset labels ("Today"/"Yesterday") are deterministic.
const NOW = new Date(2026, 6, 22, 18, 0, 0, 0);

function atLocal(daysAgo: number, hour: number, minute = 0): number {
  const d = new Date(NOW);
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, minute, 0, 0);
  return d.getTime();
}

function point(recordedAtMs: number, valueMgDl: number): CgmHistoryPoint {
  return { recordedAtMs, valueMgDl };
}

describe("buildGlucoseDayOverlay", () => {
  it("groups points into one series per local calendar day, oldest first", () => {
    const points = [
      point(atLocal(1, 8), 100),
      point(atLocal(0, 8), 110),
      point(atLocal(2, 8), 90),
    ];
    const series = buildGlucoseDayOverlay(points, "mg/dL", { now: NOW });
    expect(series).toHaveLength(3);
    expect(series.map((s) => s.dateKey)).toEqual([...series.map((s) => s.dateKey)].sort());
    expect(series[series.length - 1]!.label).toBe("Today");
    expect(series[series.length - 1]!.isMostRecent).toBe(true);
    expect(series[0]!.isMostRecent).toBe(false);
  });

  it("labels today and yesterday distinctly from older days", () => {
    const points = [point(atLocal(0, 8), 100), point(atLocal(1, 8), 100), point(atLocal(3, 8), 100)];
    const series = buildGlucoseDayOverlay(points, "mg/dL", { now: NOW });
    const byOffset = [...series].sort((a, b) => (a.dateKey < b.dateKey ? -1 : 1));
    expect(byOffset[2]!.label).toBe("Today");
    expect(byOffset[1]!.label).toBe("Yesterday");
    expect(byOffset[0]!.label).not.toBe("Today");
    expect(byOffset[0]!.label).not.toBe("Yesterday");
  });

  it("omits days with no readings", () => {
    const points = [point(atLocal(0, 8), 100)];
    const series = buildGlucoseDayOverlay(points, "mg/dL", { now: NOW, days: 7 });
    expect(series).toHaveLength(1);
  });

  it("filters out points older than the requested day window", () => {
    const points = [point(atLocal(0, 8), 100), point(atLocal(10, 8), 100)];
    const series = buildGlucoseDayOverlay(points, "mg/dL", { now: NOW, days: 7 });
    expect(series).toHaveLength(1);
  });

  it("filters out points in the future relative to now", () => {
    const points = [point(NOW.getTime() + 60 * 60_000, 100)];
    const series = buildGlucoseDayOverlay(points, "mg/dL", { now: NOW });
    expect(series).toHaveLength(0);
  });

  it("positions points on a shared 0-1440 minute-of-day axis", () => {
    const points = [point(atLocal(0, 6, 30), 100)];
    const series = buildGlucoseDayOverlay(points, "mg/dL", { now: NOW });
    expect(series[0]!.segments[0]![0]!.minuteOfDay).toBe(6 * 60 + 30);
  });

  it("breaks a day into separate segments across gaps larger than the threshold", () => {
    const points = [
      point(atLocal(0, 6, 0), 100),
      point(atLocal(0, 6, 5), 102),
      // 3 hour gap — well past the 20-minute default threshold.
      point(atLocal(0, 9, 0), 150),
      point(atLocal(0, 9, 5), 148),
    ];
    const series = buildGlucoseDayOverlay(points, "mg/dL", { now: NOW });
    expect(series[0]!.segments).toHaveLength(2);
    expect(series[0]!.segments[0]).toHaveLength(2);
    expect(series[0]!.segments[1]).toHaveLength(2);
  });

  it("does not break a segment for gaps within the threshold", () => {
    const points = [
      point(atLocal(0, 6, 0), 100),
      point(atLocal(0, 6, 15), 105),
      point(atLocal(0, 6, 30), 110),
    ];
    const series = buildGlucoseDayOverlay(points, "mg/dL", { now: NOW, gapMinutes: 20 });
    expect(series[0]!.segments).toHaveLength(1);
    expect(series[0]!.segments[0]).toHaveLength(3);
  });

  it("respects a custom gapMinutes threshold", () => {
    const points = [point(atLocal(0, 6, 0), 100), point(atLocal(0, 6, 25), 105)];
    const brokenWithDefault = buildGlucoseDayOverlay(points, "mg/dL", { now: NOW, gapMinutes: 20 });
    expect(brokenWithDefault[0]!.segments).toHaveLength(2);
    const joinedWithWider = buildGlucoseDayOverlay(points, "mg/dL", { now: NOW, gapMinutes: 30 });
    expect(joinedWithWider[0]!.segments).toHaveLength(1);
  });

  it("converts mg/dL history into the requested display units", () => {
    const points = [point(atLocal(0, 8), 180)];
    const series = buildGlucoseDayOverlay(points, "mmol/L", { now: NOW });
    expect(series[0]!.segments[0]![0]!.value).toBeCloseTo(10, 1);
  });

  it("keeps mg/dL values unchanged when that is the requested unit", () => {
    const points = [point(atLocal(0, 8), 145)];
    const series = buildGlucoseDayOverlay(points, "mg/dL", { now: NOW });
    expect(series[0]!.segments[0]![0]!.value).toBe(145);
  });
});

describe("glucoseDayOverlayDayCount", () => {
  it("counts the distinct days returned", () => {
    const points = [point(atLocal(0, 8), 100), point(atLocal(1, 8), 100)];
    const series = buildGlucoseDayOverlay(points, "mg/dL", { now: NOW });
    expect(glucoseDayOverlayDayCount(series)).toBe(2);
  });
});

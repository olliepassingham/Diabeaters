import { describe, expect, it } from "vitest";
import type { CgmHistoryPoint } from "@/lib/cgm/cgm-history-store";
import {
  buildFortnightRangePicture,
  fortnightSampleMinimum,
  isFortnightDenseEnough,
} from "@/lib/cgm/fortnight-range";

function pointsAcrossDays(days: number, perDay: number, valueMgDl: number, now = new Date()): CgmHistoryPoint[] {
  const out: CgmHistoryPoint[] = [];
  for (let day = 0; day < days; day++) {
    const noon = new Date(now);
    noon.setHours(12, 0, 0, 0);
    noon.setDate(noon.getDate() - day);
    const start = noon.getTime();
    const step = Math.floor((10 * 60 * 60 * 1000) / perDay);
    for (let i = 0; i < perDay; i++) {
      out.push({ recordedAtMs: start + i * step, valueMgDl });
    }
  }
  return out;
}

describe("isFortnightDenseEnough", () => {
  it("rejects a handful of readings", () => {
    expect(isFortnightDenseEnough(pointsAcrossDays(14, 4, 110))).toBe(false);
  });

  it("rejects a full sample count piled into too few days", () => {
    const packed = pointsAcrossDays(3, fortnightSampleMinimum(), 110);
    expect(packed.length).toBeGreaterThanOrEqual(fortnightSampleMinimum());
    expect(isFortnightDenseEnough(packed)).toBe(false);
  });

  it("accepts 10 days that cover at least 70% of a 5-minute sensor", () => {
    const dense = pointsAcrossDays(10, 288, 110);
    expect(dense.length).toBeGreaterThanOrEqual(fortnightSampleMinimum());
    expect(isFortnightDenseEnough(dense)).toBe(true);
  });
});

describe("buildFortnightRangePicture", () => {
  it("returns null when history is thin", () => {
    expect(buildFortnightRangePicture(pointsAcrossDays(2, 10, 110), "mmol/L", 4, 10)).toBeNull();
  });

  it("groups lows, in-range, and highs, and keeps very low inside below", () => {
    const days = 10;
    const perDay = 288;
    const values = [50, 65, 110, 200, 300];
    const points: CgmHistoryPoint[] = [];
    for (let day = 0; day < days; day++) {
      const noon = new Date();
      noon.setHours(12, 0, 0, 0);
      noon.setDate(noon.getDate() - day);
      for (let i = 0; i < perDay; i++) {
        points.push({
          recordedAtMs: noon.getTime() + i * 60_000,
          valueMgDl: values[i % values.length]!,
        });
      }
    }
    const picture = buildFortnightRangePicture(points, "mmol/L", 4, 10);
    expect(picture).not.toBeNull();
    expect(picture!.belowPercent + picture!.inRangePercent + picture!.abovePercent).toBe(100);
    expect(picture!.veryLowPercent).toBeGreaterThan(0);
    expect(picture!.veryLowPercent).toBeLessThanOrEqual(picture!.belowPercent);
    expect(picture!.inRangePercent).toBeGreaterThan(0);
    expect(picture!.abovePercent).toBeGreaterThan(0);
  });
});

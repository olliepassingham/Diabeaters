import { describe, expect, it } from "vitest";
import {
  buildGlucoseRangePathSegments,
  computeGlucoseRangeStatus,
  glucoseRangeChartStroke,
  percentGlucoseInRange,
} from "./live-glucose-range";

describe("computeGlucoseRangeStatus", () => {
  it("classifies against patient target range", () => {
    expect(computeGlucoseRangeStatus(3.5, 4, 10)).toBe("low");
    expect(computeGlucoseRangeStatus(9, 4, 10)).toBe("in_range");
    expect(computeGlucoseRangeStatus(13.9, 4, 10)).toBe("high");
  });

  it("computes percent in range for a window", () => {
    expect(percentGlucoseInRange([5, 6, 11, 7], 4, 10)).toBe(75);
    expect(percentGlucoseInRange([], 4, 10)).toBeNull();
  });
});

describe("glucoseRangeChartStroke", () => {
  it("uses red for low, orange for high, green for in range", () => {
    expect(glucoseRangeChartStroke("low")).toBe("#ef4444");
    expect(glucoseRangeChartStroke("high")).toBe("#f97316");
    expect(glucoseRangeChartStroke("in_range")).toBe("#10b981");
  });
});

describe("buildGlucoseRangePathSegments", () => {
  it("returns empty for fewer than two points", () => {
    expect(buildGlucoseRangePathSegments([{ x: 0, y: 0, value: 5 }], 4, 10)).toEqual([]);
  });

  it("keeps a single in-range segment when values stay in band", () => {
    const segs = buildGlucoseRangePathSegments(
      [
        { x: 0, y: 10, value: 5 },
        { x: 10, y: 10, value: 6 },
        { x: 20, y: 10, value: 7 },
      ],
      4,
      10,
    );
    expect(segs).toHaveLength(1);
    expect(segs[0]?.status).toBe("in_range");
    expect(segs[0]?.d).toContain("M");
  });

  it("splits when a segment crosses from in-range into high", () => {
    const segs = buildGlucoseRangePathSegments(
      [
        { x: 0, y: 50, value: 8 },
        { x: 100, y: 10, value: 12 },
      ],
      4,
      10,
    );
    const statuses = segs.map((s) => s.status).sort();
    expect(statuses).toEqual(["high", "in_range"]);
  });

  it("splits when a segment crosses into low", () => {
    const segs = buildGlucoseRangePathSegments(
      [
        { x: 0, y: 20, value: 5 },
        { x: 100, y: 80, value: 3 },
      ],
      4,
      10,
    );
    const statuses = segs.map((s) => s.status).sort();
    expect(statuses).toEqual(["in_range", "low"]);
  });
});

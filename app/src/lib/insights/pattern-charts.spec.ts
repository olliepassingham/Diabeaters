import { describe, expect, it } from "vitest";
import {
  computeHourlyHypoComparison,
  computeWeekdayHypoComparison,
  computeWeeklyTrend,
} from "@/lib/insights/pattern-charts";

/** Fixed "now" for determinism: local Tuesday 14 July 2026, 21:00. */
const NOW = new Date(2026, 6, 14, 21, 0, 0);

function hypoAt(daysAgo: number, hour = 12, minute = 0): Date {
  const d = new Date(NOW.getTime() - daysAgo * 24 * 60 * 60 * 1000);
  d.setHours(hour, minute, 0, 0);
  return d;
}

describe("computeHourlyHypoComparison", () => {
  it("buckets into 8 three-hour windows with correct labels", () => {
    const buckets = computeHourlyHypoComparison([], NOW);
    expect(buckets).toHaveLength(8);
    expect(buckets[0]!.label).toBe("12am–3am");
    expect(buckets[7]!.label).toBe("9pm–12am");
  });

  it("counts current vs previous period separately", () => {
    const hypos = [
      hypoAt(1, 15), // current period, 3pm bucket
      hypoAt(2, 16), // current period, 3pm bucket
      hypoAt(35, 15), // previous period, 3pm bucket
    ];
    const buckets = computeHourlyHypoComparison(hypos, NOW, 30);
    const bucket = buckets.find((b) => b.key === 15)!;
    expect(bucket.currentCount).toBe(2);
    expect(bucket.previousCount).toBe(1);
  });

  it("ignores hypos older than two full periods", () => {
    const hypos = [hypoAt(65, 15)];
    const buckets = computeHourlyHypoComparison(hypos, NOW, 30);
    expect(buckets.reduce((sum, b) => sum + b.currentCount + b.previousCount, 0)).toBe(0);
  });
});

describe("computeWeekdayHypoComparison", () => {
  it("returns 7 buckets labelled Sun..Sat", () => {
    const buckets = computeWeekdayHypoComparison([], NOW);
    expect(buckets.map((b) => b.label)).toEqual(["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]);
  });

  it("counts current vs previous period by weekday", () => {
    // NOW is a Tuesday; daysAgo multiples of 7 land on Tuesdays.
    // 49 days ago is within the previous 42-day window (42–84 days ago).
    const hypos = [hypoAt(0, 9), hypoAt(7, 10), hypoAt(49, 8)];
    const buckets = computeWeekdayHypoComparison(hypos, NOW, 42);
    const tuesday = buckets.find((b) => b.label === "Tue")!;
    expect(tuesday.currentCount).toBe(2);
    expect(tuesday.previousCount).toBe(1);
  });
});

describe("computeWeeklyTrend", () => {
  it("returns `weeks` points, oldest first, ending on the current week", () => {
    const points = computeWeeklyTrend([], [], NOW, 12);
    expect(points).toHaveLength(12);
    expect(points[11]!.weekStartMs).toBeLessThanOrEqual(NOW.getTime());
    expect(points[11]!.weekStartMs).toBeGreaterThan(points[10]!.weekStartMs);
  });

  it("tallies hypo and exercise counts into the correct week", () => {
    const hypos = [hypoAt(0), hypoAt(1)];
    const exercises = [hypoAt(0)];
    const points = computeWeeklyTrend(hypos, exercises, NOW, 4);
    const currentWeek = points[points.length - 1]!;
    expect(currentWeek.hypoCount).toBe(2);
    expect(currentWeek.exerciseCount).toBe(1);
  });

  it("drops events older than the requested window", () => {
    const hypos = [hypoAt(200)];
    const points = computeWeeklyTrend(hypos, [], NOW, 4);
    expect(points.reduce((sum, p) => sum + p.hypoCount, 0)).toBe(0);
  });
});

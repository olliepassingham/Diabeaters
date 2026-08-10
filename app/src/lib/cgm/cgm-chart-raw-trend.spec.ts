import { describe, expect, it } from "vitest";
import { liveCgmHistoryToChartPoints } from "@/lib/cgm/cgm-chart";

describe("liveCgmHistoryToChartPoints raw trend preservation", () => {
  it("keeps fine trend tokens on rawTrend while collapsing trend for UI", () => {
    const points = liveCgmHistoryToChartPoints(
      [
        { valueMgDl: 120, recordedAt: "2026-08-10T12:00:00.000Z", trend: "doubleup" },
        { valueMgDl: 130, recordedAt: "2026-08-10T12:05:00.000Z", trend: "singledown" },
      ],
      "mg/dL",
      "3h",
    );
    expect(points).toHaveLength(2);
    expect(points[0]!.trend).toBe("rising");
    expect(points[0]!.rawTrend).toBe("doubleup");
    expect(points[0]!.valueMgDl).toBe(120);
    expect(points[1]!.trend).toBe("falling");
    expect(points[1]!.rawTrend).toBe("singledown");
    expect(points[1]!.valueMgDl).toBe(130);
  });
});

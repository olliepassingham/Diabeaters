import { describe, expect, it } from "vitest";
import { formatHypoMonthSummaryLine, getHypoMonthSummary } from "@/lib/hypo-month-summary";
import type { HypoTreatment } from "@/lib/storage";

function hypo(iso: string): HypoTreatment {
  return { id: iso, timestamp: iso, carerNotified: false };
}

describe("getHypoMonthSummary", () => {
  it("counts this month vs last month", () => {
    const now = new Date("2026-07-14T12:00:00.000Z");
    const treatments = [
      hypo("2026-07-02T10:00:00.000Z"),
      hypo("2026-07-10T10:00:00.000Z"),
      hypo("2026-06-05T10:00:00.000Z"),
      hypo("2026-06-20T10:00:00.000Z"),
      hypo("2026-06-22T10:00:00.000Z"),
    ];
    const summary = getHypoMonthSummary(treatments, now);
    expect(summary.thisMonthCount).toBe(2);
    expect(summary.lastMonthCount).toBe(3);
    expect(summary.reduction).toBe(1);
    expect(formatHypoMonthSummaryLine(summary)).toContain("fewer");
  });
});

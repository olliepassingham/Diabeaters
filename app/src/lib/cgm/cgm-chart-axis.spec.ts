import { describe, expect, it } from "vitest";
import { buildCgmHistoryAxisTicks, formatCgmHistoryAxisLabel } from "@/lib/cgm/cgm-chart";

describe("CGM history x-axis ticks", () => {
  it("uses clock labels without dates", () => {
    const noon = new Date(2026, 7, 13, 12, 0).getTime();
    const midnight = new Date(2026, 7, 13, 0, 0).getTime();
    const evening = new Date(2026, 7, 12, 22, 0).getTime();
    expect(formatCgmHistoryAxisLabel(midnight)).toBe("12am");
    expect(formatCgmHistoryAxisLabel(noon)).toBe("12pm");
    expect(formatCgmHistoryAxisLabel(evening)).toBe("10pm");
  });

  it("places 2-hour ticks across a 12h overnight window", () => {
    const start = new Date(2026, 7, 12, 22, 58).getTime();
    const end = new Date(2026, 7, 13, 10, 58).getTime();
    const labels = buildCgmHistoryAxisTicks(start, end).map(formatCgmHistoryAxisLabel);
    expect(labels[0]).toBe("12am");
    expect(labels).toContain("6am");
    expect(labels.at(-1)).toBe("10am");
    expect(labels.every((l) => !/\d+\s+\w{3}/.test(l))).toBe(true);
  });

  it("places hourly ticks on a 3h window", () => {
    const start = new Date(2026, 7, 13, 8, 10).getTime();
    const end = new Date(2026, 7, 13, 11, 10).getTime();
    const labels = buildCgmHistoryAxisTicks(start, end).map(formatCgmHistoryAxisLabel);
    expect(labels).toEqual(["9am", "10am", "11am"]);
  });
});

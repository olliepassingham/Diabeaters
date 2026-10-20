import { describe, expect, it } from "vitest";
import { computeInsulinPatternInsights } from "@/lib/insights/insulin-pattern-insights";
import type { LongActingDose, RapidInsulinDose } from "@/lib/insulin-activity";

const NOW = new Date("2026-10-20T12:00:00");

function rapid(daysAgo: number, hour: number, units = 5): RapidInsulinDose {
  const d = new Date(NOW);
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, 0, 0, 0);
  return { id: `r-${daysAgo}-${hour}`, takenAtIso: d.toISOString(), units };
}

function longActing(daysAgo: number, hour: number, minute = 0): LongActingDose {
  const d = new Date(NOW);
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, minute, 0, 0);
  return { id: `l-${daysAgo}-${hour}-${minute}`, takenAtIso: d.toISOString(), units: 12 };
}

function hypo(daysAgo: number, hour: number): { timestamp: string } {
  const d = new Date(NOW);
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, 0, 0, 0);
  return { timestamp: d.toISOString() };
}

describe("computeInsulinPatternInsights", () => {
  it("stays quiet until enough doses are logged", () => {
    const insights = computeInsulinPatternInsights({
      rapidDoses: [rapid(1, 8), rapid(2, 8)],
      longActingDoses: [longActing(1, 22)],
      hypos: [hypo(1, 10), hypo(2, 10), hypo(3, 10)],
      now: NOW,
    });
    expect(insights).toEqual([]);
  });

  it("flags lows landing within 4 hours of a rapid dose", () => {
    const rapidDoses = [rapid(1, 8), rapid(2, 8), rapid(3, 8), rapid(4, 8), rapid(5, 8)];
    const insights = computeInsulinPatternInsights({
      rapidDoses,
      longActingDoses: [],
      hypos: [hypo(1, 10), hypo(2, 11), hypo(3, 9), hypo(4, 20)],
      now: NOW,
    });
    const found = insights.find((i) => i.kind === "insulin_lows_after_dose");
    expect(found?.body).toContain("3 of your 4 hypos");
    expect(found?.tone).toBe("attention");
  });

  it("ignores lows that fall outside the action window", () => {
    const insights = computeInsulinPatternInsights({
      rapidDoses: [rapid(1, 8), rapid(2, 8), rapid(3, 8), rapid(4, 8), rapid(5, 8)],
      longActingDoses: [],
      hypos: [hypo(1, 14), hypo(2, 15), hypo(3, 16)],
      now: NOW,
    });
    expect(insights.find((i) => i.kind === "insulin_lows_after_dose")).toBeUndefined();
  });

  it("counts rapid doses stacked inside the action window", () => {
    const insights = computeInsulinPatternInsights({
      rapidDoses: [
        rapid(1, 8), rapid(1, 10),
        rapid(2, 8), rapid(2, 9),
        rapid(3, 8), rapid(3, 11),
        rapid(4, 8),
      ],
      longActingDoses: [],
      hypos: [],
      now: NOW,
    });
    const found = insights.find((i) => i.kind === "insulin_stacking");
    expect(found?.body).toContain("On 3 occasions");
  });

  it("reports days with no long-acting dose logged", () => {
    const longActingDoses = [0, 1, 2, 5, 6, 7, 8].map((d) => longActing(d, 22));
    const insights = computeInsulinPatternInsights({
      rapidDoses: [],
      longActingDoses,
      hypos: [],
      now: NOW,
    });
    const found = insights.find((i) => i.kind === "long_acting_pattern");
    expect(found?.title).toContain("no long-acting dose logged");
  });

  it("reports a wide spread of long-acting times", () => {
    const longActingDoses = [
      longActing(1, 19, 30),
      longActing(2, 22, 45),
      longActing(3, 20, 0),
      longActing(4, 23, 15),
      longActing(5, 21, 0),
      longActing(6, 22, 0),
    ];
    const insights = computeInsulinPatternInsights({
      rapidDoses: [],
      longActingDoses,
      hypos: [],
      now: NOW,
    });
    const found = insights.find((i) => i.kind === "long_acting_pattern");
    expect(found?.title).toContain("move around");
  });

  it("keeps a steady long-acting routine quiet", () => {
    const longActingDoses = [0, 1, 2, 3, 4, 5, 6].map((d) => longActing(d, 22, 5));
    const insights = computeInsulinPatternInsights({
      rapidDoses: [],
      longActingDoses,
      hypos: [],
      now: NOW,
    });
    expect(insights).toEqual([]);
  });
});

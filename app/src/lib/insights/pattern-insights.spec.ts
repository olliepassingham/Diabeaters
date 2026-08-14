import { describe, expect, it } from "vitest";
import {
  computePatternInsights,
  findBestThreeHourWindow,
  formatHourLabel,
  type PatternInsight,
} from "@/lib/insights/pattern-insights";

/** Fixed "now" for determinism: local Tuesday 14 July 2026, 21:00 (late enough that same-day hypos are in the past). */
const NOW = new Date(2026, 6, 14, 21, 0, 0);

/** A hypo `daysAgo` days before NOW, at the given local hour. */
function hypoAt(daysAgo: number, hour = 12, minute = 0): { timestamp: string } {
  const d = new Date(NOW.getTime() - daysAgo * 24 * 60 * 60 * 1000);
  d.setHours(hour, minute, 0, 0);
  return { timestamp: d.toISOString() };
}

/** A hypo exactly `hoursAgo` hours before NOW. */
function hypoHoursAgo(hoursAgo: number): { timestamp: string } {
  return { timestamp: new Date(NOW.getTime() - hoursAgo * 60 * 60 * 1000).toISOString() };
}

/** An exercise outcome exactly `hoursAgo` hours before NOW. */
function exerciseHoursAgo(hoursAgo: number): { completedAt: string } {
  return { completedAt: new Date(NOW.getTime() - hoursAgo * 60 * 60 * 1000).toISOString() };
}

function compute(
  hypos: { timestamp: string }[],
  exerciseOutcomes: { completedAt: string }[] = [],
  now: Date = NOW,
): PatternInsight[] {
  return computePatternInsights({ hypos, exerciseOutcomes, now });
}

function ofKind(insights: PatternInsight[], kind: PatternInsight["kind"]): PatternInsight | undefined {
  return insights.find((i) => i.kind === kind);
}

describe("formatHourLabel", () => {
  it("formats midnight, noon, am and pm hours", () => {
    expect(formatHourLabel(0)).toBe("12am");
    expect(formatHourLabel(12)).toBe("12pm");
    expect(formatHourLabel(3)).toBe("3am");
    expect(formatHourLabel(15)).toBe("3pm");
    expect(formatHourLabel(23)).toBe("11pm");
    expect(formatHourLabel(24)).toBe("12am");
  });
});

describe("findBestThreeHourWindow", () => {
  it("picks the window containing the most hypos", () => {
    const { startHour, count } = findBestThreeHourWindow([15, 16, 17, 9]);
    expect(startHour).toBe(15);
    expect(count).toBe(3);
  });

  it("wraps across midnight", () => {
    const { startHour, count } = findBestThreeHourWindow([23, 0, 1]);
    expect(startHour).toBe(23);
    expect(count).toBe(3);
  });

  it("breaks ties on the earliest start hour", () => {
    const { startHour } = findBestThreeHourWindow([4, 20]);
    // Several windows contain exactly one hypo; the earliest winning start is 2 (covers 2,3,4).
    expect(startHour).toBe(2);
  });
});

describe("hypo_time_cluster", () => {
  it("emits when 4+ hypos cluster in one 3-hour window", () => {
    const hypos = [hypoAt(1, 15), hypoAt(3, 16), hypoAt(5, 17), hypoAt(8, 15), hypoAt(10, 9), hypoAt(12, 6)];
    const insight = ofKind(compute(hypos), "hypo_time_cluster");
    expect(insight).toBeDefined();
    expect(insight!.tone).toBe("neutral");
    expect(insight!.title).toBe("A pattern in your low times");
    expect(insight!.body).toBe("4 of your 6 hypos in the last 30 days were between 3pm and 6pm.");
    expect(insight!.metric).toBe("3pm–6pm");
    expect(insight!.actionLabel).toBe("See when lows happen");
    expect(insight!.actionHref).toBe("/tools/patterns#when-lows");
    expect(insight!.id).toBe("hypo-time-cluster:2026-07");
  });

  it("does not emit with only 3 hypos even if all clustered", () => {
    const hypos = [hypoAt(1, 15), hypoAt(3, 16), hypoAt(5, 17)];
    expect(ofKind(compute(hypos), "hypo_time_cluster")).toBeUndefined();
  });

  it("does not emit when the best window holds under 50% of hypos", () => {
    // Best window has 3 of 8 (37.5%).
    const hypos = [
      hypoAt(1, 15),
      hypoAt(2, 15),
      hypoAt(3, 15),
      hypoAt(4, 2),
      hypoAt(5, 6),
      hypoAt(6, 9),
      hypoAt(7, 20),
      hypoAt(8, 23),
    ];
    expect(ofKind(compute(hypos), "hypo_time_cluster")).toBeUndefined();
  });

  it("emits at exactly 50% in the best window", () => {
    const hypos = [hypoAt(1, 15), hypoAt(2, 16), hypoAt(3, 2), hypoAt(4, 8)];
    const insight = ofKind(compute(hypos), "hypo_time_cluster");
    expect(insight).toBeDefined();
    expect(insight!.body).toContain("2 of your 4 hypos");
  });

  it("ignores hypos older than 30 days", () => {
    const hypos = [hypoAt(31, 15), hypoAt(35, 15), hypoAt(1, 15), hypoAt(2, 16), hypoAt(3, 17)];
    // Only 3 hypos within 30 days — below the minimum.
    expect(ofKind(compute(hypos), "hypo_time_cluster")).toBeUndefined();
  });

  it("picks a window that wraps past midnight", () => {
    const hypos = [hypoAt(1, 23), hypoAt(3, 0), hypoAt(5, 1), hypoAt(8, 23)];
    const insight = ofKind(compute(hypos), "hypo_time_cluster");
    expect(insight).toBeDefined();
    expect(insight!.body).toContain("between 11pm and 2am");
  });
});

describe("hypo_weekday_cluster", () => {
  it("emits when 4+ hypos in 6 weeks share a weekday", () => {
    // NOW is a Tuesday; daysAgo multiples of 7 land on Tuesdays.
    const hypos = [hypoAt(0, 9), hypoAt(7, 10), hypoAt(14, 11), hypoAt(21, 8), hypoAt(2, 9), hypoAt(3, 14)];
    const insight = ofKind(compute(hypos), "hypo_weekday_cluster");
    expect(insight).toBeDefined();
    expect(insight!.tone).toBe("neutral");
    expect(insight!.body).toBe("4 of your 6 hypos in the last 6 weeks happened on a Tuesday.");
    expect(insight!.id).toBe("hypo-weekday-cluster:2026-07");
  });

  it("does not emit with only 3 hypos on the same weekday", () => {
    const hypos = [hypoAt(0, 9), hypoAt(7, 10), hypoAt(14, 11)];
    expect(ofKind(compute(hypos), "hypo_weekday_cluster")).toBeUndefined();
  });

  it("does not emit when no weekday reaches 50%", () => {
    // 6 hypos spread over 6 different weekdays.
    const hypos = [hypoAt(0), hypoAt(1), hypoAt(2), hypoAt(3), hypoAt(4), hypoAt(5)];
    expect(ofKind(compute(hypos), "hypo_weekday_cluster")).toBeUndefined();
  });

  it("ignores hypos older than 42 days", () => {
    const hypos = [hypoAt(0, 9), hypoAt(7, 10), hypoAt(14, 11), hypoAt(49, 8)];
    expect(ofKind(compute(hypos), "hypo_weekday_cluster")).toBeUndefined();
  });
});

describe("post_exercise_lows", () => {
  it("emits when 2+ hypos fall 2-24h after exercise in the last 4 weeks", () => {
    const exercises = [exerciseHoursAgo(30), exerciseHoursAgo(100)];
    const hypos = [hypoHoursAgo(20), hypoHoursAgo(90)]; // 10h and 10h after each session
    const insight = ofKind(compute(hypos, exercises), "post_exercise_lows");
    expect(insight).toBeDefined();
    expect(insight!.tone).toBe("attention");
    expect(insight!.title).toBe("Lows after exercise");
    expect(insight!.body).toBe(
      "You've had a low within 24 hours of exercising 2 times in the last 4 weeks.",
    );
    expect(insight!.takeaway).toMatch(/bedtime check/i);
    expect(insight!.metric).toBe("2×");
    expect(insight!.actionLabel).toBe("Open bedtime guide");
    expect(insight!.actionHref).toBe("/scenarios/bedtime");
    expect(insight!.id).toBe("post-exercise-lows:2026-07");
  });

  it("does not emit for a single post-exercise low", () => {
    const insight = ofKind(compute([hypoHoursAgo(20)], [exerciseHoursAgo(30)]), "post_exercise_lows");
    expect(insight).toBeUndefined();
  });

  it("ignores hypos less than 2 hours or more than 24 hours after exercise", () => {
    const exercises = [exerciseHoursAgo(30), exerciseHoursAgo(100)];
    const hypos = [hypoHoursAgo(29), hypoHoursAgo(70)]; // 1h after and 30h after
    expect(ofKind(compute(hypos, exercises), "post_exercise_lows")).toBeUndefined();
  });

  it("counts each hypo once even when multiple sessions match", () => {
    const exercises = [exerciseHoursAgo(26), exerciseHoursAgo(30)];
    const hypos = [hypoHoursAgo(20), hypoHoursAgo(21)];
    const insight = ofKind(compute(hypos, exercises), "post_exercise_lows");
    expect(insight!.body).toContain("2 times");
  });

  it("ignores hypos outside the last 28 days", () => {
    const exercises = [exerciseHoursAgo(29 * 24 + 10), exerciseHoursAgo(30 * 24 + 10)];
    const hypos = [hypoHoursAgo(29 * 24), hypoHoursAgo(30 * 24)];
    expect(ofKind(compute(hypos, exercises), "post_exercise_lows")).toBeUndefined();
  });
});

describe("hypo_free_stretch", () => {
  it("emits when the current gap is 10+ days and the longest on record", () => {
    const hypos = [hypoAt(11, 12), hypoAt(16, 12), hypoAt(20, 12)];
    const insight = ofKind(compute(hypos), "hypo_free_stretch");
    expect(insight).toBeDefined();
    expect(insight!.tone).toBe("positive");
    expect(insight!.title).toBe("Longest stretch yet");
    expect(insight!.body).toBe("No lows logged in 11 days — your longest stretch in your recent history.");
    // Id is keyed to the day of the most recent hypo so it stays dismissed all stretch.
    expect(insight!.id).toBe("hypo-free-stretch:2026-07-03");
  });

  it("does not emit below 10 full days since the last hypo", () => {
    const hypos = [hypoAt(9, 12), hypoAt(30, 12)];
    expect(ofKind(compute(hypos), "hypo_free_stretch")).toBeUndefined();
  });

  it("emits at exactly 10 full days when it is the longest gap", () => {
    const hypos = [hypoAt(10, 11, 59), hypoAt(15, 12)];
    const insight = ofKind(compute(hypos), "hypo_free_stretch");
    expect(insight).toBeDefined();
    expect(insight!.body).toContain("10 days");
  });

  it("does not emit when a longer historical gap exists", () => {
    // Current gap 12 days, but a 20-day gap exists between older hypos.
    const hypos = [hypoAt(12, 12), hypoAt(32, 12), hypoAt(33, 12)];
    expect(ofKind(compute(hypos), "hypo_free_stretch")).toBeUndefined();
  });

  it("emits with a single historical hypo", () => {
    const insight = ofKind(compute([hypoAt(14, 12)]), "hypo_free_stretch");
    expect(insight).toBeDefined();
    expect(insight!.body).toContain("14 days");
  });

  it("does not emit with no hypos at all", () => {
    expect(compute([])).toHaveLength(0);
  });
});

describe("hypo_frequency_trend", () => {
  it("emits positive when current count is at or below 60% of previous", () => {
    // 3 current vs 5 previous = 60% exactly.
    const hypos = [
      hypoAt(1),
      hypoAt(5),
      hypoAt(10),
      hypoAt(31),
      hypoAt(35),
      hypoAt(40),
      hypoAt(45),
      hypoAt(50),
    ];
    const insight = ofKind(compute(hypos), "hypo_frequency_trend");
    expect(insight).toBeDefined();
    expect(insight!.tone).toBe("positive");
    expect(insight!.title).toBe("Fewer lows");
    expect(insight!.body).toBe("3 lows in the last 30 days, down from 5 the month before.");
    expect(insight!.metric).toBe("3 vs 5");
    expect(insight!.actionLabel).toBeUndefined();
    expect(insight!.id).toBe("hypo-frequency-trend:2026-07");
  });

  it("does not emit positive just above the 60% threshold", () => {
    // 4 current vs 6 previous ≈ 67%; not <= 60%, not >= 150%.
    const hypos = [
      hypoAt(1),
      hypoAt(5),
      hypoAt(10),
      hypoAt(15),
      hypoAt(31),
      hypoAt(35),
      hypoAt(40),
      hypoAt(45),
      hypoAt(50),
      hypoAt(55),
    ];
    expect(ofKind(compute(hypos), "hypo_frequency_trend")).toBeUndefined();
  });

  it("emits attention when current count is at or above 150% of previous", () => {
    // 6 current vs 4 previous = 150% exactly.
    const hypos = [
      hypoAt(1),
      hypoAt(3),
      hypoAt(5),
      hypoAt(10),
      hypoAt(15),
      hypoAt(20),
      hypoAt(31),
      hypoAt(35),
      hypoAt(40),
      hypoAt(45),
    ];
    const insight = ofKind(compute(hypos), "hypo_frequency_trend");
    expect(insight).toBeDefined();
    expect(insight!.tone).toBe("attention");
    expect(insight!.title).toBe("More lows lately");
    expect(insight!.body).toBe("6 lows in the last 30 days, up from 4 the month before.");
    expect(insight!.takeaway).toMatch(/care team/i);
    expect(insight!.metric).toBe("6 vs 4");
    expect(insight!.actionLabel).toBe("Hypo help");
    expect(insight!.actionHref).toBe("/tools/hypo-help");
  });

  it("does not emit when the larger period has fewer than 4 hypos", () => {
    // 3 previous, 1 current — 33% drop but too little data.
    const hypos = [hypoAt(1), hypoAt(31), hypoAt(35), hypoAt(40)];
    expect(ofKind(compute(hypos), "hypo_frequency_trend")).toBeUndefined();
  });
});

describe("ordering and cap", () => {
  it("orders attention before neutral", () => {
    // Neutral: time cluster + weekday cluster (Tuesdays around 3pm).
    // Attention: post-exercise lows.
    // Four previous-month hypos keep the frequency trend flat (4 vs 4) so it stays silent.
    const hypos = [
      hypoAt(0, 15),
      hypoAt(7, 15),
      hypoAt(14, 16),
      hypoAt(21, 17),
      hypoAt(31, 9),
      hypoAt(32, 9),
      hypoAt(33, 9),
      hypoAt(34, 9),
    ];
    const exercises = [
      { completedAt: new Date(new Date(hypos[0]!.timestamp).getTime() - 5 * 60 * 60 * 1000).toISOString() },
      { completedAt: new Date(new Date(hypos[1]!.timestamp).getTime() - 5 * 60 * 60 * 1000).toISOString() },
    ];
    const insights = compute(hypos, exercises);
    expect(insights).toHaveLength(3);
    expect(insights.map((i) => i.tone)).toEqual(["attention", "neutral", "neutral"]);
    expect(insights[0]!.kind).toBe("post_exercise_lows");
    // Rule order preserved within the neutral tone.
    expect(insights[1]!.kind).toBe("hypo_time_cluster");
    expect(insights[2]!.kind).toBe("hypo_weekday_cluster");
  });

  it("caps the result at 3, dropping the lowest-priority insight", () => {
    // Fires four rules: post-exercise lows + frequency trend (attention),
    // time cluster + weekday cluster (neutral). Weekday cluster is dropped.
    const hypos = [hypoAt(0, 15), hypoAt(7, 15), hypoAt(14, 16), hypoAt(21, 17)];
    const exercises = [
      { completedAt: new Date(new Date(hypos[0]!.timestamp).getTime() - 5 * 60 * 60 * 1000).toISOString() },
      { completedAt: new Date(new Date(hypos[1]!.timestamp).getTime() - 5 * 60 * 60 * 1000).toISOString() },
    ];
    const insights = compute(hypos, exercises);
    expect(insights).toHaveLength(3);
    expect(insights.map((i) => i.kind)).toEqual([
      "post_exercise_lows",
      "hypo_frequency_trend",
      "hypo_time_cluster",
    ]);
  });

  it("returns an empty array for sparse data", () => {
    expect(compute([hypoAt(1), hypoAt(2)])).toHaveLength(0);
  });
});

describe("determinism and now injection", () => {
  it("produces identical output for identical input", () => {
    const hypos = [hypoAt(1, 15), hypoAt(3, 16), hypoAt(5, 17), hypoAt(8, 15)];
    expect(compute(hypos)).toEqual(compute(hypos));
  });

  it("uses the injected now for period ids", () => {
    const hypos = [hypoAt(1, 15), hypoAt(3, 16), hypoAt(5, 17), hypoAt(8, 15)];
    const august = new Date(2026, 7, 14, 21, 0, 0);
    const shifted = hypos.map((h) => ({
      timestamp: new Date(new Date(h.timestamp).getTime() + 31 * 24 * 60 * 60 * 1000).toISOString(),
    }));
    const insight = ofKind(computePatternInsights({ hypos: shifted, exerciseOutcomes: [], now: august }), "hypo_time_cluster");
    expect(insight!.id).toBe("hypo-time-cluster:2026-08");
  });

  it("skips invalid timestamps rather than throwing", () => {
    const hypos = [{ timestamp: "not-a-date" }, hypoAt(1), hypoAt(2)];
    expect(() => compute(hypos)).not.toThrow();
  });
});

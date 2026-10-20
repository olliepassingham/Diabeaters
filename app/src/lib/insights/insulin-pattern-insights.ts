import { format, subDays } from "date-fns";
import type { PatternInsight } from "@/lib/insights/pattern-insights";
import type { LongActingDose, RapidInsulinDose } from "@/lib/insulin-activity";

/**
 * Observational patterns over doses the user added to the Home CGM graph.
 * Wording describes what the log shows and points at clinic conversations —
 * it never suggests changing a dose. Dose numbers stay on this device; only
 * counts and timings are described.
 */

export interface InsulinPatternInput {
  rapidDoses: RapidInsulinDose[];
  longActingDoses: LongActingDose[];
  hypos: { timestamp: string }[];
  now?: Date;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const WINDOW_DAYS = 30;

/** Minimum logging before any insulin insight fires. */
const MIN_RAPID_DOSES = 5;
const MIN_RAPID_DOSE_DAYS = 4;
const MIN_LONG_DOSES = 5;
const MIN_LONG_DOSE_DAYS = 5;

function validTimes(doses: { takenAtIso: string }[]): number[] {
  return doses
    .map((d) => new Date(d.takenAtIso).getTime())
    .filter((t) => Number.isFinite(t))
    .sort((a, b) => a - b);
}

function distinctDays(timesMs: number[]): number {
  return new Set(timesMs.map((t) => format(new Date(t), "yyyy-MM-dd"))).size;
}

function clockLabel(timeMs: number): string {
  return format(new Date(timeMs), "h:mmaaa");
}

function detectLowsAfterRapidDose(
  rapidTimes: number[],
  hypoTimes: number[],
  now: Date,
): PatternInsight | null {
  const from = now.getTime() - WINDOW_DAYS * DAY_MS;
  const rapid = rapidTimes.filter((t) => t >= from && t <= now.getTime());
  const hypos = hypoTimes.filter((t) => t >= from && t <= now.getTime());
  if (rapid.length < MIN_RAPID_DOSES || distinctDays(rapid) < MIN_RAPID_DOSE_DAYS) return null;
  if (hypos.length < 3) return null;

  const actionMs = 4 * HOUR_MS;
  const afterDose = hypos.filter((hypo) =>
    rapid.some((dose) => hypo > dose && hypo - dose <= actionMs),
  );
  if (afterDose.length < 3) return null;
  if (afterDose.length * 5 < hypos.length * 2) return null; // under 40% of lows

  return {
    id: `insulin-lows-after-dose:${format(now, "yyyy-MM")}`,
    kind: "insulin_lows_after_dose",
    tone: "attention",
    title: "Lows landing after rapid insulin",
    body: `${afterDose.length} of your ${hypos.length} hypos in the last ${WINDOW_DAYS} days came within 4 hours of a rapid dose, while that dose was still working.`,
    metric: `${afterDose.length} of ${hypos.length}`,
    metricHint: "lows within 4h of a dose",
    takeaway:
      "If those lows tend to follow particular meals or corrections, the timing is worth showing your team. Keep following your own plan in the meantime.",
    actionLabel: "Open Hypo history",
    actionHref: "/tools/hypo-history",
  };
}

function detectRapidStacking(rapidTimes: number[], now: Date): PatternInsight | null {
  const from = now.getTime() - WINDOW_DAYS * DAY_MS;
  const rapid = rapidTimes.filter((t) => t >= from && t <= now.getTime());
  if (rapid.length < MIN_RAPID_DOSES || distinctDays(rapid) < MIN_RAPID_DOSE_DAYS) return null;

  let stacked = 0;
  for (let i = 1; i < rapid.length; i++) {
    const gap = rapid[i]! - rapid[i - 1]!;
    if (gap > 0 && gap <= 4 * HOUR_MS) stacked += 1;
  }
  if (stacked < 3) return null;

  return {
    id: `insulin-stacking:${format(now, "yyyy-MM")}`,
    kind: "insulin_stacking",
    tone: "neutral",
    title: "Rapid doses sometimes overlap",
    body: `On ${stacked} occasions in the last ${WINDOW_DAYS} days, a rapid dose was added within 4 hours of the one before, while the earlier dose was still working.`,
    metric: `${stacked}×`,
    metricHint: "in the last 30 days",
    takeaway:
      "Overlapping rapid doses can add up. If that pattern is news to you, it is a good one to talk through with your team.",
  };
}

function detectLongActingPattern(longTimes: number[], now: Date): PatternInsight | null {
  const from = now.getTime() - WINDOW_DAYS * DAY_MS;
  const doses = longTimes.filter((t) => t >= from && t <= now.getTime());
  if (doses.length < MIN_LONG_DOSES || distinctDays(doses) < MIN_LONG_DOSE_DAYS) return null;

  const period = `long-acting:${format(now, "yyyy-MM")}`;

  // Missed days: calendar days between the first and last logged dose (not
  // counting today, which may still be ahead of the usual time) with no dose.
  const firstDay = new Date(doses[0]!);
  firstDay.setHours(0, 0, 0, 0);
  const lastDoseDay = new Date(doses[doses.length - 1]!);
  lastDoseDay.setHours(0, 0, 0, 0);
  const spanEnd = Math.min(lastDoseDay.getTime(), (() => { const d = new Date(now); d.setHours(0, 0, 0, 0); return d.getTime() - DAY_MS; })());
  if (spanEnd > firstDay.getTime()) {
    const loggedDays = new Set(doses.map((t) => format(new Date(t), "yyyy-MM-dd")));
    let missed = 0;
    for (let day = firstDay.getTime(); day <= spanEnd; day += DAY_MS) {
      if (!loggedDays.has(format(new Date(day), "yyyy-MM-dd"))) missed += 1;
    }
    if (missed >= 2) {
      return {
        id: period,
        kind: "long_acting_pattern",
        tone: "neutral",
        title: "Some days have no long-acting dose logged",
        body: `${missed} days since ${format(firstDay, "d MMM")} have no long-acting dose in the log. Those may be days the dose was added late, or days it simply was not logged here.`,
        metric: `${missed} days`,
        metricHint: "with no dose logged",
        takeaway: "A steady background pattern is easier to read when doses are logged as they happen. Worth a look with your team if the gaps surprise you.",
      };
    }
  }

  // Timing spread: the clock-time distance between earliest and latest dose.
  const minutesOfDay = doses.map((t) => {
    const d = new Date(t);
    return d.getHours() * 60 + d.getMinutes();
  });
  const earliest = Math.min(...minutesOfDay);
  const latest = Math.max(...minutesOfDay);
  if (latest - earliest >= 180) {
    const earliestDose = doses[minutesOfDay.indexOf(earliest)]!;
    const latestDose = doses[minutesOfDay.indexOf(latest)]!;
    return {
      id: period,
      kind: "long_acting_pattern",
      tone: "neutral",
      title: "Long-acting times move around",
      body: `In the last ${WINDOW_DAYS} days your long-acting dose landed between ${clockLabel(earliestDose)} and ${clockLabel(latestDose)} on different days.`,
      metric: `${clockLabel(earliestDose)}–${clockLabel(latestDose)}`,
      metricHint: "long-acting times",
      takeaway: "A regular time can make overnight patterns easier to read. If your times have drifted, note it for your next clinic chat.",
    };
  }

  return null;
}

/**
 * Insulin pattern insights for the Patterns page. At most three, attention
 * first — mirroring the hypo detectors' tone ordering (stable within tone).
 */
export function computeInsulinPatternInsights(input: InsulinPatternInput): PatternInsight[] {
  const now = input.now ?? new Date();
  const rapidTimes = validTimes(input.rapidDoses);
  const longTimes = validTimes(input.longActingDoses);
  const hypoTimes = validTimes(input.hypos.map((h) => ({ takenAtIso: h.timestamp })));

  const insights = [
    detectLowsAfterRapidDose(rapidTimes, hypoTimes, now),
    detectRapidStacking(rapidTimes, now),
    detectLongActingPattern(longTimes, now),
  ].filter((x): x is PatternInsight => x != null);

  const toneOrder: Record<PatternInsight["tone"], number> = { attention: 0, positive: 1, neutral: 2 };
  return insights.sort((a, b) => toneOrder[a.tone] - toneOrder[b.tone]);
}

import type { LiveCgmGlucoseEntry } from "@/lib/cgm/live-cgm-history";
import { convertGlucoseValue } from "@/lib/cgm/units";
import type { BgUnits } from "@/lib/cgm/types";
import type { CgmHistoryPoint } from "@/lib/cgm/cgm-history-store";
import type { BedtimeLog, BedtimeOvernightCgmSummary } from "@/lib/storage";
import { formatTargetBgInput } from "@/lib/hypo-context";
import {
  computeBedtimeSleepWindow,
  formatSleepWindowLabel,
  type BedtimeSleepWindow,
} from "@/lib/bedtime-overnight-window";

export type BedtimeOvernightReading = {
  timeMs: number;
  recordedAt: string;
  value: number;
  units: BgUnits;
};

export type BedtimeOvernightStats = {
  readingCount: number;
  min: number;
  max: number;
  minAtMs: number;
  maxAtMs: number;
  /** First reading in the window (chronological). */
  startValue: number;
  /** Last reading in the window (chronological). */
  endValue: number;
  /** End − start (positive = rose overnight). */
  overnightDelta: number;
  /** Mean of first half of the night vs second half. */
  firstHalfAvg: number;
  secondHalfAvg: number;
  inRangePercent: number;
  hadLow: boolean;
  hadHigh: boolean;
};

export type BedtimeOvernightInsight = {
  headline: string;
  summary: string;
  explanations: string[];
  /** Educational prompts for tonight or follow-up — not treatment advice. */
  considerations: string[];
  stats: BedtimeOvernightStats;
  sleepWindowLabel: string;
  targetLow: number;
  targetHigh: number;
  readings: BedtimeOvernightReading[];
};

export function filterEntriesToSleepWindow(
  entries: LiveCgmGlucoseEntry[],
  window: BedtimeSleepWindow,
): LiveCgmGlucoseEntry[] {
  return entries.filter((e) => {
    const t = new Date(e.recordedAt).getTime();
    return t >= window.startMs && t <= window.endMs;
  });
}

export function entriesToOvernightReadings(entries: LiveCgmGlucoseEntry[], units: BgUnits): BedtimeOvernightReading[] {
  return entries.map((e) => ({
    timeMs: new Date(e.recordedAt).getTime(),
    recordedAt: e.recordedAt,
    value: units === "mmol/L" ? convertGlucoseValue(e.valueMgDl, "mg/dL", "mmol/L") : Math.round(e.valueMgDl),
    units,
  }));
}

function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function computeOvernightStats(
  readings: BedtimeOvernightReading[],
  targetLow: number,
  targetHigh: number,
): BedtimeOvernightStats | null {
  if (readings.length === 0) return null;

  const sorted = [...readings].sort((a, b) => a.timeMs - b.timeMs);
  let min = sorted[0]!.value;
  let max = sorted[0]!.value;
  let minAtMs = sorted[0]!.timeMs;
  let maxAtMs = sorted[0]!.timeMs;
  let inRange = 0;

  for (const r of sorted) {
    if (r.value < min) {
      min = r.value;
      minAtMs = r.timeMs;
    }
    if (r.value > max) {
      max = r.value;
      maxAtMs = r.timeMs;
    }
    if (r.value >= targetLow && r.value <= targetHigh) inRange++;
  }

  const mid = Math.ceil(sorted.length / 2);
  const firstHalf = sorted.slice(0, mid).map((r) => r.value);
  const secondHalf = sorted.slice(mid).map((r) => r.value);
  const startValue = sorted[0]!.value;
  const endValue = sorted[sorted.length - 1]!.value;

  return {
    readingCount: sorted.length,
    min,
    max,
    minAtMs,
    maxAtMs,
    startValue,
    endValue,
    overnightDelta: endValue - startValue,
    firstHalfAvg: mean(firstHalf),
    secondHalfAvg: secondHalf.length > 0 ? mean(secondHalf) : mean(firstHalf),
    inRangePercent: Math.round((inRange / sorted.length) * 100),
    hadLow: min < targetLow,
    hadHigh: max > targetHigh,
  };
}

/** Meaningful rise overnight (mmol ≈ 1.5, mg/dL ≈ 27). */
function riseThreshold(units: BgUnits): number {
  return units === "mg/dL" ? 27 : 1.5;
}

function lateRise(stats: BedtimeOvernightStats, units: BgUnits): boolean {
  const thr = riseThreshold(units) * 0.6;
  return stats.secondHalfAvg - stats.firstHalfAvg >= thr || stats.overnightDelta >= riseThreshold(units);
}

function earlyDip(stats: BedtimeOvernightStats, window: BedtimeSleepWindow): boolean {
  const nightLength = window.endMs - window.startMs;
  if (nightLength <= 0) return false;
  // Lowest in the first 40% of the night
  return stats.minAtMs <= window.startMs + nightLength * 0.4;
}

function buildExplanations(
  log: BedtimeLog | null,
  stats: BedtimeOvernightStats,
  window: BedtimeSleepWindow,
  targetLow: number,
  targetHigh: number,
  units: BgUnits,
): string[] {
  const lines: string[] = [];
  const fmt = (n: number) => formatTargetBgInput(n, units);
  const thr = riseThreshold(units);

  if (!log) {
    if (stats.hadLow) {
      lines.push(
        `Glucose dipped to ${fmt(stats.min)} around ${formatTime(stats.minAtMs)}. A bedtime check tonight links this to food, insulin, and activity.`,
      );
    } else if (stats.hadHigh) {
      lines.push(
        `Glucose peaked at ${fmt(stats.max)} around ${formatTime(stats.maxAtMs)}. A bedtime check helps connect that rise to your evening context.`,
      );
    } else if (lateRise(stats, units)) {
      lines.push(
        `You stayed in target, but glucose rose from about ${fmt(stats.startValue)} to ${fmt(stats.endValue)} overnight — a dawn-style pattern many people see.`,
      );
    } else {
      lines.push(
        `All readings stayed between ${fmt(targetLow)} and ${fmt(targetHigh)}. A bedtime check adds evening context so future reviews can explain *why* nights like this work.`,
      );
    }
    return lines.slice(0, 4);
  }

  if (stats.hadLow) {
    if (log.exercisedToday) {
      lines.push("You logged exercise yesterday — delayed overnight lows are common for many hours after activity.");
    }
    if (log.hadAlcohol) {
      lines.push("Alcohol can delay lows; an early-morning dip is often seen when insulin was still on board.");
    }
    if (log.hoursSinceInsulin != null && log.hoursSinceInsulin <= 3) {
      lines.push("Rapid insulin within a few hours of bed may still have been working when glucose fell.");
    }
    if (log.hoursSinceFood != null && log.hoursSinceFood <= 2) {
      lines.push("A recent meal may have worn off overnight, especially if bolus timing was close to sleep.");
    }
    if (log.recentHypos) {
      lines.push("You flagged recent hypos at bedtime — overnight dips can follow a day with earlier lows.");
    }
    if (log.bgTrend === "falling") {
      lines.push("Glucose was falling at your bedtime check, which can carry into the first part of the night.");
    }
    if (earlyDip(stats, window)) {
      lines.push(
        `The lowest point was earlier in the night (${fmt(stats.min)} around ${formatTime(stats.minAtMs)}) — often linked to residual bolus or post-exercise effect rather than dawn rise.`,
      );
    }
    if (lines.length === 0) {
      lines.push(
        `Glucose dipped to ${fmt(stats.min)} around ${formatTime(stats.minAtMs)} — if this repeats, review sensor compression and your team's overnight plan.`,
      );
    }
  }

  if (stats.hadHigh) {
    if (log.bgTrend === "rising") {
      lines.push("Glucose was already rising at bedtime — that can continue with dawn effect or late digestion.");
    }
    if (log.hoursSinceFood != null && log.hoursSinceFood <= 3) {
      lines.push("Food within a few hours of sleep can still be digesting into the early hours.");
    }
    if (lateRise(stats, units) && stats.maxAtMs > (window.startMs + window.endMs) / 2) {
      lines.push(
        `The peak (${fmt(stats.max)} around ${formatTime(stats.maxAtMs)}) came later in the night — consistent with dawn phenomenon or overnight basal/food mismatch.`,
      );
    }
    if (lines.length === 0 || (stats.hadLow && lines.length < 2)) {
      lines.push(
        `Peak was ${fmt(stats.max)} around ${formatTime(stats.maxAtMs)} — compare with your usual overnight pattern and correction habits.`,
      );
    }
  }

  if (!stats.hadLow && !stats.hadHigh) {
    if (lateRise(stats, units)) {
      lines.push(
        `Fully in range, with a rise of about ${fmt(Math.abs(stats.overnightDelta))} from evening to morning (${fmt(stats.startValue)} → ${fmt(stats.endValue)}).`,
      );
      if (log.bgTrend === "rising") {
        lines.push("That matches a rising trend at your bedtime check — worth watching if mornings climb further.");
      } else if (log.exercisedToday) {
        lines.push("You exercised yesterday; some people rebound higher overnight after activity even when they stay in range.");
      }
    } else if (stats.overnightDelta <= -thr) {
      lines.push(
        `Fully in range, drifting down about ${fmt(Math.abs(stats.overnightDelta))} overnight (${fmt(stats.startValue)} → ${fmt(stats.endValue)}).`,
      );
      if (log.exercisedToday || log.hadAlcohol) {
        lines.push("Evening exercise or alcohol can contribute to a gentle overnight fall — useful to note if lows appear on similar nights.");
      }
    } else {
      lines.push(
        `All readings stayed between ${fmt(targetLow)} and ${fmt(targetHigh)} with little overnight drift — a steady night relative to your targets.`,
      );
    }
  }

  return lines.slice(0, 4);
}

function buildConsiderations(
  log: BedtimeLog | null,
  stats: BedtimeOvernightStats,
  window: BedtimeSleepWindow,
  targetLow: number,
  targetHigh: number,
  units: BgUnits,
): string[] {
  const fmt = (n: number) => formatTargetBgInput(n, units);
  const range = `${fmt(targetLow)}–${fmt(targetHigh)}`;
  const tips: string[] = [];
  const thr = riseThreshold(units);

  if (stats.hadLow) {
    tips.push(
      `Lowest was ${fmt(stats.min)} at ${formatTime(stats.minAtMs)}. If overnight dips repeat, note evening exercise, alcohol, and insulin timing before bed — and discuss repeated patterns with your care team.`,
    );
    if (earlyDip(stats, window) && log?.exercisedToday) {
      tips.push(
        "Early-night lows after exercise days are common. A slightly higher bedtime snack carb (per your plan) or checking 2–3 hours after sleep starts can help you learn your pattern — not a dose change without your team.",
      );
    } else if (log?.hadAlcohol) {
      tips.push(
        "After alcohol, an extra planned check in the early hours (and a bedtime snack if your clinic recommends one) is often more useful than changing basal on the night.",
      );
    }
  } else if (stats.hadHigh) {
    if (stats.inRangePercent >= 40 && lateRise(stats, units)) {
      tips.push(
        `You were in range for ${stats.inRangePercent}% of the night, then rose to ${fmt(stats.max)} later. If mornings often climb, ask your team about dawn phenomenon vs evening food/insulin timing — don't change basal from this screen alone.`,
      );
    } else {
      tips.push(
        `Most of the night was above ${fmt(targetHigh)} (peak ${fmt(stats.max)}). Check whether glucose was already high or rising at bedtime; correcting earlier in the evening (safely, per your plan) often helps more than waiting until morning.`,
      );
    }
    if (log?.hoursSinceFood != null && log.hoursSinceFood <= 3) {
      tips.push(
        "Evening food was close to sleep. Noting meal size and bolus timing tonight makes the next review much more specific.",
      );
    }
  } else {
    // Fully in range — still give shape-based, useful next steps
    if (lateRise(stats, units)) {
      tips.push(
        stats.endValue >= targetHigh - thr
          ? `You finished near the top of your target (${fmt(stats.endValue)}), rising from ${fmt(stats.startValue)}. If mornings often climb further, ask your team about dawn phenomenon vs evening food/insulin timing — don't change basal from this screen alone.`
          : `Glucose rose about ${fmt(Math.abs(stats.overnightDelta))} overnight while staying in range (${fmt(stats.startValue)} → ${fmt(stats.endValue)}). If that pattern often becomes a morning high, a consistent bedtime check (trend + last food) helps you and your team spot dawn effect.`,
      );
    } else if (stats.overnightDelta <= -thr && stats.endValue <= targetLow + thr) {
      tips.push(
        `You ended near the low end of target (${fmt(stats.endValue)}). On similar evenings, plan a safe bedtime snack or an early-night check if your clinic has given you that option — especially after exercise or alcohol.`,
      );
    } else {
      tips.push(
        `Solid overnight control within ${range}. To keep nights like this, note one thing that went well yesterday evening (meal timing, activity, or no late correction) so you can repeat it.`,
      );
    }
    if (!log) {
      tips.push(
        "A 30-second bedtime check adds food, insulin, exercise, and alcohol context — that's what turns this chart into personalised overnight insights next time.",
      );
    } else if (!log.exercisedToday && !log.hadAlcohol && (log.hoursSinceFood == null || log.hoursSinceFood > 3)) {
      tips.push(
        "Your bedtime notes look calm (no late meal flag, no alcohol, no exercise). If nights stay this steady, that evening routine is worth treating as your baseline.",
      );
    }
  }

  return tips.slice(0, 3);
}

export function analyzeBedtimeOvernight(
  log: BedtimeLog | null,
  readings: BedtimeOvernightReading[],
  window: BedtimeSleepWindow,
  targetLow: number,
  targetHigh: number,
  units: BgUnits = (log?.bgUnits === "mg/dL" ? "mg/dL" : "mmol/L") as BgUnits,
): BedtimeOvernightInsight | null {
  const stats = computeOvernightStats(readings, targetLow, targetHigh);
  if (!stats) return null;

  const fmt = (n: number) => formatTargetBgInput(n, units);
  let headline: string;
  let summary: string;

  const range = `${fmt(targetLow)}–${fmt(targetHigh)}`;

  if (stats.hadLow && stats.hadHigh) {
    headline = "A mixed night";
    summary = `Glucose ranged from ${fmt(stats.min)} to ${fmt(stats.max)} against your ${range} target.`;
  } else if (stats.hadLow) {
    headline = "Overnight low detected";
    summary = `Lowest ${fmt(stats.min)} around ${formatTime(stats.minAtMs)}. Target ${range}.`;
  } else if (stats.hadHigh) {
    headline = stats.inRangePercent >= 30 ? "Rose above target overnight" : "Ran high overnight";
    summary =
      stats.inRangePercent >= 30
        ? `Peak ${fmt(stats.max)} around ${formatTime(stats.maxAtMs)}. Target ${range}.`
        : `Highest ${fmt(stats.max)} around ${formatTime(stats.maxAtMs)} — mostly above your ${fmt(targetHigh)} ceiling.`;
  } else {
    // No excursions ⇒ every reading was in range (100%).
    headline = lateRise(stats, units) ? "In range, rising toward morning" : "In range overnight";
    summary = lateRise(stats, units)
      ? `Rising from ${fmt(stats.startValue)} to ${fmt(stats.endValue)} within your ${range} target.`
      : `Every reading stayed within your ${range} target.`;
  }

  return {
    headline,
    summary,
    explanations: buildExplanations(log, stats, window, targetLow, targetHigh, units),
    considerations: buildConsiderations(log, stats, window, targetLow, targetHigh, units),
    stats,
    sleepWindowLabel: formatSleepWindowLabel(window.startMs, window.endMs),
    targetLow,
    targetHigh,
    readings: [...readings].sort((a, b) => a.timeMs - b.timeMs),
  };
}

/** Minimum overnight samples before we show time-in-range on history rows. */
export const BEDTIME_TIR_MIN_READINGS = 4;

/** Home glance colour for overnight time in range: >70% green, 40–70% amber, <40% red. */
export function overnightTirTone(inRangePercent: number): "good" | "ok" | "low" {
  if (inRangePercent > 70) return "good";
  if (inRangePercent >= 40) return "ok";
  return "low";
}

export function bedtimeOvernightSummaryFromStats(
  stats: Pick<BedtimeOvernightStats, "inRangePercent" | "readingCount" | "hadLow" | "hadHigh">,
  computedAt = new Date().toISOString(),
): BedtimeOvernightCgmSummary | null {
  if (stats.readingCount < BEDTIME_TIR_MIN_READINGS) return null;
  return {
    inRangePercent: stats.inRangePercent,
    readingCount: stats.readingCount,
    hadLow: stats.hadLow,
    hadHigh: stats.hadHigh,
    computedAt,
  };
}

export function bedtimeOvernightSummaryFromInsight(
  insight: BedtimeOvernightInsight,
  computedAt = new Date().toISOString(),
): BedtimeOvernightCgmSummary | null {
  return bedtimeOvernightSummaryFromStats(insight.stats, computedAt);
}

/**
 * Compute overnight TIR for a bedtime log from on-device CGM history (no network).
 * Returns null when the sleep window is incomplete or there aren't enough readings.
 */
export function computeOvernightSummaryFromLocalHistory(
  log: Pick<BedtimeLog, "date" | "hoursUntilSleep" | "bgUnits">,
  points: CgmHistoryPoint[],
  targetLow: number,
  targetHigh: number,
  units: BgUnits,
  nowMs = Date.now(),
): BedtimeOvernightCgmSummary | null {
  const window = computeBedtimeSleepWindow(log);
  if (!window || window.endMs > nowMs) return null;

  const inWindow = points.filter((p) => p.recordedAtMs >= window.startMs && p.recordedAtMs <= window.endMs);
  if (inWindow.length < BEDTIME_TIR_MIN_READINGS) return null;

  const readings: BedtimeOvernightReading[] = inWindow.map((p) => ({
    timeMs: p.recordedAtMs,
    recordedAt: new Date(p.recordedAtMs).toISOString(),
    value: units === "mmol/L" ? convertGlucoseValue(p.valueMgDl, "mg/dL", "mmol/L") : Math.round(p.valueMgDl),
    units,
  }));

  const stats = computeOvernightStats(readings, targetLow, targetHigh);
  if (!stats) return null;
  return bedtimeOvernightSummaryFromStats(stats);
}

/** True when we should rewrite the stored summary (missing, or materially different). */
export function overnightSummariesDiffer(
  a: BedtimeOvernightCgmSummary | undefined,
  b: BedtimeOvernightCgmSummary | null,
): boolean {
  if (!b) return false;
  if (!a) return true;
  return (
    a.inRangePercent !== b.inRangePercent ||
    a.readingCount !== b.readingCount ||
    a.hadLow !== b.hadLow ||
    a.hadHigh !== b.hadHigh
  );
}

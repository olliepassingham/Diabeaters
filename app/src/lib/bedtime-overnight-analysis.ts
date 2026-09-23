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
      lines.push(`Dipped to ${fmt(stats.min)} around ${formatTime(stats.minAtMs)}.`);
    } else if (stats.hadHigh) {
      lines.push(`Peaked at ${fmt(stats.max)} around ${formatTime(stats.maxAtMs)}.`);
    } else if (lateRise(stats, units)) {
      lines.push(
        `In range, rising ${fmt(stats.startValue)} → ${fmt(stats.endValue)} overnight.`,
      );
    } else {
      lines.push(`Stayed in ${fmt(targetLow)}–${fmt(targetHigh)}.`);
    }
    return lines.slice(0, 2);
  }

  if (stats.hadLow) {
    if (log.exercisedToday) {
      lines.push("Exercise yesterday — delayed overnight lows are common for hours after.");
    }
    if (log.hadAlcohol) {
      lines.push("Alcohol can delay lows when insulin is still on board.");
    }
    if (log.hoursSinceInsulin != null && log.hoursSinceInsulin <= 3) {
      lines.push("Bolus within a few hours of bed may still have been working.");
    }
    if (log.hoursSinceFood != null && log.hoursSinceFood <= 2) {
      lines.push("A recent meal may have worn off overnight.");
    }
    if (log.recentHypos) {
      lines.push("Recent hypos at bedtime — overnight dips can follow.");
    }
    if (log.bgTrend === "falling") {
      lines.push("Falling at bedtime can carry into early night.");
    }
    if (earlyDip(stats, window)) {
      lines.push(
        `Lowest earlier in the night (${fmt(stats.min)} · ${formatTime(stats.minAtMs)}).`,
      );
    }
    if (lines.length === 0) {
      lines.push(`Dipped to ${fmt(stats.min)} around ${formatTime(stats.minAtMs)}.`);
    }
  }

  if (stats.hadHigh) {
    if (log.bgTrend === "rising") {
      lines.push("Already rising at bedtime — can continue with dawn or late digestion.");
    }
    if (log.hoursSinceFood != null && log.hoursSinceFood <= 3) {
      lines.push("Food close to sleep can still digest into the early hours.");
    }
    if (lateRise(stats, units) && stats.maxAtMs > (window.startMs + window.endMs) / 2) {
      lines.push(`Later peak ${fmt(stats.max)} around ${formatTime(stats.maxAtMs)}.`);
    }
    if (lines.length === 0 || (stats.hadLow && lines.length < 2)) {
      lines.push(`Peak ${fmt(stats.max)} around ${formatTime(stats.maxAtMs)}.`);
    }
  }

  if (!stats.hadLow && !stats.hadHigh) {
    if (lateRise(stats, units)) {
      lines.push(
        `In range, up about ${fmt(Math.abs(stats.overnightDelta))} (${fmt(stats.startValue)} → ${fmt(stats.endValue)}).`,
      );
      if (log.bgTrend === "rising") {
        lines.push("Matched a rising bedtime trend.");
      } else if (log.exercisedToday) {
        lines.push("Exercise yesterday — some people rebound higher overnight.");
      }
    } else if (stats.overnightDelta <= -thr) {
      lines.push(
        `In range, down about ${fmt(Math.abs(stats.overnightDelta))} (${fmt(stats.startValue)} → ${fmt(stats.endValue)}).`,
      );
      if (log.exercisedToday || log.hadAlcohol) {
        lines.push("Exercise or alcohol can contribute to a gentle overnight fall.");
      }
    } else {
      lines.push(`Steady in ${fmt(targetLow)}–${fmt(targetHigh)} with little overnight drift.`);
    }
  }

  return lines.slice(0, 2);
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
  const tips: string[] = [];
  const thr = riseThreshold(units);

  if (stats.hadLow) {
    if (earlyDip(stats, window) && log?.exercisedToday) {
      tips.push("Early-night low after exercise — note snack/check timing for similar evenings.");
    } else if (log?.hadAlcohol) {
      tips.push("After alcohol, an early-hours check often helps more than changing basal tonight.");
    } else {
      tips.push(
        `Lowest ${fmt(stats.min)} at ${formatTime(stats.minAtMs)}. If this repeats, note evening exercise, alcohol, and insulin timing.`,
      );
    }
  } else if (stats.hadHigh) {
    if (stats.inRangePercent >= 40 && lateRise(stats, units)) {
      tips.push(
        `In range ${stats.inRangePercent}% of the night, then rose to ${fmt(stats.max)}. Ask your team about dawn vs evening food/insulin — don’t change basal here.`,
      );
    } else {
      tips.push(
        `Mostly above target (peak ${fmt(stats.max)}). Check if glucose was already rising at bedtime.`,
      );
    }
  } else if (lateRise(stats, units)) {
    tips.push(
      `Rose about ${fmt(Math.abs(stats.overnightDelta))} overnight while in range. Note bedtime trend if mornings often climb.`,
    );
  } else if (stats.overnightDelta <= -thr && stats.endValue <= targetLow + thr) {
    tips.push(
      `Ended near the low end (${fmt(stats.endValue)}). On similar evenings, follow your clinic’s snack/check plan if you have one.`,
    );
  } else if (!log) {
    tips.push("A quick bedtime check adds evening context so nights like this get a personal tip next time.");
  } else {
    tips.push("Steady overnight in your target. Note one evening habit worth repeating.");
  }

  return tips.slice(0, 1);
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

export type OvernightTirCompare = {
  currentPercent: number;
  priorPercent: number;
  deltaPts: number;
  direction: "up" | "down" | "flat";
};

/** Compare two overnight TIR % values. Flat when within ±1 pt. */
export function compareOvernightTir(currentPercent: number, priorPercent: number): OvernightTirCompare {
  const current = Math.round(currentPercent);
  const prior = Math.round(priorPercent);
  const deltaPts = current - prior;
  const direction: OvernightTirCompare["direction"] =
    Math.abs(deltaPts) <= 1 ? "flat" : deltaPts > 0 ? "up" : "down";
  return { currentPercent: current, priorPercent: prior, deltaPts, direction };
}

export function formatOvernightTirDelta(c: OvernightTirCompare): { label: string; tone: "up" | "down" | "flat" } {
  if (c.direction === "flat") {
    return { label: "Similar to last night", tone: "flat" };
  }
  if (c.direction === "up") {
    return { label: `↑ ${c.deltaPts} pts vs last night`, tone: "up" };
  }
  return { label: `↓ ${Math.abs(c.deltaPts)} pts vs last night`, tone: "down" };
}

/**
 * Prior night’s stored TIR for the log before `currentLogId` (by check date, newest first).
 * Only uses summaries with enough readings.
 */
export function findPriorOvernightTirPercent(logs: BedtimeLog[], currentLogId: string): number | null {
  const sorted = [...logs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const idx = sorted.findIndex((l) => l.id === currentLogId);
  if (idx < 0) return null;
  for (let i = idx + 1; i < sorted.length; i++) {
    const s = sorted[i]?.overnightCgmSummary;
    if (
      s &&
      typeof s.inRangePercent === "number" &&
      Number.isFinite(s.inRangePercent) &&
      s.readingCount >= BEDTIME_TIR_MIN_READINGS
    ) {
      return s.inRangePercent;
    }
  }
  return null;
}

export function resolveOvernightTirCompare(
  logs: BedtimeLog[],
  currentLogId: string,
  currentPercent: number | null | undefined,
): OvernightTirCompare | null {
  if (currentPercent == null || !Number.isFinite(currentPercent)) return null;
  const prior = findPriorOvernightTirPercent(logs, currentLogId);
  if (prior == null) return null;
  return compareOvernightTir(currentPercent, prior);
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

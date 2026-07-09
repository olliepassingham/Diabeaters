import type { LiveCgmGlucoseEntry } from "@/lib/cgm/live-cgm-history";
import { convertGlucoseValue } from "@/lib/cgm/units";
import type { BgUnits } from "@/lib/cgm/types";
import type { BedtimeLog } from "@/lib/storage";
import { formatTargetBgInput } from "@/lib/hypo-context";
import { formatSleepWindowLabel, type BedtimeSleepWindow } from "@/lib/bedtime-overnight-window";

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

export function computeOvernightStats(
  readings: BedtimeOvernightReading[],
  targetLow: number,
  targetHigh: number,
): BedtimeOvernightStats | null {
  if (readings.length === 0) return null;

  let min = readings[0]!.value;
  let max = readings[0]!.value;
  let minAtMs = readings[0]!.timeMs;
  let maxAtMs = readings[0]!.timeMs;
  let inRange = 0;

  for (const r of readings) {
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

  return {
    readingCount: readings.length,
    min,
    max,
    minAtMs,
    maxAtMs,
    inRangePercent: Math.round((inRange / readings.length) * 100),
    hadLow: min < targetLow,
    hadHigh: max > targetHigh,
  };
}

function buildExplanations(
  log: BedtimeLog | null,
  stats: BedtimeOvernightStats,
  targetLow: number,
  targetHigh: number,
  units: BgUnits,
): string[] {
  if (!log) {
    const lines: string[] = [];
    if (stats.hadLow) {
      lines.push(
        `Glucose dipped to ${formatTargetBgInput(stats.min, units)} around ${formatTime(stats.minAtMs)}. Log a bedtime check tonight so we can tie this to food, insulin, and activity.`,
      );
    } else if (stats.hadHigh) {
      lines.push(
        `Glucose peaked at ${formatTargetBgInput(stats.max, units)} around ${formatTime(stats.maxAtMs)}. A bedtime check helps connect overnight patterns to your evening context.`,
      );
    } else {
      lines.push("Glucose stayed mostly in range overnight. Log a bedtime check to build personalised overnight insights.");
    }
    return lines;
  }
  const lines: string[] = [];
  const fmt = (n: number) => formatTargetBgInput(n, units);

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
    if (lines.length === 0) {
      lines.push(
        `Glucose dipped to ${fmt(stats.min)} around ${formatTime(stats.minAtMs)} — review sensor compression and your team's overnight plan if this pattern repeats.`,
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
    if (lines.length === 0 || !stats.hadLow) {
      lines.push(
        `Peak was ${fmt(stats.max)} around ${formatTime(stats.maxAtMs)} — compare with your usual overnight pattern and correction habits.`,
      );
    }
  }

  if (!stats.hadLow && !stats.hadHigh) {
    lines.push(
      `Most readings stayed between ${fmt(targetLow)} and ${fmt(targetHigh)} — your bedtime factors may have lined up well for this night.`,
    );
  }

  return lines.slice(0, 4);
}

function buildConsiderations(
  log: BedtimeLog | null,
  stats: BedtimeOvernightStats,
  targetLow: number,
  targetHigh: number,
  units: BgUnits,
): string[] {
  const fmt = (n: number) => formatTargetBgInput(n, units);
  const range = `${fmt(targetLow)}–${fmt(targetHigh)}`;
  const tips: string[] = [];

  if (stats.hadHigh && stats.inRangePercent >= 30) {
    tips.push(
      `About ${stats.inRangePercent}% of readings were in your target (${range}) — glucose may have crossed your ceiling later in the night (dawn rise or late digestion are common).`,
    );
  } else if (stats.hadHigh) {
    tips.push(
      `Most readings were above ${fmt(targetHigh)}. If this repeats, note whether glucose was already rising at bedtime and how evening food lined up with sleep.`,
    );
  }

  if (stats.hadLow) {
    tips.push(
      "Repeated overnight lows are worth flagging with your diabetes team — sensor compression and delayed exercise lows are common causes to review.",
    );
  }

  if (!stats.hadLow && !stats.hadHigh) {
    tips.push("If this pattern feels typical for you, keep noting what you did the evening before — it helps spot what works.");
  }

  if (!log) {
    tips.push("Tonight's bedtime quick check links overnight patterns to food, insulin, and activity for richer reviews.");
  } else if (log.hadAlcohol && stats.hadLow) {
    tips.push("You logged alcohol at bedtime — consider how that lined up with insulin on board if lows were unexpected.");
  }

  return tips.slice(0, 2);
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

  if (stats.hadLow && stats.hadHigh) {
    headline = "A mixed night";
    summary = `${stats.inRangePercent}% in your target (${fmt(targetLow)}–${fmt(targetHigh)}). Glucose ranged from ${fmt(stats.min)} to ${fmt(stats.max)}.`;
  } else if (stats.hadLow) {
    headline = "Overnight low detected";
    summary = `${stats.inRangePercent}% in your target (${fmt(targetLow)}–${fmt(targetHigh)}). Lowest ${fmt(stats.min)} around ${formatTime(stats.minAtMs)}.`;
  } else if (stats.hadHigh) {
    headline = stats.inRangePercent >= 30 ? "Rose above target overnight" : "Ran high overnight";
    summary =
      stats.inRangePercent >= 30
        ? `${stats.inRangePercent}% in your target (${fmt(targetLow)}–${fmt(targetHigh)}). Peak ${fmt(stats.max)} around ${formatTime(stats.maxAtMs)}.`
        : `Highest ${fmt(stats.max)} around ${formatTime(stats.maxAtMs)} — mostly above your ${fmt(targetHigh)} ceiling.`;
  } else {
    headline = "Mostly in range overnight";
    summary = `${stats.inRangePercent}% of readings were in your target range (${fmt(targetLow)}–${fmt(targetHigh)}).`;
  }

  return {
    headline,
    summary,
    explanations: buildExplanations(log, stats, targetLow, targetHigh, units),
    considerations: buildConsiderations(log, stats, targetLow, targetHigh, units),
    stats,
    sleepWindowLabel: formatSleepWindowLabel(window.startMs, window.endMs),
    targetLow,
    targetHigh,
    readings,
  };
}

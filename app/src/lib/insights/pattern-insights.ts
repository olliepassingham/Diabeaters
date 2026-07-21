import { format, subDays } from "date-fns";

export type PatternInsightTone = "neutral" | "positive" | "attention";

export interface PatternInsight {
  /**
   * Stable id including a period component so re-detection after dismissal in a
   * NEW period shows again, e.g. "hypo-time-cluster:2026-07".
   */
  id: string;
  kind:
    | "hypo_time_cluster"
    | "hypo_weekday_cluster"
    | "post_exercise_lows"
    | "hypo_free_stretch"
    | "hypo_frequency_trend";
  tone: PatternInsightTone;
  title: string;
  body: string;
  actionLabel?: string;
  actionHref?: string;
}

export interface PatternInsightsInput {
  hypos: { timestamp: string; glucoseLevel?: number }[];
  exerciseOutcomes: { completedAt: string }[];
  now?: Date;
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

const TONE_ORDER: Record<PatternInsightTone, number> = {
  attention: 0,
  positive: 1,
  neutral: 2,
};

/** Format an hour-of-day (0–23) as e.g. "12am", "3pm", "6pm". */
export function formatHourLabel(hour: number): string {
  const h = ((hour % 24) + 24) % 24;
  if (h === 0) return "12am";
  if (h === 12) return "12pm";
  return h < 12 ? `${h}am` : `${h - 12}pm`;
}

function parseValidDates(timestamps: string[]): Date[] {
  return timestamps
    .map((t) => new Date(t))
    .filter((d) => !Number.isNaN(d.getTime()));
}

function withinWindow(date: Date, from: Date, to: Date): boolean {
  const ms = date.getTime();
  return ms >= from.getTime() && ms <= to.getTime();
}

/**
 * Best 3-hour window (start hour 0–23, wrapping past midnight) containing the
 * most hypos. Ties resolve to the earliest start hour for determinism.
 */
export function findBestThreeHourWindow(hourOfDayList: number[]): { startHour: number; count: number } {
  const perHour = new Array<number>(24).fill(0);
  for (const h of hourOfDayList) {
    perHour[((h % 24) + 24) % 24]! += 1;
  }
  let bestStart = 0;
  let bestCount = -1;
  for (let start = 0; start < 24; start++) {
    const count = perHour[start]! + perHour[(start + 1) % 24]! + perHour[(start + 2) % 24]!;
    if (count > bestCount) {
      bestCount = count;
      bestStart = start;
    }
  }
  return { startHour: bestStart, count: bestCount };
}

function detectHypoTimeCluster(hypoDates: Date[], now: Date): PatternInsight | null {
  const recent = hypoDates.filter((d) => withinWindow(d, subDays(now, 30), now));
  if (recent.length < 4) return null;

  const { startHour, count } = findBestThreeHourWindow(recent.map((d) => d.getHours()));
  if (count * 2 < recent.length) return null;

  const start = formatHourLabel(startHour);
  const end = formatHourLabel(startHour + 3);
  return {
    id: `hypo-time-cluster:${format(now, "yyyy-MM")}`,
    kind: "hypo_time_cluster",
    tone: "neutral",
    title: "A pattern in your low times",
    body: `${count} of your ${recent.length} hypos in the last 30 days were between ${start} and ${end}.`,
  };
}

function detectHypoWeekdayCluster(hypoDates: Date[], now: Date): PatternInsight | null {
  const recent = hypoDates.filter((d) => withinWindow(d, subDays(now, 42), now));
  if (recent.length < 4) return null;

  const perWeekday = new Array<number>(7).fill(0);
  for (const d of recent) {
    perWeekday[d.getDay()]! += 1;
  }
  let bestDay = 0;
  let bestCount = -1;
  for (let day = 0; day < 7; day++) {
    if (perWeekday[day]! > bestCount) {
      bestCount = perWeekday[day]!;
      bestDay = day;
    }
  }
  if (bestCount * 2 < recent.length) return null;

  const weekday = WEEKDAY_NAMES[bestDay]!;
  return {
    id: `hypo-weekday-cluster:${format(now, "yyyy-MM")}`,
    kind: "hypo_weekday_cluster",
    tone: "neutral",
    title: "A pattern in your low days",
    body: `${bestCount} of your ${recent.length} hypos in the last 6 weeks happened on a ${weekday}.`,
  };
}

function detectPostExerciseLows(hypoDates: Date[], exerciseDates: Date[], now: Date): PatternInsight | null {
  const from = subDays(now, 28);
  const recentHypos = hypoDates.filter((d) => withinWindow(d, from, now));
  if (recentHypos.length === 0 || exerciseDates.length === 0) return null;

  let count = 0;
  for (const hypo of recentHypos) {
    const matches = exerciseDates.some((ex) => {
      const gap = hypo.getTime() - ex.getTime();
      return gap >= 2 * HOUR_MS && gap <= 24 * HOUR_MS;
    });
    if (matches) count += 1;
  }
  if (count < 2) return null;

  return {
    id: `post-exercise-lows:${format(now, "yyyy-MM")}`,
    kind: "post_exercise_lows",
    tone: "attention",
    title: "Lows after exercise",
    body: `You've had a low within 24 hours of exercising ${count} times in the last 4 weeks. A bedtime check on training days can help.`,
    actionLabel: "Open bedtime guide",
    actionHref: "/scenarios/bedtime",
  };
}

function detectHypoFreeStretch(hypoDates: Date[], now: Date): PatternInsight | null {
  const past = hypoDates.filter((d) => d.getTime() <= now.getTime());
  if (past.length === 0) return null;

  const sorted = [...past].sort((a, b) => a.getTime() - b.getTime());
  const mostRecent = sorted[sorted.length - 1]!;
  const currentGapMs = now.getTime() - mostRecent.getTime();
  const fullDays = Math.floor(currentGapMs / DAY_MS);
  if (fullDays < 10) return null;

  let longestGapMs = 0;
  for (let i = 1; i < sorted.length; i++) {
    const gap = sorted[i]!.getTime() - sorted[i - 1]!.getTime();
    if (gap > longestGapMs) longestGapMs = gap;
  }
  if (currentGapMs < longestGapMs) return null;

  return {
    id: `hypo-free-stretch:${format(mostRecent, "yyyy-MM-dd")}`,
    kind: "hypo_free_stretch",
    tone: "positive",
    title: "Longest stretch yet",
    body: `No lows logged in ${fullDays} days — your longest stretch in your recent history.`,
  };
}

function detectHypoFrequencyTrend(hypoDates: Date[], now: Date): PatternInsight | null {
  const currentFrom = subDays(now, 30);
  const previousFrom = subDays(now, 60);

  const current = hypoDates.filter((d) => withinWindow(d, currentFrom, now)).length;
  const previous = hypoDates.filter(
    (d) => d.getTime() >= previousFrom.getTime() && d.getTime() < currentFrom.getTime(),
  ).length;

  if (Math.max(current, previous) < 4) return null;

  const period = format(now, "yyyy-MM");
  if (current * 10 <= previous * 6) {
    return {
      id: `hypo-frequency-trend:${period}`,
      kind: "hypo_frequency_trend",
      tone: "positive",
      title: "Fewer lows",
      body: `${current} lows in the last 30 days, down from ${previous} the month before.`,
    };
  }
  if (current * 10 >= previous * 15) {
    return {
      id: `hypo-frequency-trend:${period}`,
      kind: "hypo_frequency_trend",
      tone: "attention",
      title: "More lows lately",
      body: `${current} lows in the last 30 days, up from ${previous} the month before. If this doesn't match what you expect, it can be worth mentioning to your care team.`,
      actionLabel: "Hypo help",
      actionHref: "/tools/hypo-help",
    };
  }
  return null;
}

/**
 * Deterministic, rules-based pattern detection over locally logged hypos and
 * exercise sessions. Attention insights first, then positive, then neutral;
 * capped at `limit` (default 3, used by the compact home widget — the full
 * patterns page passes a higher limit to show everything detected).
 */
export function computePatternInsights(input: PatternInsightsInput, limit = 3): PatternInsight[] {
  const now = input.now ?? new Date();
  const hypoDates = parseValidDates(input.hypos.map((h) => h.timestamp));
  const exerciseDates = parseValidDates(input.exerciseOutcomes.map((e) => e.completedAt));

  const insights = [
    detectHypoTimeCluster(hypoDates, now),
    detectHypoWeekdayCluster(hypoDates, now),
    detectPostExerciseLows(hypoDates, exerciseDates, now),
    detectHypoFreeStretch(hypoDates, now),
    detectHypoFrequencyTrend(hypoDates, now),
  ].filter((x): x is PatternInsight => x != null);

  // Array.prototype.sort is stable, so rule order is preserved within a tone.
  return insights.sort((a, b) => TONE_ORDER[a.tone] - TONE_ORDER[b.tone]).slice(0, limit);
}

import type { BedtimeLog } from "@/lib/storage";

export const BEDTIME_LEARNING_WINDOW_DAYS = 30;
export const BEDTIME_LEARNING_MIN_NIGHTS = 2;
export const BEDTIME_LEARNING_MAX_NIGHTS = 5;
export const BEDTIME_LEARNING_HIGH_STEP = 0.1;
/** Lows move the dose further than highs on purpose. */
export const BEDTIME_LEARNING_LOW_STEP = 0.15;
export const BEDTIME_LEARNING_MIN_MULTIPLIER = 0.7;
export const BEDTIME_LEARNING_MAX_MULTIPLIER = 1.3;
/** Any low in this many most-recent similar nights blocks an upward nudge. */
export const BEDTIME_LEARNING_RECENT_LOW_LOOKBACK = 3;
/** A high night only counts as "not enough insulin" if at least this share of the suggestion was taken. */
const HIGH_NIGHT_MIN_SHARE_TAKEN = 0.9;
const CGM_MIN_READINGS = 4;

export type BedtimeNightVerdict = "low" | "high" | "ok";

export type BedtimeLearningTonight = {
  hadAlcohol: boolean;
  exerciseOvernightCaution: boolean;
  bgTrend: "rising" | "steady" | "falling" | "not_sure";
  recentHypos: boolean;
  sickDayActive: boolean;
};

export type BedtimeLearningTargets = {
  lowMmol: number;
  highMmol: number;
  bgUnits: "mmol/L" | "mg/dL";
};

export type BedtimePersonalAdjustment = {
  /** Multiplier for tonight's cautious dose (1 = no change). */
  multiplier: number;
  direction: "up" | "down" | "none";
  /** Similar nights that were scored. */
  nights: number;
  highNights: number;
  lowNights: number;
  /** Plain-language explanation; empty when there is nothing to say. */
  reason: string;
  /** Set when the data pointed up but a safety rule kept the dose where it was. */
  upwardBlockedReason?: string;
};

const NO_ADJUSTMENT: BedtimePersonalAdjustment = {
  multiplier: 1,
  direction: "none",
  nights: 0,
  highNights: 0,
  lowNights: 0,
  reason: "",
};

function toMmol(value: number, units: string | undefined): number {
  return units === "mg/dL" ? value / 18 : value;
}

function formatThreshold(mmol: number, units: "mmol/L" | "mg/dL"): string {
  return units === "mg/dL" ? `${Math.round(mmol * 18)}` : `${Math.round(mmol * 10) / 10}`;
}

function suggestedUnits(log: BedtimeLog): number | null {
  const n = log.correctionGiven;
  return typeof n === "number" && Number.isFinite(n) && n > 0 ? n : null;
}

/** Units the user says they actually took, or null when unknown. */
function unitsTaken(log: BedtimeLog): number | null {
  const outcome = log.outcome;
  if (!outcome) return null;
  if (typeof outcome.unitsTaken === "number" && Number.isFinite(outcome.unitsTaken)) return outcome.unitsTaken;
  if (outcome.followedAction === "yes") return suggestedUnits(log);
  return null;
}

/** True when this night tells us something about the suggested correction. */
export function isLearnableBedtimeNight(log: BedtimeLog): boolean {
  if (log.actionSuggested !== "correction") return false;
  const suggested = suggestedUnits(log);
  if (suggested == null) return false;
  if (log.sickDayActive) return false;
  const taken = unitsTaken(log);
  return taken != null && taken > 0;
}

/** Judge a night: CGM first, then how it felt, then the morning reading. */
export function judgeBedtimeNight(
  log: BedtimeLog,
  targets: Pick<BedtimeLearningTargets, "lowMmol" | "highMmol">,
): BedtimeNightVerdict {
  const cgm =
    log.overnightCgmSummary && log.overnightCgmSummary.readingCount >= CGM_MIN_READINGS
      ? log.overnightCgmSummary
      : undefined;
  const feel = log.outcome?.overnightFeel;
  const morning = log.outcome?.morningBg;
  const morningMmol =
    typeof morning === "number" && Number.isFinite(morning)
      ? toMmol(morning, log.outcome?.morningBgUnits ?? log.bgUnits)
      : null;
  const endMmol =
    cgm && typeof cgm.endValue === "number" && Number.isFinite(cgm.endValue)
      ? toMmol(cgm.endValue, log.bgUnits)
      : null;

  if (cgm?.hadLow || feel === "went_low" || (morningMmol != null && morningMmol < targets.lowMmol)) {
    return "low";
  }
  if (
    (endMmol != null && endMmol > targets.highMmol) ||
    feel === "went_high" ||
    (morningMmol != null && morningMmol > targets.highMmol)
  ) {
    return "high";
  }
  return "ok";
}

function isSimilarNight(log: BedtimeLog, tonight: BedtimeLearningTonight): boolean {
  const logExerciseCaution = log.exerciseOvernightCaution ?? log.exercisedToday;
  if (Boolean(log.hadAlcohol) !== tonight.hadAlcohol) return false;
  if (Boolean(logExerciseCaution) !== tonight.exerciseOvernightCaution) return false;
  const logRising = log.bgTrend === "rising";
  const tonightRising = tonight.bgTrend === "rising";
  return logRising === tonightRising;
}

function pluralNights(n: number): string {
  return n === 1 ? "1 similar night" : `${n} similar nights`;
}

/**
 * Nudge tonight's bedtime correction up or down from how similar recent nights went.
 * Always relative to the base suggestion — earlier adjustments are never fed back in, so it can't compound.
 */
export function resolveBedtimePersonalAdjustment(
  logs: BedtimeLog[],
  tonight: BedtimeLearningTonight,
  targets: BedtimeLearningTargets,
  nowMs = Date.now(),
): BedtimePersonalAdjustment {
  if (tonight.sickDayActive) return NO_ADJUSTMENT;

  const windowStart = nowMs - BEDTIME_LEARNING_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const similar = logs
    .filter((log) => {
      const t = new Date(log.date).getTime();
      return Number.isFinite(t) && t >= windowStart && t <= nowMs;
    })
    .filter(isLearnableBedtimeNight)
    .filter((log) => isSimilarNight(log, tonight))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, BEDTIME_LEARNING_MAX_NIGHTS);

  if (similar.length < BEDTIME_LEARNING_MIN_NIGHTS) {
    return { ...NO_ADJUSTMENT, nights: similar.length };
  }

  const verdicts = similar.map((log) => {
    const verdict = judgeBedtimeNight(log, targets);
    if (verdict !== "high") return verdict;
    const suggested = suggestedUnits(log) ?? 0;
    const taken = unitsTaken(log) ?? 0;
    // Waking high after taking much less than suggested says nothing about the suggestion itself.
    return taken >= suggested * HIGH_NIGHT_MIN_SHARE_TAKEN ? "high" : "ok";
  });
  const highNights = verdicts.filter((v) => v === "high").length;
  const lowNights = verdicts.filter((v) => v === "low").length;

  const raw = 1 + highNights * BEDTIME_LEARNING_HIGH_STEP - lowNights * BEDTIME_LEARNING_LOW_STEP;
  let multiplier = Math.min(BEDTIME_LEARNING_MAX_MULTIPLIER, Math.max(BEDTIME_LEARNING_MIN_MULTIPLIER, raw));
  multiplier = Math.round(multiplier * 100) / 100;

  let upwardBlockedReason: string | undefined;
  if (multiplier > 1) {
    const recentLow = verdicts.slice(0, BEDTIME_LEARNING_RECENT_LOW_LOOKBACK).includes("low");
    if (recentLow) upwardBlockedReason = "you went low on one of your last few similar nights";
    else if (tonight.recentHypos) upwardBlockedReason = "you've had a recent hypo";
    else if (tonight.bgTrend === "falling") upwardBlockedReason = "your glucose is falling";
    if (upwardBlockedReason) multiplier = 1;
  }

  const base = { nights: similar.length, highNights, lowNights };
  if (multiplier > 1) {
    const pct = Math.round((multiplier - 1) * 100);
    return {
      ...base,
      multiplier,
      direction: "up",
      reason: `Adjusted up ${pct}%: on ${pluralNights(highNights)} you ended above ${formatThreshold(targets.highMmol, targets.bgUnits)} ${targets.bgUnits} after the suggested correction.`,
    };
  }
  if (multiplier < 1) {
    const pct = Math.round((1 - multiplier) * 100);
    return {
      ...base,
      multiplier,
      direction: "down",
      reason: `Adjusted down ${pct}%: on ${pluralNights(lowNights)} you went low after the suggested correction.`,
    };
  }
  return {
    ...base,
    multiplier: 1,
    direction: "none",
    reason: upwardBlockedReason
      ? `Not adjusted up tonight because ${upwardBlockedReason}.`
      : "",
    ...(upwardBlockedReason ? { upwardBlockedReason } : {}),
  };
}

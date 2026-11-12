import { computeSimpleCorrectionDose, type BgUnits } from "@/lib/correction-dose";
import type { OvernightUsualTrend } from "@/lib/bedtime-readiness";
import { PEN_INSULIN_INCREMENT, roundInsulinUnits } from "@/lib/insulin-rounding";
import { BEDTIME_LEARNING_MAX_MULTIPLIER, BEDTIME_LEARNING_MIN_MULTIPLIER } from "@/lib/bedtime-personal-adjustment";

export type BedtimeCorrectionTrend = "rising" | "steady" | "falling" | "not_sure";

export type BedtimeHighSeverity = "moderate" | "high" | "very_high";

/**
 * How far above target the current reading is, independent of the trend arrow. A flat or
 * falling reading that's only just above target and one that's dangerously high both used to
 * get the same base caution share — this is what lets a very high reading (e.g. 15+ mmol/L
 * against a target of 10) push toward a fuller correction even when it isn't currently rising,
 * since staying that high overnight carries its own real risk, not just the risk of a later low.
 */
export function classifyBedtimeHighSeverity(bgMmol: number, targetHighMmol: number): BedtimeHighSeverity {
  const excess = bgMmol - targetHighMmol;
  if (excess > 5) return "very_high";
  if (excess > 2) return "high";
  return "moderate";
}

/**
 * Floor on the *combined* multiplier (trend share × remaining-after-IOB share × extras) once
 * severity is elevated — otherwise a fresh dose (steep IOB cut) stacked with bedtime caution and
 * alcohol/exercise can crush a severe high down to almost nothing. A 15 mmol/L bedtime reading
 * that is expected to rise further is a high-overnight-glucose problem first; delayed-alcohol
 * lows still belong as a warning, but should not keep the share down at ~30%.
 * Skipped when there's a genuine reason to expect glucose to keep dropping on its own
 * (currently falling, or the user says they usually fall overnight) — that caution should stand.
 */
function correctionSeverityFloor(
  severity: BedtimeHighSeverity,
  overnightUsualTrend: OvernightUsualTrend,
): number {
  const rise = overnightUsualTrend === "rise";
  if (severity === "very_high") return rise ? 0.55 : 0.45;
  if (severity === "high") return rise ? 0.45 : 0.3;
  return 0;
}

export type BedtimeCorrectionSuggestion = {
  fullDose: number;
  suggestedDose: number;
  /** Suggestion before any personal (learning) adjustment. */
  baseSuggestedDose: number;
  /** Learning multiplier actually applied after the full-correction cap (1 = none). */
  personalAdjustment: number;
  /** Why learning changed the dose; empty when it didn't. */
  personalAdjustmentNote: string;
  /** Pre-round share of full dose (for display; avoids 100% badge when rounding). */
  pctOfFullDose: number;
  bedtimeReduction: number;
  iobReduction: number;
  /** Combined multiplier from the exercise/alcohol/recent-hypo "Extras" switches (1 = none active). */
  extraCautionMultiplier: number;
  currentBg: number;
  targetBg: number;
  correctionFactor: number;
  bgUnits: BgUnits;
  hasIOB: boolean;
  trendNote: string;
  overnightTrendNote: string;
  /** Summary of which "Extras" switches made this dose more cautious, e.g. "Made more cautious for alcohol." Empty when none apply. */
  extraCautionNote: string;
  iobWarning: string;
  exerciseWarning: string;
  alcoholWarning: string;
  hypoWarning: string;
  sickDayWarning: string;
};

/**
 * Single, coherent result from the bedtime correction engine. Every caller must branch on
 * `status` — never treat this as a plain nullable dose, since "no dose" has several distinct
 * (and very different) causes that need different messaging:
 *  - `no_correction_needed`: BG is already at/under the (trend-adjusted) aim point.
 *  - `no_isf`: correction factor isn't set, and BG is high enough that one would help.
 *  - `dose_too_small`: BG is high enough to want a correction, ISF is set, but bedtime
 *    caution + IOB reductions bring the dose under {@link BEDTIME_MIN_ACTIONABLE_DOSE_U}
 *    (half a unit) — this is NOT a missing-ISF case.
 *  - `dose`: a calculated, cautious bedtime correction.
 */
export type BedtimeCorrectionResult =
  | { status: "no_isf" }
  | {
      status: "no_correction_needed";
      currentBg: number;
      aimBg: number;
      bgUnits: BgUnits;
    }
  | {
      status: "dose_too_small";
      currentBg: number;
      aimBg: number;
      bgUnits: BgUnits;
      rawDose: number;
      note: string;
    }
  | ({ status: "dose" } & BedtimeCorrectionSuggestion)
  | { status: "needs_pump_iob" };

export function bedtimeTrendReduction(
  trend: BedtimeCorrectionTrend,
  options: { severity: BedtimeHighSeverity; overnightUsualTrend?: OvernightUsualTrend },
): { multiplier: number; note: string; overnightNote: string } {
  const base = baseTrendTier(trend, options.severity);
  const overnight = options.overnightUsualTrend ?? "not_sure";

  let multiplier = base.multiplier;
  let overnightNote = "";

  if (overnight === "rise") {
    // A known overnight rise should never be undercut by a momentary falling arrow — floor to
    // the standard cautious share, then correct a little more assertively since levels are
    // expected to climb further left alone.
    multiplier = Math.min(Math.max(multiplier, 0.5) + 0.1, 0.9);
    overnightNote =
      "You said levels usually rise overnight, so we corrected a bit more assertively and aimed lower in your range.";
  } else if (overnight === "fall") {
    // A known overnight drop should cap how assertive we get even if currently rising, and we
    // shave a bit more off for safety margin against a later low.
    multiplier = Math.max(Math.min(multiplier, 0.5) - 0.15, 0.15);
    overnightNote =
      "You said levels usually fall overnight, so we used extra caution and aimed higher in your range.";
  }

  return { multiplier, note: base.note, overnightNote };
}

function baseTrendTier(
  trend: BedtimeCorrectionTrend,
  severity: BedtimeHighSeverity,
): { multiplier: number; note: string } {
  switch (trend) {
    case "rising": {
      if (severity === "very_high") {
        return {
          multiplier: 0.9,
          note: "Rising and significantly above target — using most of a full correction, since staying this high overnight carries its own risk.",
        };
      }
      if (severity === "high") {
        return {
          multiplier: 0.85,
          note: "Rising and well above target — using a larger share of full correction than when stable.",
        };
      }
      return {
        multiplier: 0.75,
        note: "Rising — using more than the usual cautious bedtime share while levels climb.",
      };
    }
    case "falling": {
      if (severity === "very_high") {
        return {
          multiplier: 0.45,
          note: "Falling, but still significantly above target — correcting more than the usual falling-trend caution, while staying well short of a full dose.",
        };
      }
      return {
        multiplier: 0.3,
        note: "Falling right now — smaller correction, since glucose may keep dropping on its own overnight.",
      };
    }
    case "steady":
    case "not_sure":
    default: {
      const label = trend === "steady" ? "Stable" : "Trend not set";
      if (severity === "very_high") {
        return {
          multiplier: 0.65,
          note: `${label}, but significantly above target — using more than the usual 50% bedtime share, since staying this high overnight carries its own risk.`,
        };
      }
      if (severity === "high") {
        return {
          multiplier: 0.55,
          note: `${label} and well above target — a slightly larger share of full correction than the usual bedtime caution.`,
        };
      }
      return {
        multiplier: 0.5,
        note: `${label} — standard cautious bedtime reduction (~50% of full correction).`,
      };
    }
  }
}

/**
 * How much smaller a bedtime correction should be when specific overnight risk factors from the
 * "Extras" switches are present. Each one makes a *smaller* correction more appropriate — never a
 * larger one — because they all raise the risk of an overnight low, never a high:
 *  - recent/harder exercise (not every light “trained today”) increases insulin sensitivity overnight;
 *  - alcohol can cause delayed lows;
 *  - a recent hypo raises the chance of another one and can blunt hypo awareness.
 * These stack multiplicatively with the trend/IOB reduction above. The severity floor in
 * `calculateBedtimeCorrectionDose` still applies afterwards, so a genuinely severe high is not
 * crushed to almost nothing just because several caution factors are selected at once.
 */
export const BEDTIME_EXERCISE_CAUTION_MULTIPLIER = 0.85;
export const BEDTIME_ALCOHOL_CAUTION_MULTIPLIER = 0.85;
export const BEDTIME_RECENT_HYPO_CAUTION_MULTIPLIER = 0.8;

/** Below this, a bedtime correction is not worth dosing — recheck instead of micro-dosing. */
export const BEDTIME_MIN_ACTIONABLE_DOSE_U = 0.5;
/** Pumps deliver fine increments, so a smaller bedtime correction is still worth showing. */
export const BEDTIME_PUMP_MIN_ACTIONABLE_DOSE_U = 0.2;

export function bedtimeMinActionableDose(roundIncrement: number): number {
  return roundIncrement < 0.5 ? BEDTIME_PUMP_MIN_ACTIONABLE_DOSE_U : BEDTIME_MIN_ACTIONABLE_DOSE_U;
}

function joinReasons(reasons: string[]): string {
  if (reasons.length === 0) return "";
  if (reasons.length === 1) return reasons[0]!;
  if (reasons.length === 2) return `${reasons[0]} and ${reasons[1]}`;
  return `${reasons.slice(0, -1).join(", ")}, and ${reasons[reasons.length - 1]}`;
}

export function bedtimeExtraCautionMultiplier(ctx: {
  /**
   * Only when exercise actually raises overnight hypo risk (recent/hard/stacked) —
   * not every “trained today” tick. See `bedtimeExerciseRaisesOvernightCaution`.
   */
  exerciseOvernightCaution: boolean;
  hadAlcohol: boolean;
  recentHypos: boolean;
}): { multiplier: number; reasons: string[]; note: string } {
  let multiplier = 1;
  const reasons: string[] = [];
  if (ctx.exerciseOvernightCaution) {
    multiplier *= BEDTIME_EXERCISE_CAUTION_MULTIPLIER;
    reasons.push("recent or harder exercise");
  }
  if (ctx.hadAlcohol) {
    multiplier *= BEDTIME_ALCOHOL_CAUTION_MULTIPLIER;
    reasons.push("alcohol");
  }
  if (ctx.recentHypos) {
    multiplier *= BEDTIME_RECENT_HYPO_CAUTION_MULTIPLIER;
    reasons.push("a recent hypo");
  }
  const note = reasons.length > 0 ? `Made more cautious for ${joinReasons(reasons)}.` : "";
  return { multiplier, reasons, note };
}

function iobReductionForHours(insulinHours: number): number {
  if (insulinHours < 1) return 0.6;
  if (insulinHours < 2) return 0.4;
  if (insulinHours < 3) return 0.2;
  if (insulinHours < 4) return 0.1;
  return 0;
}

function iobWarningForHours(insulinHours: number): string {
  if (insulinHours < 1) {
    return "You have significant active insulin from less than 1 hour ago. This may bring you down on its own.";
  }
  if (insulinHours < 2) {
    return "Recent insulin is still active. It may bring you down further — that's the main reason this is smaller than a full correction.";
  }
  if (insulinHours < 4) {
    return "Some insulin is still active from earlier. A smaller correction accounts for this.";
  }
  return "";
}

function iobWarningForPumpUnits(iobUnits: number): string {
  if (iobUnits <= 0) return "";
  return `This subtracts the ${iobUnits}u IOB you entered from a standard correction, then applies bedtime caution. Confirm the number on your pump before any correction.`;
}

/**
 * When a bedtime correction is in play at all, given the user's target range and their
 * self-reported usual overnight pattern — someone who usually drops overnight needs a higher bar
 * before we suggest correcting, and someone who usually rises needs a lower one.
 */
export function resolveBedtimeCorrectionThreshold(
  targetLowMmol: number,
  targetHighMmol: number,
  overnightUsualTrend: OvernightUsualTrend,
): number {
  const span = Math.max(targetHighMmol - targetLowMmol, 0.1);
  if (overnightUsualTrend === "rise") {
    return targetLowMmol + span * 0.25;
  }
  if (overnightUsualTrend === "fall") {
    return targetHighMmol + span * 0.25;
  }
  return targetHighMmol;
}

/** Default bedtime target when the user hasn't set one: the middle of their target range. */
export function defaultBedtimeTargetMmol(targetLowMmol: number, targetHighMmol: number): number {
  return (targetLowMmol + targetHighMmol) / 2;
}

/**
 * Where a bedtime correction brings glucose down to: the user's bedtime target (default the
 * middle of their range), aimed a little lower if they usually rise overnight and a little higher
 * if they usually fall. Always stays inside the target range.
 */
export function resolveBedtimeCorrectionAim(
  targetLowMmol: number,
  targetHighMmol: number,
  overnightUsualTrend: OvernightUsualTrend,
  bedtimeTargetMmol?: number | null,
): number {
  const span = Math.max(targetHighMmol - targetLowMmol, 0.1);
  const base =
    bedtimeTargetMmol != null && Number.isFinite(bedtimeTargetMmol) && bedtimeTargetMmol > 0
      ? bedtimeTargetMmol
      : defaultBedtimeTargetMmol(targetLowMmol, targetHighMmol);
  let aim = base;
  if (overnightUsualTrend === "rise") {
    aim = Math.max(base - 0.5, Math.min(base, targetLowMmol + span * 0.25));
  } else if (overnightUsualTrend === "fall") {
    aim = Math.min(base + 1, targetHighMmol);
  }
  return Math.min(Math.max(aim, targetLowMmol), targetHighMmol);
}

export function calculateBedtimeCorrectionDose(params: {
  bgMmol: number;
  targetLowMmol: number;
  targetHighMmol: number;
  correctionFactor: number;
  bgUnits: BgUnits;
  insulinHours: number;
  bgTrend: BedtimeCorrectionTrend;
  overnightUsualTrend: OvernightUsualTrend;
  /** Shrink dose only when exercise raises overnight hypo risk — not every light session. */
  exerciseOvernightCaution: boolean;
  hadAlcohol: boolean;
  recentHypos: boolean;
  sickDayActive: boolean;
  /** When set (pump users), subtract these units instead of using hours-since-insulin. */
  pumpIobUnits?: number | null;
  /** When true, a blank pump IOB withholds the correction instead of treating it as zero. */
  requirePumpIob?: boolean;
  roundIncrement?: number;
  /** User's bedtime target (mmol/L). Defaults to the middle of the target range. */
  bedtimeTargetMmol?: number | null;
  /** Opt-in learning from similar nights. Ignored on sick days. */
  personalAdjustment?: { multiplier: number; reason: string } | null;
}): BedtimeCorrectionResult {
  const {
    bgMmol,
    targetLowMmol,
    targetHighMmol,
    correctionFactor,
    bgUnits,
    insulinHours,
    bgTrend,
    overnightUsualTrend,
    exerciseOvernightCaution,
    hadAlcohol,
    recentHypos,
    sickDayActive,
    pumpIobUnits,
    requirePumpIob = false,
    roundIncrement = PEN_INSULIN_INCREMENT,
    bedtimeTargetMmol,
    personalAdjustment,
  } = params;

  const thresholdMmol = resolveBedtimeCorrectionThreshold(targetLowMmol, targetHighMmol, overnightUsualTrend);
  const aimMmol = resolveBedtimeCorrectionAim(targetLowMmol, targetHighMmol, overnightUsualTrend, bedtimeTargetMmol);
  const toDisplay = (mmol: number) =>
    bgUnits === "mg/dL" ? Math.round(mmol * 18) : Math.round(mmol * 10) / 10;

  // Check whether correction is even in play before worrying about a missing ISF — no point
  // sending someone to Settings when their glucose doesn't warrant a correction anyway.
  if (bgMmol <= thresholdMmol) {
    return {
      status: "no_correction_needed",
      currentBg: toDisplay(bgMmol),
      aimBg: toDisplay(thresholdMmol),
      bgUnits,
    };
  }

  if (!correctionFactor || correctionFactor <= 0) {
    return { status: "no_isf" };
  }

  const simple = computeSimpleCorrectionDose({
    currentBg: toDisplay(bgMmol),
    targetBg: toDisplay(aimMmol),
    correctionFactor,
    bgUnits,
    roundIncrement,
  });
  if (simple.status !== "dose") {
    return {
      status: "no_correction_needed",
      currentBg: toDisplay(bgMmol),
      aimBg: toDisplay(aimMmol),
      bgUnits,
    };
  }

  if (requirePumpIob && (pumpIobUnits == null || !Number.isFinite(pumpIobUnits))) {
    return { status: "needs_pump_iob" };
  }

  const fullDose = simple.fullDoseRounded;
  const usingPumpIob = pumpIobUnits != null && Number.isFinite(pumpIobUnits);
  const pumpIob = usingPumpIob ? Math.max(0, pumpIobUnits!) : 0;
  // Shares apply to the exact dose; rounding happens once at the end so pens don't lose a unit twice.
  const remainingFull = usingPumpIob ? Math.max(0, simple.exactDose - pumpIob) : simple.exactDose;
  const iobReduction = usingPumpIob ? 0 : iobReductionForHours(insulinHours);
  const severity = classifyBedtimeHighSeverity(bgMmol, targetHighMmol);
  const { multiplier: bedtimeReduction, note: trendNote, overnightNote } = bedtimeTrendReduction(bgTrend, {
    severity,
    overnightUsualTrend,
  });
  const { multiplier: extraCautionMultiplier, note: extraCautionNote } = bedtimeExtraCautionMultiplier({
    exerciseOvernightCaution,
    hadAlcohol,
    recentHypos,
  });

  // Don't let a severe-high floor override genuine falling-trend caution — only raise the floor
  // when nothing already suggests glucose is on its way down on its own.
  const expectingDrop = bgTrend === "falling" || overnightUsualTrend === "fall";
  const rawMultiplier = bedtimeReduction * (1 - iobReduction) * extraCautionMultiplier;
  const effectiveMultiplier = expectingDrop
    ? rawMultiplier
    : Math.max(rawMultiplier, correctionSeverityFloor(severity, overnightUsualTrend));

  const baseRaw = remainingFull * effectiveMultiplier;
  const requestedAdjustment =
    personalAdjustment && !sickDayActive && Number.isFinite(personalAdjustment.multiplier)
      ? Math.min(BEDTIME_LEARNING_MAX_MULTIPLIER, Math.max(BEDTIME_LEARNING_MIN_MULTIPLIER, personalAdjustment.multiplier))
      : 1;
  // Learning can never push past a full correction to the bedtime target (after pump IOB).
  const rawEffective = requestedAdjustment === 1 ? baseRaw : Math.min(remainingFull, baseRaw * requestedAdjustment);
  const appliedAdjustment = baseRaw > 0 ? Math.round((rawEffective / baseRaw) * 100) / 100 : 1;
  const personalAdjustmentNote =
    requestedAdjustment === 1 || !personalAdjustment
      ? ""
      : appliedAdjustment < requestedAdjustment
        ? `${personalAdjustment.reason} Capped at a full correction to your bedtime target.`
        : personalAdjustment.reason;
  const baseSuggestedDose = roundInsulinUnits(baseRaw, roundIncrement);
  const suggestedDose = roundInsulinUnits(rawEffective, roundIncrement);
  const pctOfFullDose = simple.exactDose > 0 ? Math.round((rawEffective / simple.exactDose) * 100) : 0;
  const minActionable = bedtimeMinActionableDose(roundIncrement);

  if (suggestedDose < minActionable) {
    const extraSuffix = [extraCautionNote, personalAdjustmentNote].filter(Boolean).map((s) => ` ${s}`).join("");
    const tooSmallLead =
      usingPumpIob && pumpIob > 0 && remainingFull <= 0
        ? "Pump IOB already covers a standard correction."
        : minActionable === BEDTIME_MIN_ACTIONABLE_DOSE_U
          ? "A cautious bedtime correction here works out to less than half a unit."
          : `A cautious bedtime correction here works out to less than ${minActionable}u.`;
    const tooSmallTail =
      usingPumpIob && pumpIob > 0 && remainingFull <= 0
        ? `${extraSuffix} Recheck glucose rather than stacking more insulin.`
        : `${extraSuffix} Recheck in 30–60 minutes rather than dosing a tiny amount — or round up only if that matches your care plan.`;
    return {
      status: "dose_too_small",
      currentBg: toDisplay(bgMmol),
      aimBg: toDisplay(aimMmol),
      bgUnits,
      rawDose: Math.round(rawEffective * 10) / 10,
      note: `${tooSmallLead}${tooSmallTail}`,
    };
  }

  let exerciseWarning = "";
  if (exerciseOvernightCaution) {
    exerciseWarning =
      "Recent or harder exercise can raise overnight hypo risk, so we've made this suggestion more cautious.";
  }

  let alcoholWarning = "";
  if (hadAlcohol) {
    alcoholWarning =
      "Alcohol can cause delayed lows later tonight, so this stays a cautious share — not a full correction.";
  }

  let hypoWarning = "";
  if (recentHypos) {
    hypoWarning =
      "A recent hypo raises the chance of another low overnight, so we've made this suggestion more cautious.";
  }

  let sickDayWarning = "";
  if (sickDayActive) {
    sickDayWarning =
      "You're in sick day mode. Illness can make blood glucose harder to predict. Consider a smaller correction or consult your diabetes team.";
  }

  return {
    status: "dose",
    fullDose,
    suggestedDose,
    baseSuggestedDose,
    personalAdjustment: appliedAdjustment,
    personalAdjustmentNote,
    pctOfFullDose,
    bedtimeReduction,
    iobReduction,
    extraCautionMultiplier,
    extraCautionNote,
    currentBg: toDisplay(bgMmol),
    targetBg: toDisplay(aimMmol),
    correctionFactor,
    bgUnits,
    hasIOB: usingPumpIob ? pumpIob > 0 : insulinHours < 4,
    trendNote,
    overnightTrendNote: overnightNote,
    iobWarning: usingPumpIob ? iobWarningForPumpUnits(pumpIob) : iobWarningForHours(insulinHours),
    exerciseWarning,
    alcoholWarning,
    hypoWarning,
    sickDayWarning,
  };
}

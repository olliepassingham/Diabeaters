import { computeSimpleCorrectionDose, type BgUnits } from "@/lib/correction-dose";
import type { OvernightUsualTrend } from "@/lib/bedtime-readiness";

export type BedtimeCorrectionTrend = "rising" | "steady" | "falling" | "not_sure";

export type BedtimeCorrectionSuggestion = {
  fullDose: number;
  suggestedDose: number;
  /** Pre-round share of full dose (for display; avoids 100% badge when rounding). */
  pctOfFullDose: number;
  bedtimeReduction: number;
  iobReduction: number;
  currentBg: number;
  targetBg: number;
  correctionFactor: number;
  bgUnits: BgUnits;
  hasIOB: boolean;
  trendNote: string;
  overnightTrendNote: string;
  iobWarning: string;
  exerciseWarning: string;
  alcoholWarning: string;
  sickDayWarning: string;
};

/**
 * Single, coherent result from the bedtime correction engine. Every caller must branch on
 * `status` — never treat this as a plain nullable dose, since "no dose" has several distinct
 * (and very different) causes that need different messaging:
 *  - `no_correction_needed`: BG is already at/under the (trend-adjusted) aim point.
 *  - `no_isf`: correction factor isn't set, and BG is high enough that one would help.
 *  - `dose_too_small`: BG is high enough to want a correction, ISF is set, but bedtime
 *    caution + IOB reductions bring the dose under half a unit — this is NOT a missing-ISF case.
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
  | ({ status: "dose" } & BedtimeCorrectionSuggestion);

export function bedtimeTrendReduction(
  trend: BedtimeCorrectionTrend,
  options: { wellAboveTarget: boolean; overnightUsualTrend?: OvernightUsualTrend },
): { multiplier: number; note: string; overnightNote: string } {
  const base = baseTrendTier(trend, options.wellAboveTarget);
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
  wellAboveTarget: boolean,
): { multiplier: number; note: string } {
  switch (trend) {
    case "rising":
      return wellAboveTarget
        ? {
            multiplier: 0.85,
            note: "Rising and well above target — using a larger share of full correction than when stable.",
          }
        : {
            multiplier: 0.75,
            note: "Rising — using more than the usual cautious bedtime share while levels climb.",
          };
    case "falling":
      return {
        multiplier: 0.3,
        note: "Falling right now — smaller correction, since glucose may keep dropping on its own overnight.",
      };
    case "steady":
      return {
        multiplier: 0.5,
        note: "Stable — standard cautious bedtime reduction (~50% of full correction).",
      };
    case "not_sure":
    default:
      return {
        multiplier: 0.5,
        note: "Trend not set — default cautious bedtime reduction (~50% of full correction).",
      };
  }
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
    return "You still have active insulin from your recent dose. It may bring you down further.";
  }
  if (insulinHours < 4) {
    return "Some insulin is still active from earlier. A smaller correction accounts for this.";
  }
  return "";
}

/**
 * Where we aim the correction, given the user's target range and their self-reported usual
 * overnight pattern. This is also the trigger threshold — i.e. someone who usually drops
 * overnight needs a higher bar before we suggest correcting at all, and someone who usually
 * rises needs a lower aim point since levels are expected to climb further unaided.
 */
export function resolveBedtimeCorrectionAim(
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

export function calculateBedtimeCorrectionDose(params: {
  bgMmol: number;
  targetLowMmol: number;
  targetHighMmol: number;
  correctionFactor: number;
  bgUnits: BgUnits;
  insulinHours: number;
  bgTrend: BedtimeCorrectionTrend;
  overnightUsualTrend: OvernightUsualTrend;
  wellAboveTarget: boolean;
  exercisedToday: boolean;
  hadAlcohol: boolean;
  sickDayActive: boolean;
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
    wellAboveTarget,
    exercisedToday,
    hadAlcohol,
    sickDayActive,
  } = params;

  const aimMmol = resolveBedtimeCorrectionAim(targetLowMmol, targetHighMmol, overnightUsualTrend);
  const toDisplay = (mmol: number) =>
    bgUnits === "mg/dL" ? Math.round(mmol * 18) : Math.round(mmol * 10) / 10;

  // Check whether correction is even in play before worrying about a missing ISF — no point
  // sending someone to Settings when their glucose doesn't warrant a correction anyway.
  if (bgMmol <= aimMmol) {
    return {
      status: "no_correction_needed",
      currentBg: toDisplay(bgMmol),
      aimBg: toDisplay(aimMmol),
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
  });
  if (simple.status !== "dose") {
    return {
      status: "no_correction_needed",
      currentBg: toDisplay(bgMmol),
      aimBg: toDisplay(aimMmol),
      bgUnits,
    };
  }

  const fullDose = simple.fullDoseRounded;
  const iobReduction = iobReductionForHours(insulinHours);
  const { multiplier: bedtimeReduction, note: trendNote, overnightNote } = bedtimeTrendReduction(bgTrend, {
    wellAboveTarget,
    overnightUsualTrend,
  });

  const rawEffective = fullDose * bedtimeReduction * (1 - iobReduction);
  const suggestedDose = Math.round(rawEffective);
  const pctOfFullDose = fullDose > 0 ? Math.round((rawEffective / fullDose) * 100) : 0;

  if (suggestedDose <= 0) {
    return {
      status: "dose_too_small",
      currentBg: toDisplay(bgMmol),
      aimBg: toDisplay(aimMmol),
      bgUnits,
      rawDose: Math.round(rawEffective * 10) / 10,
      note:
        "A cautious bedtime correction here works out to less than half a unit. Many people either round up to 1 unit if that fits their plan, or hold off and recheck glucose within an hour.",
    };
  }

  let exerciseWarning = "";
  if (exercisedToday) {
    exerciseWarning =
      "Exercise increases your sensitivity to insulin, especially overnight. Be extra cautious with any correction.";
  }

  let alcoholWarning = "";
  if (hadAlcohol) {
    alcoholWarning = "Alcohol can cause delayed lows. Correcting at bedtime after drinking carries extra risk.";
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
    pctOfFullDose,
    bedtimeReduction,
    iobReduction,
    currentBg: toDisplay(bgMmol),
    targetBg: toDisplay(aimMmol),
    correctionFactor,
    bgUnits,
    hasIOB: insulinHours < 4,
    trendNote,
    overnightTrendNote: overnightNote,
    iobWarning: iobWarningForHours(insulinHours),
    exerciseWarning,
    alcoholWarning,
    sickDayWarning,
  };
}

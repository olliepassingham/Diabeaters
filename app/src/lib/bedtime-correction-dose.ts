import { computeSimpleCorrectionDose, type BgUnits } from "@/lib/correction-dose";

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
  iobWarning: string;
  exerciseWarning: string;
  alcoholWarning: string;
  sickDayWarning: string;
};

export function bedtimeTrendReduction(
  trend: BedtimeCorrectionTrend,
  options: { wellAboveTarget: boolean },
): { multiplier: number; note: string } {
  switch (trend) {
    case "rising":
      return options.wellAboveTarget
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
        note: "Falling — smaller correction; glucose may drop further on its own overnight.",
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

export function calculateBedtimeCorrectionDose(params: {
  bgMmol: number;
  targetHighMmol: number;
  correctionFactor: number;
  bgUnits: BgUnits;
  insulinHours: number;
  bgTrend: BedtimeCorrectionTrend;
  wellAboveTarget: boolean;
  exercisedToday: boolean;
  hadAlcohol: boolean;
  sickDayActive: boolean;
}): BedtimeCorrectionSuggestion | null {
  const {
    bgMmol,
    targetHighMmol,
    correctionFactor,
    bgUnits,
    insulinHours,
    bgTrend,
    wellAboveTarget,
    exercisedToday,
    hadAlcohol,
    sickDayActive,
  } = params;

  if (!correctionFactor || correctionFactor <= 0) return null;

  const bgInUserUnits = bgUnits === "mg/dL" ? Math.round(bgMmol * 18) : Math.round(bgMmol * 10) / 10;
  const targetInUserUnits =
    bgUnits === "mg/dL" ? Math.round(targetHighMmol * 18) : Math.round(targetHighMmol * 10) / 10;

  const simple = computeSimpleCorrectionDose({
    currentBg: bgInUserUnits,
    targetBg: targetInUserUnits,
    correctionFactor,
    bgUnits,
  });
  if (simple.status !== "dose") return null;

  const fullDose = simple.fullDoseRounded;
  const iobReduction = iobReductionForHours(insulinHours);
  const { multiplier: bedtimeReduction, note: trendNote } = bedtimeTrendReduction(bgTrend, { wellAboveTarget });

  const rawEffective = fullDose * bedtimeReduction * (1 - iobReduction);
  const suggestedDose = Math.round(rawEffective);
  const pctOfFullDose = fullDose > 0 ? Math.round((rawEffective / fullDose) * 100) : 0;

  if (suggestedDose <= 0) return null;

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
    fullDose,
    suggestedDose,
    pctOfFullDose,
    bedtimeReduction,
    iobReduction,
    currentBg: bgInUserUnits,
    targetBg: targetInUserUnits,
    correctionFactor,
    bgUnits,
    hasIOB: insulinHours < 4,
    trendNote,
    iobWarning: iobWarningForHours(insulinHours),
    exerciseWarning,
    alcoholWarning,
    sickDayWarning,
  };
}

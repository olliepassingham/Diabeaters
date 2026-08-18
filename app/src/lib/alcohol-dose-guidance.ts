import type { AlcoholIntensity, AlcoholTrend } from "@/lib/alcohol-night-tool";
import { isBgLow } from "@/lib/alcohol-night-tool";
import { PEN_INSULIN_INCREMENT, roundInsulinUnits } from "@/lib/insulin-rounding";

export type AlcoholDoseSituation = "meal_with_drinks" | "late_snack" | "before_out" | "feels_wrong";

export type AlcoholRiskLevel = "aware" | "elevated" | "high";

export type BgRangeLean = "lower" | "neutral" | "higher";

export type AlcoholDoseGuidance = {
  riskLevel: AlcoholRiskLevel;
  riskHeadline: string;
  riskLead: string;
  overnightBullets: string[];
  standardDose: number;
  exactDose: number;
  considerMinDose: number;
  considerMaxDose: number;
  reductionPctMin: number;
  reductionPctMax: number;
  reductionNote: string;
  drinkingIntensity: AlcoholIntensity;
  contextLabel: string;
  bgNote: string | null;
  suggestedLeanDose: number | null;
  bgUsed: boolean;
};

const INTENSITY_LABEL: Record<AlcoholIntensity, string> = {
  light: "light drinking",
  moderate: "moderate drinking",
  long_or_heavy: "heavier night",
};

const REDUCTION_BY_INTENSITY: Record<
  AlcoholIntensity,
  { minPct: number; maxPct: number; riskLevel: AlcoholRiskLevel; headline: string }
> = {
  light: { minPct: 0, maxPct: 15, riskLevel: "aware", headline: "Light drinking tonight" },
  moderate: { minPct: 10, maxPct: 25, riskLevel: "elevated", headline: "Moderate drinking tonight" },
  long_or_heavy: { minPct: 15, maxPct: 35, riskLevel: "high", headline: "Heavier drinking tonight" },
};

function formatMealLabel(mealType: string): string {
  if (!mealType) return "meal";
  return mealType === "snack" ? "snack" : mealType;
}

function buildContextLabel(params: {
  carbsG: number | null;
  mealType: string;
  drinkingIntensity: AlcoholIntensity;
  situation: AlcoholDoseSituation;
}): string {
  const parts: string[] = [];
  if (params.carbsG != null && params.carbsG > 0) {
    parts.push(`${params.carbsG}g ${formatMealLabel(params.mealType)}`);
  } else if (params.situation === "late_snack") {
    parts.push("late snack");
  } else if (params.situation === "before_out") {
    parts.push("before going out");
  }
  parts.push(INTENSITY_LABEL[params.drinkingIntensity]);
  return parts.join(" · ");
}

function buildRiskLead(params: { standardDose: number }): string {
  if (params.standardDose <= 0) return "Focus on checks — confirm any bolus with your team.";
  return "Confirm with your team before dosing.";
}

function buildOvernightBullets(params: {
  drinkingIntensity: AlcoholIntensity;
  situation: AlcoholDoseSituation;
}): string[] {
  if (params.situation === "late_snack") {
    if (params.drinkingIntensity === "long_or_heavy") return ["Plan a bedtime check."];
    return ["Extra check before sleep."];
  }

  if (params.drinkingIntensity === "long_or_heavy") return ["Delayed lows possible — schedule checks below."];
  if (params.drinkingIntensity === "moderate") return ["Schedule bedtime checks below."];
  return ["One extra check before sleep."];
}

function applyBgToDoseRange(
  minDose: number,
  maxDose: number,
  params: {
    bgValue: number | null;
    bgSkipped: boolean;
    bgTrend: AlcoholTrend | null;
    bgUnits: "mmol/L" | "mg/dL";
    roundIncrement?: number;
  },
): {
  minDose: number;
  maxDose: number;
  lean: BgRangeLean | null;
  suggestedLeanDose: number | null;
  bgNote: string | null;
} {
  if (params.bgSkipped || params.bgValue == null || maxDose <= 0) {
    return { minDose, maxDose, lean: null, suggestedLeanDose: null, bgNote: null };
  }

  const u = params.bgUnits;
  const bg = params.bgValue;
  const trend = params.bgTrend || "unknown";
  const lowLine = u === "mg/dL" ? 90 : 5;
  const highLine = u === "mg/dL" ? 180 : 10;

  let lean: BgRangeLean = "neutral";
  let bgNote: string;

  if (isBgLow(bg, u) || trend === "falling" || bg < lowLine) {
    lean = "lower";
    bgNote = trend === "falling" ? `BG ${bg} falling` : `BG ${bg} low`;
  } else if (trend === "rising" || bg > highLine) {
    lean = "higher";
    bgNote = bg > highLine ? `BG ${bg} high` : `BG ${bg} rising`;
  } else {
    bgNote = `BG ${bg} steady`;
  }

  let adjMin = minDose;
  let adjMax = maxDose;
  if (minDose < maxDose) {
    if (lean === "lower") adjMax = Math.max(minDose, maxDose - 1);
    if (lean === "higher") adjMin = Math.min(maxDose, minDose + 1);
  }

  const suggestedLeanDose =
    adjMin === adjMax
      ? adjMin
      : lean === "lower"
        ? adjMin
        : lean === "higher"
          ? adjMax
          : roundInsulinUnits((adjMin + adjMax) / 2, params.roundIncrement ?? PEN_INSULIN_INCREMENT);

  return { minDose: adjMin, maxDose: adjMax, lean, suggestedLeanDose, bgNote };
}

/** Educational range: many teams suggest less insulin with alcohol than for food alone. */
export function buildAlcoholDoseGuidance(params: {
  standardDose: number;
  exactDose: number;
  drinkingIntensity: AlcoholIntensity;
  carbsG?: number | null;
  mealType?: string;
  situation?: AlcoholDoseSituation;
  bgSkipped?: boolean;
  bgValue?: number | null;
  bgTrend?: AlcoholTrend | null;
  bgUnits?: "mmol/L" | "mg/dL";
  roundIncrement?: number;
}): AlcoholDoseGuidance {
  const meta = REDUCTION_BY_INTENSITY[params.drinkingIntensity];
  const base = params.exactDose > 0 ? params.exactDose : params.standardDose;
  const situation = params.situation ?? "meal_with_drinks";
  const mealType = params.mealType ?? "snack";
  const carbsG = params.carbsG ?? null;

  const increment = params.roundIncrement ?? PEN_INSULIN_INCREMENT;
  let considerMinDose = 0;
  let considerMaxDose = params.standardDose;

  if (base > 0 && meta.maxPct > 0) {
    considerMinDose = roundInsulinUnits(Math.max(0, base * (1 - meta.maxPct / 100)), increment);
    considerMaxDose = roundInsulinUnits(Math.max(0, base * (1 - meta.minPct / 100)), increment);
    if (considerMinDose > considerMaxDose) {
      [considerMinDose, considerMaxDose] = [considerMaxDose, considerMinDose];
    }
  }

  const reductionNote =
    meta.maxPct === 0
      ? "Confirm with your team before bolusing."
      : params.standardDose <= 0
        ? "No food bolus — still plan checks for alcohol."
        : `Often ${meta.minPct}–${meta.maxPct}% below a normal ${params.standardDose}u meal bolus.`;

  const contextLabel = buildContextLabel({
    carbsG,
    mealType,
    drinkingIntensity: params.drinkingIntensity,
    situation,
  });

  const bgAdj = applyBgToDoseRange(considerMinDose, considerMaxDose, {
    bgValue: params.bgValue ?? null,
    bgSkipped: params.bgSkipped ?? true,
    bgTrend: params.bgTrend ?? null,
    bgUnits: params.bgUnits ?? "mmol/L",
    roundIncrement: increment,
  });

  considerMinDose = bgAdj.minDose;
  considerMaxDose = bgAdj.maxDose;

  const riskLead = buildRiskLead({ standardDose: params.standardDose });

  return {
    riskLevel: meta.riskLevel,
    riskHeadline: meta.headline,
    riskLead,
    overnightBullets: buildOvernightBullets({ drinkingIntensity: params.drinkingIntensity, situation }),
    standardDose: params.standardDose,
    exactDose: params.exactDose,
    considerMinDose,
    considerMaxDose,
    reductionPctMin: meta.minPct,
    reductionPctMax: meta.maxPct,
    reductionNote,
    drinkingIntensity: params.drinkingIntensity,
    contextLabel,
    bgNote: bgAdj.bgNote,
    suggestedLeanDose: bgAdj.suggestedLeanDose,
    bgUsed: !params.bgSkipped && params.bgValue != null,
  };
}

/** One-line lean + BG hint for the result hero. */
export function formatAlcoholLeanLine(guidance: AlcoholDoseGuidance): string | null {
  const parts: string[] = [];
  if (
    guidance.suggestedLeanDose != null &&
    guidance.considerMinDose !== guidance.considerMaxDose
  ) {
    parts.push(`Lean ${guidance.suggestedLeanDose}u`);
  }
  if (guidance.bgNote) parts.push(guidance.bgNote);
  return parts.length > 0 ? parts.join(" · ") : null;
}

export function formatAlcoholDoseRange(guidance: AlcoholDoseGuidance): string {
  if (guidance.standardDose <= 0) return "—";
  if (guidance.considerMinDose === guidance.considerMaxDose) {
    return `${guidance.considerMaxDose}u`;
  }
  return `${guidance.considerMinDose}–${guidance.considerMaxDose}u`;
}

export type AlcoholNightModeScheduleItem = {
  kind: "bedtime_check" | "overnight_check" | "morning_review";
  label: string;
  atIso: string;
};

/** Mirrors `storage.activateAlcoholMode` reminder schedule for UI copy. */
export function buildAlcoholNightModeSchedule(
  intensity: AlcoholIntensity,
  plannedBedtimeIso: string,
): AlcoholNightModeScheduleItem[] {
  const bedtime = new Date(plannedBedtimeIso);
  const safeBedtimeIso = Number.isNaN(bedtime.getTime()) ? new Date().toISOString() : bedtime.toISOString();

  const items: AlcoholNightModeScheduleItem[] = [
    {
      kind: "bedtime_check",
      label: "Bedtime glucose check",
      atIso: safeBedtimeIso,
    },
  ];

  if (intensity !== "light") {
    items.push({
      kind: "overnight_check",
      label: "Overnight recheck",
      atIso: new Date(new Date(safeBedtimeIso).getTime() + 2 * 60 * 60 * 1000).toISOString(),
    });
  }

  const morning = new Date(safeBedtimeIso);
  morning.setDate(morning.getDate() + 1);
  morning.setHours(10, 0, 0, 0);
  items.push({
    kind: "morning_review",
    label: "Morning review",
    atIso: morning.toISOString(),
  });

  return items;
}

export function formatNightModeTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" });
}

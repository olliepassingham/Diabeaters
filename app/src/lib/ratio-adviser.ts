import type { BgUnits } from "@/lib/cgm/types";
import { roundInsulinUnits } from "@/lib/insulin-rounding";
import {
  formatRatioForDisplay,
  formatRatioForStorage,
  parseRatioToGramsPerUnit,
} from "@/lib/ratio-utils";
import type { RatioFormat } from "@/lib/storage";

/** Clinic-style illustration: about 20% fewer or more grams per unit. */
export const RATIO_STEP_FRACTION = 0.2;
const MIN_GRAMS_PER_UNIT = 1;
const MAX_GRAMS_PER_UNIT = 150;

export type LaterBgVerdict = "held" | "high" | "low";

export type MealRatioCheck = {
  gramsPerUnit: number;
  carbBolusExact: number;
  /** Positive adds insulin. Negative reduces the meal dose. Zero inside range, or when ISF is missing. */
  correctionExact: number;
  totalExact: number;
  totalRounded: number;
  /** Null when ISF is not set — a landing needs it. */
  expectedLanding: number | null;
};

export type RatioStepIllustration = {
  gramsPerUnit: number;
  storageRatio: string;
  ratioLabel: string;
  carbBolusExact: number;
  carbBolusRounded: number;
  currentCarbBolusExact: number;
  currentCarbBolusRounded: number;
};

function roundBg(value: number, units: BgUnits): number {
  return units === "mg/dL" ? Math.round(value) : Math.round(value * 10) / 10;
}

function clampGrams(grams: number): number {
  return Math.min(MAX_GRAMS_PER_UNIT, Math.max(MIN_GRAMS_PER_UNIT, grams));
}

/**
 * What the saved ratio does for this meal.
 * Correction applies only outside the target, and only when ISF is set.
 * The rounded total uses the same increment rounding as the meal planner.
 */
export function assessMealRatio(input: {
  carbs: number;
  currentBg: number;
  ratio: string | undefined;
  correctionFactor: number | null | undefined;
  targetLow: number;
  targetHigh: number;
  bgUnits: BgUnits;
  roundIncrement: number;
}): MealRatioCheck | null {
  const gramsPerUnit = parseRatioToGramsPerUnit(input.ratio);
  if (gramsPerUnit == null || gramsPerUnit <= 0) return null;
  if (!Number.isFinite(input.carbs) || input.carbs <= 0) return null;
  if (!Number.isFinite(input.currentBg) || input.currentBg <= 0) return null;
  if (!Number.isFinite(input.targetLow) || !Number.isFinite(input.targetHigh) || input.targetHigh < input.targetLow) {
    return null;
  }

  const carbBolusExact = input.carbs / gramsPerUnit;
  const isf = input.correctionFactor;
  const hasIsf = isf != null && Number.isFinite(isf) && isf > 0;

  let correctionExact = 0;
  if (hasIsf && input.currentBg > input.targetHigh) {
    correctionExact = (input.currentBg - input.targetHigh) / isf;
  } else if (hasIsf && input.currentBg < input.targetLow) {
    correctionExact = (input.currentBg - input.targetLow) / isf;
  }

  const totalExact = Math.max(0, carbBolusExact + correctionExact);
  const totalRounded = roundInsulinUnits(totalExact, input.roundIncrement);

  let expectedLanding: number | null = null;
  if (hasIsf) {
    const carbRaise = (input.carbs / gramsPerUnit) * isf;
    const insulinDrop = totalRounded * isf;
    expectedLanding = roundBg(input.currentBg + carbRaise - insulinDrop, input.bgUnits);
  }

  return {
    gramsPerUnit,
    carbBolusExact,
    correctionExact,
    totalExact,
    totalRounded,
    expectedLanding,
  };
}

export function compareLaterBg(laterBg: number, targetLow: number, targetHigh: number): LaterBgVerdict | null {
  if (!Number.isFinite(laterBg) || laterBg <= 0) return null;
  if (!Number.isFinite(targetLow) || !Number.isFinite(targetHigh) || targetHigh < targetLow) return null;
  if (laterBg > targetHigh) return "high";
  if (laterBg < targetLow) return "low";
  return "held";
}

/**
 * One readable step. Tighten means fewer grams per unit (more insulin for the same carbs).
 * Returns null when the ratio cannot move further.
 */
export function illustrateRatioStep(input: {
  gramsPerUnit: number;
  direction: "tighten" | "loosen";
  carbs: number;
  roundIncrement: number;
  ratioFormat: RatioFormat;
  carbPortionSize?: number;
}): RatioStepIllustration | null {
  if (!Number.isFinite(input.gramsPerUnit) || input.gramsPerUnit <= 0) return null;
  if (!Number.isFinite(input.carbs) || input.carbs <= 0) return null;

  const factor = input.direction === "tighten" ? 1 - RATIO_STEP_FRACTION : 1 + RATIO_STEP_FRACTION;
  let snapped = Math.round(input.gramsPerUnit * factor);
  const currentWhole = Math.round(input.gramsPerUnit);
  if (snapped === currentWhole) {
    snapped += input.direction === "tighten" ? -1 : 1;
  }
  snapped = clampGrams(snapped);
  if (Math.abs(snapped - input.gramsPerUnit) < 0.05) return null;

  const currentCarbBolusExact = input.carbs / input.gramsPerUnit;
  const carbBolusExact = input.carbs / snapped;
  return {
    gramsPerUnit: snapped,
    storageRatio: formatRatioForStorage(snapped),
    ratioLabel: formatRatioForDisplay(snapped, input.ratioFormat, input.carbPortionSize),
    carbBolusExact,
    carbBolusRounded: roundInsulinUnits(carbBolusExact, input.roundIncrement),
    currentCarbBolusExact,
    currentCarbBolusRounded: roundInsulinUnits(currentCarbBolusExact, input.roundIncrement),
  };
}

import type { UserSettings } from "@/lib/storage";
import { PEN_INSULIN_INCREMENT, roundInsulinUnits } from "@/lib/insulin-rounding";

/** BG display units as used in profile / ratios. */
export type BgUnits = "mmol/L" | "mg/dL";

export type SimpleCorrectionDoseResult =
  | { status: "invalid_isf" }
  | {
      status: "no_correction_needed";
      currentBg: number;
      targetBg: number;
      diff: number;
      correctionFactor: number;
      bgUnits: BgUnits;
    }
  | {
      status: "dose";
      /** Standard (full) correction dose, rounded to the delivery increment. */
      fullDoseRounded: number;
      /** Unrounded (BG − target) / ISF, before IOB or increment rounding. */
      exactDose: number;
      diff: number;
      currentBg: number;
      targetBg: number;
      correctionFactor: number;
      bgUnits: BgUnits;
    };

/**
 * Standard correction: (current BG − target BG) / correction factor (ISF).
 * All BG values must already be in the user's display units (same convention as Bedtime).
 */
export function computeSimpleCorrectionDose(params: {
  currentBg: number;
  targetBg: number;
  correctionFactor: number;
  bgUnits: BgUnits;
  roundIncrement?: number;
}): SimpleCorrectionDoseResult {
  const { currentBg, targetBg, correctionFactor, bgUnits, roundIncrement = PEN_INSULIN_INCREMENT } = params;
  if (!Number.isFinite(correctionFactor) || correctionFactor <= 0) {
    return { status: "invalid_isf" };
  }
  if (!Number.isFinite(currentBg) || !Number.isFinite(targetBg)) {
    return { status: "invalid_isf" };
  }
  const diff = currentBg - targetBg;
  if (diff <= 0) {
    return {
      status: "no_correction_needed",
      currentBg,
      targetBg,
      diff,
      correctionFactor,
      bgUnits,
    };
  }
  const exactDose = diff / correctionFactor;
  const fullDoseRounded = roundInsulinUnits(exactDose, roundIncrement);
  return {
    status: "dose",
    fullDoseRounded,
    exactDose,
    diff,
    currentBg,
    targetBg,
    correctionFactor,
    bgUnits,
  };
}

/** Upper end of target range for correction (same default as Bedtime when settings omit targets). */
export function getDefaultCorrectionTargetHigh(
  settings: Pick<UserSettings, "targetBgHigh">,
  bgUnits: BgUnits,
): number {
  if (settings.targetBgHigh != null && Number.isFinite(settings.targetBgHigh)) {
    return settings.targetBgHigh;
  }
  return bgUnits === "mg/dL" ? 144 : 8.0;
}

import type { UserSettings } from "@/lib/storage";
import { calculateDoseFromCarbs } from "@/lib/ratio-utils";

export function roundToHalf(value: number): number {
  return Math.round(value * 2) / 2;
}

export function getRoundingAdvice(exactDose: number, roundedDose: number, bgUnits: string): string {
  const diff = exactDose - roundedDose;
  if (Math.abs(diff) < 0.05) return "";

  const roundedDown = Math.floor(exactDose * 2) / 2;
  const roundedUp = Math.ceil(exactDose * 2) / 2;

  if (roundedDown === roundedUp) return "";

  const lowLabel = bgUnits === "mmol/L" ? "below 5" : "below 90";
  const highLabel = bgUnits === "mmol/L" ? "above 10" : "above 180";
  const midLabel = bgUnits === "mmol/L" ? "5-10" : "90-180";

  return (
    `Exact: ${exactDose.toFixed(1)}u. ` +
    `Round down to ${roundedDown}u if BG is ${lowLabel} ${bgUnits} or trending down. ` +
    `Round up to ${roundedUp}u if BG is ${highLabel} ${bgUnits} or trending up. ` +
    `Use ${roundedDose}u if BG is steady at ${midLabel} ${bgUnits}.`
  );
}

export type MealDoseResult = {
  carbs: number;
  mealType: string;
  dose: number;
  exactDose: number;
  roundingAdvice: string;
  exerciseContext?: "before" | "after" | "during";
  exerciseReduction?: number;
  standardDose?: number;
  tips?: string[];
  error?: string;
};

export function calculateMealDose(
  carbs: number,
  mealType: string,
  settings: UserSettings,
  bgUnits: string,
  exerciseContext?: "before" | "after" | "during",
  hoursAway?: number,
): MealDoseResult {
  const ratioMap: Record<string, string | undefined> = {
    breakfast: settings.breakfastRatio,
    lunch: settings.lunchRatio,
    dinner: settings.dinnerRatio,
    snack: settings.snackRatio,
    meal: settings.lunchRatio || settings.breakfastRatio,
  };

  const ratio = ratioMap[mealType];
  let exactBaseUnits = 0;

  if (ratio) {
    exactBaseUnits = calculateDoseFromCarbs(carbs, ratio);
  } else if (settings.tdd) {
    const estimatedRatio = Math.round(500 / settings.tdd);
    exactBaseUnits = carbs / estimatedRatio;
  }

  if (exactBaseUnits <= 0) {
    return { carbs, mealType, dose: 0, exactDose: 0, roundingAdvice: "", error: "no_ratios" };
  }

  if (!exerciseContext) {
    const rounded = roundToHalf(exactBaseUnits);
    return {
      carbs,
      mealType,
      dose: rounded,
      exactDose: Math.round(exactBaseUnits * 10) / 10,
      roundingAdvice: getRoundingAdvice(exactBaseUnits, rounded, bgUnits),
    };
  }

  const hours = hoursAway || 2;

  if (exerciseContext === "during") {
    return {
      carbs,
      mealType,
      dose: 0,
      exactDose: 0,
      roundingAdvice: "",
      exerciseContext,
      standardDose: roundToHalf(exactBaseUnits),
      tips: [
        "Carbs during exercise are usually used immediately by working muscles",
        "For sessions under 90 min: skip insulin for exercise snacks/gels",
        "For 90+ min sessions: may need 10-25% of normal dose",
        "Use fast-acting carbs (15-30g every 30-45 min)",
      ],
    };
  }

  const reductionPercent =
    exerciseContext === "before"
      ? hours <= 1
        ? 40
        : hours <= 2
          ? 30
          : 20
      : hours <= 1
        ? 35
        : hours <= 2
          ? 25
          : 15;

  const adjustedExact = exactBaseUnits * (1 - reductionPercent / 100);
  const rounded = roundToHalf(adjustedExact);
  const stdDose = roundToHalf(exactBaseUnits);

  const tips =
    exerciseContext === "before"
      ? [
          `Start exercise with BG ${bgUnits === "mmol/L" ? "7-10" : "126-180"} ${bgUnits}`,
          "Consider slower-digesting carbs (whole grains, protein)",
          "Check BG before starting exercise",
        ]
      : [
          "Include protein to help muscle recovery",
          "Monitor for delayed lows over next 6-12 hours",
          "Consider a bedtime snack if exercised in the evening",
        ];

  return {
    carbs,
    mealType,
    dose: rounded,
    exactDose: Math.round(adjustedExact * 10) / 10,
    roundingAdvice: getRoundingAdvice(adjustedExact, rounded, bgUnits),
    exerciseContext,
    exerciseReduction: reductionPercent,
    standardDose: stdDose,
    tips,
  };
}

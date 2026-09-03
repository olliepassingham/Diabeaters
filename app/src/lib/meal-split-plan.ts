import { calculateSplitDose, type SplitDoseResult, type SplitFatTier } from "@/lib/meal-dose";
import { formatRatioForDisplay, parseRatioToGramsPerUnit } from "@/lib/ratio-utils";
import { getEffectiveTdd } from "@/lib/tdd";
import type { RatioFormat, UserSettings } from "@/lib/storage";
import { ageInWholeYearsUtc } from "@/lib/user-age";

export type MealSplitPlan = SplitDoseResult & {
  carbsGrams: number;
  mealTime: string;
  fatTier: SplitFatTier;
  ratioUsed: string;
};

export type MealSplitPlanError = "invalid_carbs" | "no_ratio" | "under18_no_tdd";

type SplitPlanInput = {
  carbsGrams: number;
  mealTime: "breakfast" | "lunch" | "dinner" | "snack";
  fatTier: SplitFatTier;
  settings: UserSettings;
  ratioFormat: RatioFormat;
  carbPortionSize?: number;
  roundIncrement: number;
  dateOfBirth?: string;
};

function mealRatio(settings: UserSettings, mealTime: SplitPlanInput["mealTime"]): string | undefined {
  const ratioMap: Record<SplitPlanInput["mealTime"], string | undefined> = {
    breakfast: settings.breakfastRatio,
    lunch: settings.lunchRatio,
    dinner: settings.dinnerRatio,
    snack: settings.snackRatio || settings.lunchRatio,
  };
  return ratioMap[mealTime];
}

export function computeMealSplitPlanFromDose(args: {
  exactDose: number;
  carbsGrams: number;
  mealTime: string;
  fatTier: SplitFatTier;
  roundIncrement: number;
  ratioUsed?: string;
}): MealSplitPlan | { error: "invalid_carbs" } {
  if (!Number.isFinite(args.carbsGrams) || args.carbsGrams <= 0) return { error: "invalid_carbs" };
  if (!Number.isFinite(args.exactDose) || args.exactDose <= 0) return { error: "invalid_carbs" };
  const split = calculateSplitDose(args.exactDose, args.fatTier, args.roundIncrement);
  return {
    ...split,
    carbsGrams: args.carbsGrams,
    mealTime: args.mealTime,
    fatTier: args.fatTier,
    ratioUsed: args.ratioUsed ?? "From your meal dose suggestion",
  };
}

export function computeMealSplitPlanFromCarbs(
  input: SplitPlanInput,
): { plan: MealSplitPlan } | { error: MealSplitPlanError } {
  const carbsGrams = Number(input.carbsGrams);
  if (!Number.isFinite(carbsGrams) || carbsGrams <= 0) return { error: "invalid_carbs" };

  const selectedRatio = mealRatio(input.settings, input.mealTime);
  let totalUnits = 0;
  let ratioUsed = "";

  if (selectedRatio) {
    const gpu = parseRatioToGramsPerUnit(selectedRatio);
    if (gpu && gpu > 0) {
      totalUnits = Math.round((carbsGrams / gpu) * 10) / 10;
      ratioUsed = `Using your ${input.mealTime} ratio (${formatRatioForDisplay(gpu, input.ratioFormat, input.carbPortionSize)})`;
    }
  } else {
    const effectiveTdd = getEffectiveTdd(input.settings);
    if (!effectiveTdd) return { error: "no_ratio" };
    const ageYears = ageInWholeYearsUtc(input.dateOfBirth);
    if (ageYears !== null && ageYears < 18) return { error: "under18_no_tdd" };
    const estimatedRatio = Math.round(500 / effectiveTdd);
    totalUnits = Math.round((carbsGrams / estimatedRatio) * 10) / 10;
    ratioUsed = `Estimated from TDD (${formatRatioForDisplay(estimatedRatio, input.ratioFormat, input.carbPortionSize)})`;
  }

  if (totalUnits <= 0) return { error: "no_ratio" };

  return {
    plan: {
      ...calculateSplitDose(totalUnits, input.fatTier, input.roundIncrement),
      carbsGrams,
      mealTime: input.mealTime,
      fatTier: input.fatTier,
      ratioUsed,
    },
  };
}

export function splitSecondDoseClockLabel(delayHours: number, now = new Date()): string {
  const later = new Date(now.getTime() + delayHours * 60 * 60 * 1000);
  return later.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
}

export const SPLIT_FAT_OPTIONS: Array<{
  value: SplitFatTier;
  label: string;
  examples: string;
  ratio: string;
}> = [
  { value: "low", label: "Lower fat", examples: "Pasta, rice", ratio: "70/30" },
  { value: "medium", label: "Medium", examples: "Burgers, curry", ratio: "60/40" },
  { value: "high", label: "High fat", examples: "Pizza, chips", ratio: "50/50" },
];

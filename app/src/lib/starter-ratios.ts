import { formatRatioForDisplay, formatRatioForStorage } from "@/lib/ratio-utils";
import { storage, type RatioFormat, type UserSettings } from "@/lib/storage";

/**
 * Soft clinic-style starting ICRs (grams carb per 1 unit): classic 1u:10g for every meal.
 * Never auto-written; only applied on explicit user action.
 */
export const STARTER_ICR_GRAMS_PER_UNIT = {
  breakfast: 10,
  lunch: 10,
  dinner: 10,
  snack: 10,
} as const;

export type StarterMealKey = keyof typeof STARTER_ICR_GRAMS_PER_UNIT;

export const STARTER_ICR_MEALS: { key: StarterMealKey; label: string }[] = [
  { key: "breakfast", label: "Breakfast" },
  { key: "lunch", label: "Lunch" },
  { key: "dinner", label: "Dinner" },
  { key: "snack", label: "Snack" },
];

export function starterRatioStorageValues(): Pick<
  UserSettings,
  "breakfastRatio" | "lunchRatio" | "dinnerRatio" | "snackRatio"
> {
  return {
    breakfastRatio: formatRatioForStorage(STARTER_ICR_GRAMS_PER_UNIT.breakfast),
    lunchRatio: formatRatioForStorage(STARTER_ICR_GRAMS_PER_UNIT.lunch),
    dinnerRatio: formatRatioForStorage(STARTER_ICR_GRAMS_PER_UNIT.dinner),
    snackRatio: formatRatioForStorage(STARTER_ICR_GRAMS_PER_UNIT.snack),
  };
}

/** Display strings for the empty-home suggestion row. */
export function starterRatioDisplayValues(
  ratioFormat: RatioFormat = "per10g",
  cpSize?: number,
): Record<StarterMealKey, string> {
  return {
    breakfast: formatRatioForDisplay(STARTER_ICR_GRAMS_PER_UNIT.breakfast, ratioFormat, cpSize),
    lunch: formatRatioForDisplay(STARTER_ICR_GRAMS_PER_UNIT.lunch, ratioFormat, cpSize),
    dinner: formatRatioForDisplay(STARTER_ICR_GRAMS_PER_UNIT.dinner, ratioFormat, cpSize),
    snack: formatRatioForDisplay(STARTER_ICR_GRAMS_PER_UNIT.snack, ratioFormat, cpSize),
  };
}

/** Persist starter ICRs into settings. Caller must only invoke after an explicit tap. */
export function applyStarterRatios(existing?: UserSettings): UserSettings {
  const base = existing ?? storage.getSettings();
  const next: UserSettings = {
    ...base,
    ...starterRatioStorageValues(),
  };
  storage.saveSettings(next);
  return next;
}

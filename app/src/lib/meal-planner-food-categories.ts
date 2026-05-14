/**
 * Quick Meal Planner: food-type labels and absorption hints for the carb/absorption
 * preview — not dose logic (see meal-dose.ts).
 */

export type MealFoodType =
  | "balanced"
  | "quick_refined"
  | "high_fat_protein"
  | "liquid_sugars"
  | "fruit"
  | "starchy"
  | "unsure";

export const MEAL_FOOD_TYPE_OPTIONS: { value: MealFoodType; label: string }[] = [
  { value: "balanced", label: "Balanced (carb + protein + veg)" },
  { value: "quick_refined", label: "Quick / refined carbs (bread, cereal, sweets)" },
  { value: "starchy", label: "Starchy (pasta, rice, potatoes)" },
  { value: "high_fat_protein", label: "Higher fat or protein (pizza, curry, fish & chips)" },
  { value: "liquid_sugars", label: "Sugary drink or juice" },
  { value: "fruit", label: "Mostly fruit" },
  { value: "unsure", label: "Not sure / mixed" },
];

/** Typical carb absorption pace for the selected food type — illustrative, not personal timing. */
export type MealAbsorptionVisual = {
  /** Short label shown on the bar, e.g. "~1–3 h" */
  timeLabel: string;
  /** 0 = fast (left), 1 = slow (right) on the Fast–Slow scale */
  slowScore: number;
};

export function getMealAbsorptionVisual(type: MealFoodType): MealAbsorptionVisual {
  switch (type) {
    case "liquid_sugars":
      return { timeLabel: "~15–45 min", slowScore: 0.05 };
    case "quick_refined":
      return { timeLabel: "~30–90 min", slowScore: 0.18 };
    case "fruit":
      return { timeLabel: "~30–120 min", slowScore: 0.28 };
    case "starchy":
      return { timeLabel: "~1–2 h", slowScore: 0.4 };
    case "balanced":
      return { timeLabel: "~1–3 h", slowScore: 0.48 };
    case "high_fat_protein":
      return { timeLabel: "~3–6 h+", slowScore: 0.88 };
    case "unsure":
    default:
      return { timeLabel: "~1–2 h", slowScore: 0.5 };
  }
}

export function mealFoodTypeLabel(type: MealFoodType): string {
  return MEAL_FOOD_TYPE_OPTIONS.find((o) => o.value === type)?.label ?? type;
}

/** Split dose calculator fat tier — drives absorption bar only, not the split math. */
export type SplitFatLevel = "low" | "medium" | "high";

export function getSplitFatAbsorptionVisual(level: SplitFatLevel): MealAbsorptionVisual {
  switch (level) {
    case "low":
      return { timeLabel: "~1–2 h", slowScore: 0.36 };
    case "medium":
      return { timeLabel: "~2–4 h", slowScore: 0.58 };
    case "high":
      return { timeLabel: "~3–6 h+", slowScore: 0.9 };
    default:
      return { timeLabel: "~2–4 h", slowScore: 0.58 };
  }
}

export function splitFatLevelShortLabel(level: SplitFatLevel): string {
  switch (level) {
    case "low":
      return "Low fat";
    case "medium":
      return "Medium fat";
    case "high":
      return "High fat";
    default:
      return "Medium fat";
  }
}

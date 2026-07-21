/**
 * Split dose calculator: absorption hints for the carb/absorption preview — not
 * dose logic (see meal-dose.ts). The main Quick Meal Planner's food description
 * now drives the richer meal impact predictor in `meal-impact.ts` instead.
 */

/** Typical carb absorption pace for the selected food type — illustrative, not personal timing. */
export type MealAbsorptionVisual = {
  /** Short label shown on the bar, e.g. "~1–3 h" */
  timeLabel: string;
  /** 0 = fast (left), 1 = slow (right) on the Fast–Slow scale */
  slowScore: number;
};

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

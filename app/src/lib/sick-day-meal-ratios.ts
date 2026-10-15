export type SickDayMealSeverity = "minor" | "moderate" | "severe";

/**
 * Meal-insulin increase used by the sick-day guide.
 * Minor 10%, moderate 20%, severe 30%.
 * `gramsPerUnitFactor` is 1 / multiplier so a usual ratio displays the same number everywhere.
 * An empty severity is treated as moderate. Older saves used "mild" for minor.
 */
export function sickDayMealRatioAdjustment(severity?: string | null): {
  severity: SickDayMealSeverity;
  multiplier: number;
  gramsPerUnitFactor: number;
} {
  const raw = (severity || "moderate").trim().toLowerCase();
  if (raw === "severe") {
    return { severity: "severe", multiplier: 1.3, gramsPerUnitFactor: 1 / 1.3 };
  }
  if (raw === "minor" || raw === "mild") {
    return { severity: "minor", multiplier: 1.1, gramsPerUnitFactor: 1 / 1.1 };
  }
  return { severity: "moderate", multiplier: 1.2, gramsPerUnitFactor: 1 / 1.2 };
}

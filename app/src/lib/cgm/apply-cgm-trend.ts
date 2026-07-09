import type { AlcoholTrend } from "@/lib/alcohol-night-tool";
import type { DrivingTrend } from "@/lib/driving-readiness-tool";
import type { ExerciseBgTrend } from "@/lib/storage";

function usableCgmTrend(trend: ExerciseBgTrend | null | undefined): ExerciseBgTrend | undefined {
  if (!trend || trend === "not_sure") return undefined;
  return trend;
}

export function cgmTrendForExercise(trend: ExerciseBgTrend | null | undefined): ExerciseBgTrend | undefined {
  return usableCgmTrend(trend);
}

export function cgmTrendForDriving(trend: ExerciseBgTrend | null | undefined): DrivingTrend | undefined {
  return usableCgmTrend(trend);
}

export function cgmTrendForAlcohol(trend: ExerciseBgTrend | null | undefined): AlcoholTrend | undefined {
  return usableCgmTrend(trend);
}

export function cgmTrendForBedtime(
  trend: ExerciseBgTrend | null | undefined,
): "rising" | "steady" | "falling" | undefined {
  const t = usableCgmTrend(trend);
  if (!t) return undefined;
  if (t === "flat") return "steady";
  return t;
}

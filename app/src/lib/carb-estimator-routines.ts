import { storage, type Routine, type RoutineMealType } from "@/lib/storage";

export const ROUTINE_MEAL_TYPE_LABELS: Record<RoutineMealType, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
  other: "Other",
};

/** Meal routines with a usable carb estimate, newest / most-used first. */
export function listMealRoutinesForCarbEstimator(opts?: {
  query?: string;
  limit?: number;
}): Routine[] {
  const query = opts?.query?.trim().toLowerCase() ?? "";
  const limit = opts?.limit ?? 20;
  try {
    return storage
      .getRoutines()
      .filter((routine) => {
        const carbs = Number(routine.carbEstimate);
        return Number.isFinite(carbs) && carbs > 0;
      })
      .filter((routine) => {
        if (!query) return true;
        const haystack = `${routine.name} ${routine.mealDescription} ${ROUTINE_MEAL_TYPE_LABELS[routine.mealType]}`.toLowerCase();
        return haystack.includes(query);
      })
      .sort((a, b) => {
        const recent =
          new Date(b.lastUsed ?? 0).getTime() - new Date(a.lastUsed ?? 0).getTime();
        return recent || b.timesUsed - a.timesUsed || a.name.localeCompare(b.name);
      })
      .slice(0, limit);
  } catch {
    return [];
  }
}

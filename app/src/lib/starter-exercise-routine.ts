import { storage, type ExerciseRoutine } from "@/lib/storage";

/** Stable id so the home widget can badge the example and we never re-create after delete. */
export const STARTER_EXERCISE_ROUTINE_ID = "starter-example-moderate-run";

export const STARTER_EXERCISE_SEEDED_KEY = "diabeaters_starter_exercise_seeded_v1";

export const STARTER_EXERCISE_ROUTINE = {
  id: STARTER_EXERCISE_ROUTINE_ID,
  name: "5km Run",
  exerciseType: "cardio" as const,
  intensity: "moderate" as const,
  durationMinutes: 30,
  notes: "Starter example — edit or delete anytime. Not a training plan.",
};

export function isStarterExerciseRoutine(
  routine: Pick<ExerciseRoutine, "id"> | null | undefined,
): boolean {
  return routine?.id === STARTER_EXERCISE_ROUTINE_ID;
}

export function hasStarterExerciseBeenSeeded(): boolean {
  try {
    return localStorage.getItem(STARTER_EXERCISE_SEEDED_KEY) === "1";
  } catch {
    return true;
  }
}

function markStarterExerciseSeeded(): void {
  try {
    localStorage.setItem(STARTER_EXERCISE_SEEDED_KEY, "1");
  } catch {
    // ignore quota / private mode
  }
}

/**
 * Add one labeled example workout when the user has no exercise routines yet.
 * Marks a local flag so deleting the example does not bring it back.
 * Also renames an existing starter if the canonical title changed.
 */
export function seedStarterExerciseRoutineIfNeeded(): {
  seeded: boolean;
  routine: ExerciseRoutine | null;
} {
  const existingStarter = storage.getExerciseRoutine(STARTER_EXERCISE_ROUTINE_ID);
  if (existingStarter && existingStarter.name !== STARTER_EXERCISE_ROUTINE.name) {
    storage.updateExerciseRoutine(STARTER_EXERCISE_ROUTINE_ID, {
      name: STARTER_EXERCISE_ROUTINE.name,
    });
  }

  if (hasStarterExerciseBeenSeeded()) {
    return { seeded: false, routine: null };
  }

  const existing = storage.getExerciseRoutines();
  if (existing.length > 0) {
    markStarterExerciseSeeded();
    return { seeded: false, routine: null };
  }

  if (storage.getExerciseRoutine(STARTER_EXERCISE_ROUTINE_ID)) {
    markStarterExerciseSeeded();
    return { seeded: false, routine: null };
  }

  const routine = storage.addExerciseRoutine(STARTER_EXERCISE_ROUTINE);
  markStarterExerciseSeeded();
  return { seeded: true, routine };
}

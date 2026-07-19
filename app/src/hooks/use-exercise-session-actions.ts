import { useCallback } from "react";

import { storage, type ActiveExerciseSession } from "@/lib/storage";
import {
  cancelExerciseActiveReminders,
  cancelExerciseReminders,
  scheduleExerciseActiveReminders,
  scheduleExerciseRecoveryReminder,
} from "@/lib/exercise-reminders";
import { resetExerciseCgmAlertCooldown } from "@/lib/exercise-cgm-alerts";

export type ExerciseSessionActions = {
  /** Pre → Active. Schedules mid/finish/recovery reminders anchored to the real start time. */
  startWorkout: () => ActiveExerciseSession | null;
  /** Active → Recovery. Cancels the now-irrelevant active reminders and re-anchors the recovery check to the real end time. */
  finishWorkout: () => ActiveExerciseSession | null;
  /** Ends the session entirely — cancels every pending reminder and clears the CGM alert cooldown. */
  endSession: () => void;
};

/**
 * Single source of truth for the exercise session's start/finish/end transitions.
 *
 * Previously the status strip, the guided coach, and the auto-finish timer each had
 * their own copy of this logic, and it was easy for one copy to forget a step (the
 * strip's "End" never cancelled reminders; finishing cancelled the recovery reminder
 * instead of re-anchoring it). Routing every surface through this hook means a fix
 * here fixes it everywhere.
 */
export function useExerciseSessionActions(): ExerciseSessionActions {
  const startWorkout = useCallback((): ActiveExerciseSession | null => {
    const current = storage.getActiveExercise();
    if (!current || current.phase !== "pre") return current ?? null;
    storage.startExercisePhase();
    const updated = storage.getActiveExercise();
    if (updated) void scheduleExerciseActiveReminders(updated);
    return updated;
  }, []);

  const finishWorkout = useCallback((): ActiveExerciseSession | null => {
    const current = storage.getActiveExercise();
    if (!current || current.phase !== "active") return current ?? null;
    const endedAtMs = Date.now();
    void cancelExerciseActiveReminders(current.id);
    storage.finishExercisePhase();
    const updated = storage.getActiveExercise();
    if (updated) {
      void scheduleExerciseRecoveryReminder(updated, endedAtMs, updated.bedtimeInHours ?? null);
    }
    return updated;
  }, []);

  const endSession = useCallback((): void => {
    const current = storage.getActiveExercise();
    if (current) {
      void cancelExerciseReminders(current.id);
      resetExerciseCgmAlertCooldown(current.id);
    }
    storage.endExerciseSession();
  }, []);

  return { startWorkout, finishWorkout, endSession };
}

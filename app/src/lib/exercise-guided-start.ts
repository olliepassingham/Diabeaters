import type { ActiveExerciseSession, ExerciseIntensity, ExerciseType } from "@/lib/storage";
import { storage } from "@/lib/storage";

export type GuidedExerciseStartParams = {
  exerciseType: ExerciseType;
  intensity: ExerciseIntensity;
  durationMinutes: number;
  exerciseName?: string;
  routineId?: string;
};

export type GuidedExerciseStartBlockReason = "active_session" | "severe_sick_day" | "invalid_duration";

export type GuidedExerciseStartResult =
  | { ok: true; session: ActiveExerciseSession }
  | { ok: false; reason: GuidedExerciseStartBlockReason };

const EXERCISE_TYPE_LABELS: Record<string, string> = {
  cardio: "Cardio",
  strength: "Strength",
  hiit: "HIIT",
  yoga: "Yoga",
  walking: "Walking",
  court: "Court sport",
  field: "Field sport",
  swimming: "Swimming",
};

export function clampExerciseDurationMinutes(raw: number): number | null {
  if (!Number.isFinite(raw)) return null;
  const rounded = Math.round(raw);
  if (rounded < 5 || rounded > 300) return null;
  return rounded;
}

/** Stable prefs from the last finished session (not BG or meal context). */
export function applyCoachDefaultsFromLastExercise(session: ActiveExerciseSession): ActiveExerciseSession {
  const last = storage.getLastExerciseSummary?.();
  const ctx = last?.context;
  if (!ctx) return session;

  const updates: Partial<ActiveExerciseSession> = {};
  if (
    (!session.preEnvironments || session.preEnvironments.length === 0) &&
    ctx.environments &&
    ctx.environments.length > 0
  ) {
    updates.preEnvironments = [...ctx.environments];
  } else if (
    (!session.preEnvironments || session.preEnvironments.length === 0) &&
    ctx.environment
  ) {
    updates.preEnvironments = [ctx.environment];
  }
  if (session.preCompetitive == null && ctx.competitive != null) updates.preCompetitive = ctx.competitive;
  if (session.preFasted == null && ctx.fasted != null) updates.preFasted = ctx.fasted;
  if (session.preSleepHours == null && ctx.sleepHoursLastNight != null) {
    updates.preSleepHours = ctx.sleepHoursLastNight;
  }

  if (Object.keys(updates).length === 0) return session;
  return storage.updateActiveExercise(updates) ?? session;
}

export function startGuidedExerciseSession(params: GuidedExerciseStartParams): GuidedExerciseStartResult {
  if (storage.getActiveExercise()) {
    return { ok: false, reason: "active_session" };
  }

  const sc = storage.getScenarioState();
  if (sc.sickDayActive && sc.sickDaySeverity === "severe") {
    return { ok: false, reason: "severe_sick_day" };
  }

  const durationMinutes = clampExerciseDurationMinutes(params.durationMinutes);
  if (durationMinutes == null) {
    return { ok: false, reason: "invalid_duration" };
  }

  if (params.routineId) {
    storage.useExerciseRoutine(params.routineId);
  }

  const exerciseName =
    params.exerciseName?.trim() ||
    EXERCISE_TYPE_LABELS[params.exerciseType] ||
    "Exercise";

  const session = storage.startExerciseSession({
    routineId: params.routineId,
    exerciseName,
    exerciseType: params.exerciseType,
    intensity: params.intensity,
    durationMinutes,
  });
  const withDefaults = applyCoachDefaultsFromLastExercise(session);
  return { ok: true, session: withDefaults };
}

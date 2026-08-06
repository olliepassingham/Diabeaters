import type { ExerciseIntensity, ExerciseOutcome, ExerciseType, LastExerciseSummary } from "@/lib/storage";

export type RepeatableExerciseSession = {
  exerciseType: ExerciseType;
  intensity: ExerciseIntensity;
  durationMinutes: number;
  exerciseName?: string;
  /** Human label for buttons, e.g. "moderate cardio · 45 min". */
  label: string;
  source: "outcome" | "last_summary";
};

export type RecentRepeatableExerciseSession = RepeatableExerciseSession & {
  id: string;
  completedAt: string;
};

const EXERCISE_TYPE_LABELS: Record<string, string> = {
  cardio: "cardio",
  strength: "strength",
  hiit: "HIIT",
  yoga: "yoga",
  walking: "walking",
  court: "court sport",
  field: "field sport",
  swimming: "swimming",
};

function sessionLabel(
  intensity: ExerciseIntensity,
  exerciseType: ExerciseType,
  durationMinutes: number,
  exerciseName?: string,
): string {
  const typeLabel = EXERCISE_TYPE_LABELS[exerciseType] ?? exerciseType;
  const base = `${intensity} ${typeLabel} · ${durationMinutes} min`;
  if (exerciseName?.trim()) return `${exerciseName.trim()} · ${base}`;
  return base;
}

function fromOutcome(o: ExerciseOutcome): RepeatableExerciseSession {
  return {
    exerciseType: o.exerciseType,
    intensity: o.intensity,
    durationMinutes: o.durationMinutes,
    exerciseName: o.exerciseName,
    label: sessionLabel(o.intensity, o.exerciseType, o.durationMinutes, o.exerciseName),
    source: "outcome",
  };
}

function fromSummary(s: LastExerciseSummary): RepeatableExerciseSession {
  return {
    exerciseType: s.exerciseType,
    intensity: s.intensity,
    durationMinutes: s.durationMinutes,
    exerciseName: s.exerciseName,
    label: sessionLabel(s.intensity, s.exerciseType, s.durationMinutes, s.exerciseName),
    source: "last_summary",
  };
}

export function exerciseSessionSignature(
  session: Pick<RepeatableExerciseSession, "exerciseType" | "intensity" | "durationMinutes" | "exerciseName">,
): string {
  // Recents restart the last setup for a sport/activity family. Duration/intensity tweaks
  // (via Adjust) should not create duplicate rows for the same type.
  return session.exerciseType;
}

/**
 * Recent unique completed sessions for quick restart (one per exercise type, newest first).
 */
export function listRecentRepeatableExerciseSessions(input: {
  outcomes: ExerciseOutcome[];
  limit?: number;
}): RecentRepeatableExerciseSession[] {
  const limit = input.limit ?? 5;
  const sorted = [...input.outcomes].sort(
    (a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime(),
  );
  const seen = new Set<string>();
  const result: RecentRepeatableExerciseSession[] = [];

  for (const outcome of sorted) {
    const session = fromOutcome(outcome);
    const signature = exerciseSessionSignature(session);
    if (seen.has(signature)) continue;
    seen.add(signature);
    result.push({
      ...session,
      id: outcome.id,
      completedAt: outcome.completedAt,
    });
    if (result.length >= limit) break;
  }

  return result;
}

/**
 * Most recent finished session we can pre-fill on the exercise planner (no routines required).
 */
export function findLastRepeatableExerciseSession(input: {
  outcomes: ExerciseOutcome[];
  lastSummary: LastExerciseSummary | null;
}): RepeatableExerciseSession | null {
  const recent = listRecentRepeatableExerciseSessions({ outcomes: input.outcomes, limit: 1 });
  if (recent[0]) return recent[0];

  if (input.lastSummary?.exerciseType && input.lastSummary.durationMinutes > 0) {
    return fromSummary(input.lastSummary);
  }

  return null;
}

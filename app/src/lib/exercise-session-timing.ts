import type { ActiveExerciseSession } from "@/lib/storage";

/** Minimal fields needed to compute workout elapsed time (with pause support). */
export type ExerciseElapsedSession = Pick<
  ActiveExerciseSession,
  "exerciseStartedAt" | "pausedAt" | "totalPausedMs"
>;

export function isExercisePaused(
  session: Pick<ActiveExerciseSession, "phase" | "pausedAt"> | null | undefined,
): boolean {
  return Boolean(session && session.phase === "active" && session.pausedAt);
}

/**
 * Effective workout elapsed ms, excluding completed pauses and any current pause.
 * Falls back to wall-clock from `exerciseStartedAt` when pause fields are absent (legacy sessions).
 */
export function getWorkoutElapsedMs(session: ExerciseElapsedSession, nowMs = Date.now()): number {
  if (!session.exerciseStartedAt) return 0;
  const start = new Date(session.exerciseStartedAt).getTime();
  if (!Number.isFinite(start)) return 0;

  const completedPaused =
    typeof session.totalPausedMs === "number" && Number.isFinite(session.totalPausedMs)
      ? Math.max(0, session.totalPausedMs)
      : 0;

  let openPauseMs = 0;
  if (session.pausedAt) {
    const pausedAt = new Date(session.pausedAt).getTime();
    if (Number.isFinite(pausedAt) && pausedAt <= nowMs) {
      openPauseMs = Math.max(0, nowMs - pausedAt);
    }
  }

  return Math.max(0, nowMs - start - completedPaused - openPauseMs);
}

/** Remaining planned workout time (ms). 0 when at or past the planned duration. */
export function getWorkoutRemainingMs(
  session: ExerciseElapsedSession & Pick<ActiveExerciseSession, "durationMinutes">,
  nowMs = Date.now(),
): number {
  const total = Math.max(60_000, session.durationMinutes * 60_000);
  return Math.max(0, total - getWorkoutElapsedMs(session, nowMs));
}

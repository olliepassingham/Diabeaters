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

/** A leftover session older than this no longer blocks starting another workout. */
export const STALE_ACTIVE_EXERCISE_MS = 12 * 60 * 60 * 1000;

function timestampMs(iso: string | undefined): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
}

/** Planned end, including time already spent paused. Null when the workout never started. */
export function plannedWorkoutEndMs(
  session: Pick<ActiveExerciseSession, "exerciseStartedAt" | "durationMinutes" | "totalPausedMs">,
): number | null {
  const start = timestampMs(session.exerciseStartedAt);
  if (start == null) return null;
  const paused =
    typeof session.totalPausedMs === "number" && Number.isFinite(session.totalPausedMs)
      ? Math.max(0, session.totalPausedMs)
      : 0;
  const durationMs = Math.max(5, session.durationMinutes) * 60_000;
  return start + durationMs + paused;
}

/**
 * True when this stored session should not block a new workout.
 * Recovery is stale once its window has ended. A workout that was never started,
 * or one whose planned end (or pause) was more than 12 hours ago, is stale too.
 * A paused or in-progress workout inside that window is kept.
 */
export function isStaleActiveExerciseSession(
  session: Pick<
    ActiveExerciseSession,
    | "phase"
    | "startedAt"
    | "exerciseStartedAt"
    | "pausedAt"
    | "totalPausedMs"
    | "durationMinutes"
    | "recoveryEndsAt"
  >,
  now = Date.now(),
): boolean {
  if (session.phase === "recovery") {
    const end = timestampMs(session.recoveryEndsAt);
    if (end == null) return false;
    return now >= end;
  }
  if (session.phase === "active") {
    const plannedEnd = plannedWorkoutEndMs(session);
    if (plannedEnd == null) return true;
    const pausedAt = timestampMs(session.pausedAt);
    const quietSince = pausedAt != null ? Math.max(plannedEnd, pausedAt) : plannedEnd;
    return now >= quietSince + STALE_ACTIVE_EXERCISE_MS;
  }
  const opened = timestampMs(session.startedAt);
  if (opened == null) return true;
  return now >= opened + STALE_ACTIVE_EXERCISE_MS;
}

/** Remaining planned workout time (ms). 0 when at or past the planned duration. */
export function getWorkoutRemainingMs(
  session: ExerciseElapsedSession & Pick<ActiveExerciseSession, "durationMinutes">,
  nowMs = Date.now(),
): number {
  const total = Math.max(60_000, session.durationMinutes * 60_000);
  return Math.max(0, total - getWorkoutElapsedMs(session, nowMs));
}

import type { ActiveExerciseSession, ExerciseBgTrend, ExercisePhase } from "@/lib/storage";

/** Legacy `type=sports` links map to `field` after court/field split. */
export function normalizePlannerExerciseTypeQueryParam(type: string | null): string | null {
  if (type == null) return null;
  if (type === "sports") return "field";
  return type;
}

/** Match URL params to the current active exercise session (for planner hydration). */
export function activeSessionMatchesPlannerQuery(
  active: ActiveExerciseSession,
  type: string,
  duration: string,
  intensity: string,
  routineId: string | null,
): boolean {
  if (routineId && active.routineId && active.routineId === routineId) return true;
  const normalizedType = normalizePlannerExerciseTypeQueryParam(type) ?? type;
  return (
    active.exerciseType === normalizedType &&
    String(active.durationMinutes) === duration &&
    active.intensity === intensity
  );
}

/** BG to prefill in the planner from the active session for the current phase. */
export function bgForPlannerFromActiveSession(active: ActiveExerciseSession): number | null {
  if (active.phase === "pre" && active.preBg != null) return active.preBg;
  if (active.phase === "active" && active.midBg != null) return active.midBg;
  if (active.phase === "recovery" && active.recoveryBg != null) return active.recoveryBg;
  return null;
}

/** BG trend to prefill alongside {@link bgForPlannerFromActiveSession} when syncing from an active session. */
export function trendForPlannerFromActiveSession(active: ActiveExerciseSession): ExerciseBgTrend | null {
  if (active.phase === "pre" && active.preTrend) return active.preTrend;
  if (active.phase === "active" && active.midTrend) return active.midTrend;
  if (active.phase === "recovery" && active.recoveryTrend) return active.recoveryTrend;
  return null;
}

/** Map session phase query to ExercisePlanner result tabs. */
export function resultTabForExercisePhase(
  phase: string | null,
): "before" | "during" | "after" | "recovery" | null {
  if (phase === "pre") return "before";
  if (phase === "active") return "during";
  if (phase === "recovery") return "recovery";
  return null;
}

export type ExercisePlannerHrefParams = {
  exerciseType: string;
  durationMinutes: number;
  intensity: string;
  routineId?: string;
  /** When set, planner hydrates BG from matching active session */
  sync?: "active";
  phase?: ExercisePhase;
  from?: "widget";
};

/**
 * Single source of truth for `/scenarios/exercise` query links (widget, banner, etc.).
 */
export function buildExerciseScenarioPlannerHref(p: ExercisePlannerHrefParams): string {
  const q = new URLSearchParams();
  q.set("type", p.exerciseType);
  q.set("duration", String(p.durationMinutes));
  q.set("intensity", p.intensity);
  if (p.routineId) q.set("routineId", p.routineId);
  if (p.sync) q.set("sync", p.sync);
  if (p.phase) q.set("phase", p.phase);
  if (p.from) q.set("from", p.from);
  return `/scenarios/exercise?${q.toString()}`;
}

export function buildExerciseScenarioPlannerHrefFromSession(
  session: Pick<ActiveExerciseSession, "exerciseType" | "durationMinutes" | "intensity" | "routineId" | "phase">,
  options?: { syncActive?: boolean; from?: "widget" },
): string {
  return buildExerciseScenarioPlannerHref({
    exerciseType: session.exerciseType,
    durationMinutes: session.durationMinutes,
    intensity: session.intensity,
    routineId: session.routineId,
    sync: options?.syncActive ? "active" : undefined,
    phase: session.phase,
    from: options?.from,
  });
}

/**
 * Meal Adviser deep link with exercise-adjusted dose context (matches ExercisePlanner adviserHref).
 */
export function adviserMealExerciseHref(
  exerciseTiming: "before" | "after" | "during",
  exerciseWithinHours: number,
): string {
  const h = Math.max(0, Math.min(24, Math.round(exerciseWithinHours)));
  const params = new URLSearchParams();
  params.set("tab", "meal");
  params.set("exercise", "1");
  params.set("exerciseTiming", exerciseTiming);
  params.set("exerciseWithin", String(h));
  return `/adviser?${params.toString()}`;
}

/** Map active session phase to meal timing vs exercise. */
export function exerciseTimingForSessionPhase(phase: ExercisePhase): "before" | "after" | "during" {
  if (phase === "pre") return "before";
  if (phase === "active") return "during";
  return "after";
}

/**
 * Hours window for Meal Adviser exercise adjustment (matches ExercisePlanner-style defaults).
 */
export function adviserExerciseWithinHoursForSession(
  session: ActiveExerciseSession,
  nowMs: number = Date.now(),
): number {
  if (session.phase === "pre") {
    return 1;
  }
  if (session.phase === "active" && session.exerciseStartedAt) {
    const end =
      new Date(session.exerciseStartedAt).getTime() + session.durationMinutes * 60 * 1000;
    const leftMin = Math.max(0, (end - nowMs) / 60000);
    return Math.max(1, Math.ceil(leftMin / 60));
  }
  if (session.phase === "recovery" && session.recoveryEndsAt) {
    const end = new Date(session.recoveryEndsAt).getTime();
    const leftMin = Math.max(0, (end - nowMs) / 60000);
    return Math.max(1, Math.ceil(leftMin / 60));
  }
  return 2;
}

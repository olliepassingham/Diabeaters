/**
 * Programmatically open the full-screen "Exercise mode" overlay for the active workout.
 *
 * Event-based (same pattern as `hypo-check-in-respond-deep-link.ts`) so both the Exercise
 * page's active-session card and the global status strip can trigger it without prop-drilling.
 * There is no payload — the overlay reads the active session straight from `storage`.
 */
export const EXERCISE_MODE_OPEN_EVENT = "diabeaters:open-exercise-mode";

/** Expand the home status-strip exercise panel (Check) for the active session. */
export const EXERCISE_STRIP_EXPAND_EVENT = "diabeaters:expand-exercise-strip";

export function requestOpenExerciseMode(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(EXERCISE_MODE_OPEN_EVENT));
}

export function requestExpandExerciseStrip(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(EXERCISE_STRIP_EXPAND_EVENT));
}

/**
 * After Quick Exercise (or similar) starts a session on Home: bring the real exercise
 * tool into view — the expanded status strip, not a separate adjust sheet.
 */
export function revealHomeExerciseTool(): void {
  requestExpandExerciseStrip();
  if (typeof window === "undefined") return;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

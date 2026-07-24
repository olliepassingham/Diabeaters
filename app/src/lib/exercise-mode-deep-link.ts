/**
 * Programmatically open the full-screen "Exercise mode" overlay for the active workout.
 *
 * Event-based (same pattern as `hypo-check-in-respond-deep-link.ts`) so both the Exercise
 * page's active-session card and the global status strip can trigger it without prop-drilling.
 * There is no payload — the overlay reads the active session straight from `storage`.
 */
export const EXERCISE_MODE_OPEN_EVENT = "diabeaters:open-exercise-mode";

export function requestOpenExerciseMode(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(EXERCISE_MODE_OPEN_EVENT));
}

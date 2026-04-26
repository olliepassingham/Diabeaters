/**
 * Next medication reminder is anchored to the last scheduled due that fired (or is firing),
 * plus one or more repeat intervals — not to when the user taps "Taken".
 */
export function computeNextDueAfterReminderFired(
  firedDueIso: string,
  repeatEveryMinutes: number,
  nowMs: number,
): string {
  const dueMs = new Date(firedDueIso).getTime();
  const stepMs = Math.max(1, Math.round(repeatEveryMinutes)) * 60_000;
  if (!Number.isFinite(dueMs) || !Number.isFinite(stepMs) || stepMs <= 0) {
    return new Date(nowMs + Math.max(60_000, stepMs || 60_000)).toISOString();
  }
  let next = dueMs + stepMs;
  while (next <= nowMs) {
    next += stepMs;
  }
  return new Date(next).toISOString();
}

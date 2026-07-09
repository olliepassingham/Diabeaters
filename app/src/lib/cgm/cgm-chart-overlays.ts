import { computeBedtimeSleepWindow } from "@/lib/bedtime-overnight-window";
import type { ActiveExerciseSession, BedtimeLog, ExerciseOutcome } from "@/lib/storage";

export type CgmChartOverlayKind = "sleep" | "exercise";

export type CgmChartOverlay = {
  id: string;
  kind: CgmChartOverlayKind;
  startMs: number;
  endMs: number;
  label: string;
};

export function chartTimeWindowFromPoints(points: { timeMs: number }[]): { startMs: number; endMs: number } | null {
  if (points.length === 0) return null;
  return { startMs: points[0]!.timeMs, endMs: points[points.length - 1]!.timeMs };
}

export function intersectTimeInterval(
  startMs: number,
  endMs: number,
  windowStartMs: number,
  windowEndMs: number,
): { startMs: number; endMs: number } | null {
  const start = Math.max(startMs, windowStartMs);
  const end = Math.min(endMs, windowEndMs);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  return { startMs: start, endMs: end };
}

export function resolveSleepChartOverlays(input: {
  bedtimeLogs: BedtimeLog[];
  windowStartMs: number;
  windowEndMs: number;
}): CgmChartOverlay[] {
  const overlays: CgmChartOverlay[] = [];
  for (const log of input.bedtimeLogs) {
    const window = computeBedtimeSleepWindow(log);
    if (!window) continue;
    const clip = intersectTimeInterval(window.startMs, window.endMs, input.windowStartMs, input.windowEndMs);
    if (!clip) continue;
    overlays.push({
      id: `sleep-${log.id}`,
      kind: "sleep",
      startMs: clip.startMs,
      endMs: clip.endMs,
      label: "Estimated sleep",
    });
  }
  return overlays.sort((a, b) => a.startMs - b.startMs);
}

function exerciseWindowFromOutcome(outcome: ExerciseOutcome): { startMs: number; endMs: number } | null {
  const endMs = new Date(outcome.completedAt).getTime();
  if (!Number.isFinite(endMs)) return null;
  const minutes = Number.isFinite(outcome.durationMinutes) ? Math.max(1, outcome.durationMinutes) : 30;
  return { startMs: endMs - minutes * 60_000, endMs };
}

function exerciseWindowFromActive(session: ActiveExerciseSession, nowMs: number): { startMs: number; endMs: number } | null {
  const startMs = new Date(session.exerciseStartedAt ?? session.startedAt).getTime();
  if (!Number.isFinite(startMs)) return null;
  let endMs = nowMs;
  if (session.recoveryEndsAt) {
    const recoveryEnd = new Date(session.recoveryEndsAt).getTime();
    if (Number.isFinite(recoveryEnd)) endMs = recoveryEnd;
  } else if (session.exerciseEndedAt) {
    const exerciseEnd = new Date(session.exerciseEndedAt).getTime();
    if (Number.isFinite(exerciseEnd)) endMs = exerciseEnd;
  }
  if (endMs <= startMs) return null;
  return { startMs, endMs };
}

export function resolveExerciseChartOverlays(input: {
  outcomes: ExerciseOutcome[];
  activeSession: ActiveExerciseSession | null;
  windowStartMs: number;
  windowEndMs: number;
  nowMs?: number;
}): CgmChartOverlay[] {
  const nowMs = input.nowMs ?? Date.now();
  const overlays: CgmChartOverlay[] = [];
  const seen = new Set<string>();

  for (const outcome of input.outcomes) {
    const span = exerciseWindowFromOutcome(outcome);
    if (!span) continue;
    const clip = intersectTimeInterval(span.startMs, span.endMs, input.windowStartMs, input.windowEndMs);
    if (!clip) continue;
    const key = outcome.sessionId ?? outcome.id;
    if (seen.has(key)) continue;
    seen.add(key);
    const name = outcome.exerciseName?.trim() || "Exercise";
    overlays.push({
      id: `exercise-${outcome.id}`,
      kind: "exercise",
      startMs: clip.startMs,
      endMs: clip.endMs,
      label: name,
    });
  }

  if (input.activeSession) {
    const span = exerciseWindowFromActive(input.activeSession, nowMs);
    if (span) {
      const clip = intersectTimeInterval(span.startMs, span.endMs, input.windowStartMs, input.windowEndMs);
      if (clip && !seen.has(input.activeSession.id)) {
        overlays.push({
          id: `exercise-active-${input.activeSession.id}`,
          kind: "exercise",
          startMs: clip.startMs,
          endMs: clip.endMs,
          label: input.activeSession.exerciseName?.trim() || "Exercise (active)",
        });
      }
    }
  }

  return overlays.sort((a, b) => a.startMs - b.startMs);
}

export const CGM_CHART_OVERLAY_COLORS: Record<CgmChartOverlayKind, { fill: string; opacity: number }> = {
  sleep: { fill: "#6366f1", opacity: 0.16 },
  exercise: { fill: "#0ea5e9", opacity: 0.18 },
};

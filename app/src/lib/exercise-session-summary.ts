import { convertGlucoseValue } from "@/lib/cgm/units";
import type { BgUnits } from "@/lib/cgm/types";
import type { ActiveExerciseSession } from "@/lib/storage";

export type ExerciseSessionBgPoint = {
  timeMs: number;
  value: number;
};

export type ExerciseSessionBgSeries = {
  points: ExerciseSessionBgPoint[];
  source: "cgm" | "checks" | "none";
};

const MAX_POINTS = 48;

function timeMs(iso: string | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : null;
}

function downsample(points: ExerciseSessionBgPoint[]): ExerciseSessionBgPoint[] {
  if (points.length <= MAX_POINTS) return points;
  const step = (points.length - 1) / (MAX_POINTS - 1);
  const out: ExerciseSessionBgPoint[] = [];
  for (let i = 0; i < MAX_POINTS; i++) {
    out.push(points[Math.round(i * step)]!);
  }
  return out;
}

/** Glucose across the workout: CGM in the session window, otherwise the logged checks. */
export function buildExerciseSessionBgSeries(
  session: Pick<
    ActiveExerciseSession,
    | "startedAt"
    | "exerciseStartedAt"
    | "preBg"
    | "preBgAt"
    | "midBg"
    | "midBgAt"
    | "recoveryBg"
    | "recoveryBgAt"
  >,
  cgmMgDl: { recordedAtMs: number; valueMgDl: number }[],
  units: BgUnits,
  nowMs = Date.now(),
): ExerciseSessionBgSeries {
  const startMs = timeMs(session.exerciseStartedAt) ?? timeMs(session.startedAt) ?? nowMs - 3 * 60 * 60 * 1000;
  const inWindow = cgmMgDl
    .filter((p) => p.recordedAtMs >= startMs && p.recordedAtMs <= nowMs && Number.isFinite(p.valueMgDl))
    .sort((a, b) => a.recordedAtMs - b.recordedAtMs)
    .map((p) => ({
      timeMs: p.recordedAtMs,
      value: units === "mmol/L" ? convertGlucoseValue(p.valueMgDl, "mg/dL", "mmol/L") : Math.round(p.valueMgDl),
    }));

  if (inWindow.length >= 2) {
    return { points: downsample(inWindow), source: "cgm" };
  }

  const checks: ExerciseSessionBgPoint[] = [];
  const push = (value: number | undefined, at: string | undefined) => {
    if (value == null || !Number.isFinite(value)) return;
    const t = timeMs(at);
    if (t == null) return;
    checks.push({ timeMs: t, value });
  };
  push(session.preBg, session.preBgAt);
  push(session.midBg, session.midBgAt);
  push(session.recoveryBg, session.recoveryBgAt);
  checks.sort((a, b) => a.timeMs - b.timeMs);

  if (checks.length === 0 && inWindow.length === 1) {
    return { points: inWindow, source: "cgm" };
  }
  if (checks.length === 0) return { points: [], source: "none" };
  return { points: checks, source: "checks" };
}

export function exerciseSessionBgGlance(points: ExerciseSessionBgPoint[]): {
  start: number;
  low: number;
  now: number;
} | null {
  if (points.length === 0) return null;
  const start = points[0]!.value;
  const now = points[points.length - 1]!.value;
  const low = points.reduce((min, p) => Math.min(min, p.value), start);
  return { start, low, now };
}

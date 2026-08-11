import type { BgUnits } from "@/lib/cgm/types";
import { convertGlucoseValue } from "@/lib/cgm/units";

/** Lookback used to estimate direction, speed, and mild curvature. */
export const PROJECTION_HISTORY_WINDOW_MS = 30 * 60_000;
/** Minimum span between oldest and newest point in the window. */
export const PROJECTION_MIN_SPAN_MS = 5 * 60_000;
/** Need at least this many points for a history-based slope. */
export const PROJECTION_MIN_POINTS = 2;
/**
 * Latest reading older than this is too stale for a near-future illustration
 * (tighter than Health-prefill staleness, which allows hours).
 */
export const PROJECTION_STALE_AGE_MINUTES = 15;

/**
 * Approximate CGM arrow rates (mg/dL per minute), aligned with common Share/Libre tables.
 * Fine tokens from Dexcom/Libre are preserved on live history before UI collapse.
 */
export const CGM_ARROW_RATE_MGDL_PER_MIN: Record<string, number> = {
  doubleup: 3,
  singleup: 2,
  fortyfiveup: 1,
  flat: 0,
  fortyfivedown: -1,
  singledown: -2,
  doubledown: -3,
};

/** Cap absurd rates so a bad point cannot project wildly. */
export const PROJECTION_MAX_ABS_RATE_MGDL_PER_MIN = 5;
/** Cap acceleration (mg/dL per min²) — CGM curves rarely sustain faster than this. */
export const PROJECTION_MAX_ABS_ACCEL_MGDL_PER_MIN2 = 0.12;
/** Half-life for recency weights on segment velocities (minutes). */
export const PROJECTION_VELOCITY_HALF_LIFE_MIN = 8;
/** Acceleration contribution fades over this horizon (minutes). */
export const PROJECTION_ACCEL_DAMP_TAU_MIN = 18;
/** Path samples drawn on the chart (minutes ahead). */
export const PROJECTION_PATH_MINUTES = [5, 10, 15, 20, 25, 30] as const;

export type NearFutureProjectionPoint = {
  valueMgDl: number;
  recordedAt: string;
};

export type NearFutureProjectionMethod = "history" | "blended" | "arrow" | "none";

export type NearFutureProjectionPathPoint = {
  minutesAhead: number;
  value: number;
};

export type NearFutureProjectionResult = {
  method: Exclude<NearFutureProjectionMethod, "none">;
  /** Instantaneous pace at "now" (mg/dL per minute). */
  rateMgDlPerMin: number;
  /** Mild curvature (mg/dL per min²); 0 when unknown / flat pace. */
  accelMgDlPerMin2: number;
  /** Projected glucose in the caller's display units. */
  at15Min: number;
  at30Min: number;
  /** Smoothed future path in display units for the chart dashed line. */
  path: NearFutureProjectionPathPoint[];
  note: string;
  currentMgDl: number;
  currentDisplay: number;
  units: BgUnits;
};

export type RecentMotionEstimate = {
  rateMgDlPerMin: number;
  accelMgDlPerMin2: number;
  spanMinutes: number;
  pointCount: number;
  segmentCount: number;
};

type TimedPoint = { valueMgDl: number; t: number };

function normalizeTrendToken(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const t = raw.trim().toLowerCase().replace(/[_\s-]+/g, "");
  return t || null;
}

/** Resolve a Dexcom/Libre-style trend token to mg/dL per minute, or null if unknown. */
export function arrowRateMgDlPerMin(rawTrend: string | null | undefined): number | null {
  const token = normalizeTrendToken(rawTrend);
  if (!token) return null;
  if (token in CGM_ARROW_RATE_MGDL_PER_MIN) return CGM_ARROW_RATE_MGDL_PER_MIN[token]!;
  const aliases: Record<string, string> = {
    "↑↑": "doubleup",
    "↑": "singleup",
    "↗": "fortyfiveup",
    "→": "flat",
    "↘": "fortyfivedown",
    "↓": "singledown",
    "↓↓": "doubledown",
    rising: "singleup",
    falling: "singledown",
  };
  const mapped = aliases[token];
  if (mapped && mapped in CGM_ARROW_RATE_MGDL_PER_MIN) return CGM_ARROW_RATE_MGDL_PER_MIN[mapped]!;
  return null;
}

function clampRate(rate: number): number {
  if (!Number.isFinite(rate)) return 0;
  return Math.max(-PROJECTION_MAX_ABS_RATE_MGDL_PER_MIN, Math.min(PROJECTION_MAX_ABS_RATE_MGDL_PER_MIN, rate));
}

function clampAccel(accel: number): number {
  if (!Number.isFinite(accel)) return 0;
  return Math.max(
    -PROJECTION_MAX_ABS_ACCEL_MGDL_PER_MIN2,
    Math.min(PROJECTION_MAX_ABS_ACCEL_MGDL_PER_MIN2, accel),
  );
}

function toDisplay(mgDl: number, units: BgUnits): number {
  return units === "mmol/L" ? convertGlucoseValue(mgDl, "mg/dL", "mmol/L") : Math.round(mgDl);
}

function pointsInWindow(points: NearFutureProjectionPoint[], nowMs: number): TimedPoint[] {
  const windowStart = nowMs - PROJECTION_HISTORY_WINDOW_MS;
  return points
    .map((p) => ({ valueMgDl: p.valueMgDl, t: new Date(p.recordedAt).getTime() }))
    .filter((p) => Number.isFinite(p.t) && Number.isFinite(p.valueMgDl) && p.t >= windowStart && p.t <= nowMs + 60_000)
    .sort((a, b) => a.t - b.t);
}

/**
 * Recency-weighted velocity + mild acceleration from consecutive segment slopes.
 * Newer segments weigh more heavily so the dashed line follows the current angle/speed.
 */
export function estimateRecentMotion(
  points: NearFutureProjectionPoint[],
  nowMs = Date.now(),
): RecentMotionEstimate | null {
  const inWindow = pointsInWindow(points, nowMs);
  if (inWindow.length < PROJECTION_MIN_POINTS) return null;

  const oldest = inWindow[0]!;
  const newest = inWindow[inWindow.length - 1]!;
  const spanMs = newest.t - oldest.t;
  if (spanMs < PROJECTION_MIN_SPAN_MS) return null;

  const segments: { rate: number; endAgeMin: number; durationMin: number }[] = [];
  for (let i = 1; i < inWindow.length; i++) {
    const prev = inWindow[i - 1]!;
    const curr = inWindow[i]!;
    const durationMin = (curr.t - prev.t) / 60_000;
    if (durationMin < 0.75) continue;
    const rate = (curr.valueMgDl - prev.valueMgDl) / durationMin;
    if (!Number.isFinite(rate)) continue;
    const endAgeMin = Math.max(0, (newest.t - curr.t) / 60_000);
    segments.push({ rate, endAgeMin, durationMin });
  }

  if (segments.length === 0) {
    // Degenerate: fall back to first/last slope over the whole window
    const durationMin = spanMs / 60_000;
    const rate = clampRate((newest.valueMgDl - oldest.valueMgDl) / durationMin);
    return {
      rateMgDlPerMin: rate,
      accelMgDlPerMin2: 0,
      spanMinutes: Math.round(durationMin),
      pointCount: inWindow.length,
      segmentCount: 1,
    };
  }

  const halfLife = PROJECTION_VELOCITY_HALF_LIFE_MIN;
  let sumW = 0;
  let sumWR = 0;
  for (const seg of segments) {
    const recency = Math.exp((-Math.LN2 * seg.endAgeMin) / halfLife);
    const w = recency * Math.min(seg.durationMin, 8);
    sumW += w;
    sumWR += w * seg.rate;
  }
  const velocity = clampRate(sumW > 0 ? sumWR / sumW : 0);

  let accel = 0;
  if (segments.length >= 2) {
    // Compare recent half of segments vs older half (time-weighted).
    const mid = Math.floor(segments.length / 2);
    const older = segments.slice(0, Math.max(1, mid));
    const newer = segments.slice(Math.max(1, mid));
    const avg = (list: typeof segments) => {
      let w = 0;
      let wr = 0;
      for (const s of list) {
        const weight = Math.min(s.durationMin, 8);
        w += weight;
        wr += weight * s.rate;
      }
      return w > 0 ? wr / w : 0;
    };
    const olderAvg = avg(older);
    const newerAvg = avg(newer);
    const olderCenterAge =
      older.reduce((acc, s) => acc + s.endAgeMin * Math.min(s.durationMin, 8), 0) /
      Math.max(
        1e-6,
        older.reduce((acc, s) => acc + Math.min(s.durationMin, 8), 0),
      );
    const newerCenterAge =
      newer.reduce((acc, s) => acc + s.endAgeMin * Math.min(s.durationMin, 8), 0) /
      Math.max(
        1e-6,
        newer.reduce((acc, s) => acc + Math.min(s.durationMin, 8), 0),
      );
    const dt = Math.max(1, olderCenterAge - newerCenterAge);
    accel = clampAccel((newerAvg - olderAvg) / dt);
  }

  return {
    rateMgDlPerMin: velocity,
    accelMgDlPerMin2: accel,
    spanMinutes: Math.round(spanMs / 60_000),
    pointCount: inWindow.length,
    segmentCount: segments.length,
  };
}

/**
 * Linear-regression slope helper (kept for tests / simple callers).
 * Prefer {@link estimateRecentMotion} for the live projection.
 */
export function estimateHistorySlopeMgDlPerMin(
  points: NearFutureProjectionPoint[],
  nowMs = Date.now(),
): { rateMgDlPerMin: number; spanMinutes: number; pointCount: number } | null {
  const motion = estimateRecentMotion(points, nowMs);
  if (!motion) return null;
  return {
    rateMgDlPerMin: motion.rateMgDlPerMin,
    spanMinutes: motion.spanMinutes,
    pointCount: motion.pointCount,
  };
}

/**
 * Project glucose t minutes ahead using current velocity and a damped acceleration term.
 * Acceleration fades so the curve does not keep steepening unrealistically at +30.
 */
export function projectGlucoseMgDl(
  currentMgDl: number,
  rateMgDlPerMin: number,
  accelMgDlPerMin2: number,
  minutesAhead: number,
): number {
  const t = Math.max(0, minutesAhead);
  const tau = PROJECTION_ACCEL_DAMP_TAU_MIN;
  // Integrated damped accel: a_eff(τ) = a * e^{-τ/tau}
  // ∫_0^t a e^{-τ/tau} dτ = a * tau * (1 - e^{-t/tau})
  // Position ≈ G0 + v0*t + a*tau*(t - tau*(1 - e^{-t/tau})) ... use a simpler damped quadratic:
  // G(t) = G0 + v*t + 0.5*a*t²*e^{-t/tau}
  const damp = Math.exp(-t / tau);
  const projected = currentMgDl + rateMgDlPerMin * t + 0.5 * accelMgDlPerMin2 * t * t * damp;
  if (!Number.isFinite(projected)) return currentMgDl;
  return Math.max(0, projected);
}

function blendHistoryWithArrow(
  historyRate: number,
  arrowRate: number,
  motion: RecentMotionEstimate,
): { rate: number; method: "history" | "blended" } {
  // More history confidence when we have denser, longer recent coverage.
  const densityBoost = Math.min(0.25, Math.max(0, (motion.pointCount - 2) * 0.05));
  const spanBoost = Math.min(0.15, Math.max(0, (motion.spanMinutes - 5) * 0.02));
  let historyWeight = 0.62 + densityBoost + spanBoost;

  const disagreement = Math.abs(historyRate - arrowRate);
  // When the arrow and recent pace strongly disagree, pull toward a blend —
  // the arrow is the device's instantaneous direction cue.
  if (disagreement >= 1.5) {
    historyWeight = Math.min(historyWeight, 0.55);
  } else if (disagreement <= 0.4) {
    historyWeight = Math.min(0.9, historyWeight + 0.08);
  }

  historyWeight = Math.max(0.4, Math.min(0.9, historyWeight));
  if (historyWeight >= 0.88 && disagreement < 0.35) {
    return { rate: clampRate(historyRate), method: "history" };
  }

  const blended = historyWeight * historyRate + (1 - historyWeight) * arrowRate;
  return { rate: clampRate(blended), method: "blended" };
}

function buildResult(
  currentMgDl: number,
  rateMgDlPerMin: number,
  accelMgDlPerMin2: number,
  units: BgUnits,
  method: Exclude<NearFutureProjectionMethod, "none">,
  note: string,
): NearFutureProjectionResult {
  const path = PROJECTION_PATH_MINUTES.map((minutesAhead) => ({
    minutesAhead,
    value: toDisplay(projectGlucoseMgDl(currentMgDl, rateMgDlPerMin, accelMgDlPerMin2, minutesAhead), units),
  }));
  const at15 = path.find((p) => p.minutesAhead === 15)?.value
    ?? toDisplay(projectGlucoseMgDl(currentMgDl, rateMgDlPerMin, accelMgDlPerMin2, 15), units);
  const at30 = path.find((p) => p.minutesAhead === 30)?.value
    ?? toDisplay(projectGlucoseMgDl(currentMgDl, rateMgDlPerMin, accelMgDlPerMin2, 30), units);

  return {
    method,
    rateMgDlPerMin,
    accelMgDlPerMin2,
    at15Min: at15,
    at30Min: at30,
    path,
    note,
    currentMgDl,
    currentDisplay: toDisplay(currentMgDl, units),
    units,
  };
}

export type ComputeNearFutureProjectionInput = {
  points: NearFutureProjectionPoint[];
  /** Latest fine trend token from Dexcom/Libre (e.g. singleup), before UI collapse. */
  latestRawTrend?: string | null;
  units: BgUnits;
  nowMs?: number;
  /** When true, skip projection (caller already assessed staleness). */
  isStale?: boolean;
};

/**
 * Short-horizon educational projection from recent direction/speed (and mild curvature),
 * optionally blended with the CGM arrow. Returns null when data is stale or insufficient.
 */
export function computeNearFutureProjection(
  input: ComputeNearFutureProjectionInput,
): NearFutureProjectionResult | null {
  const nowMs = input.nowMs ?? Date.now();
  const sorted = [...input.points]
    .filter((p) => Number.isFinite(p.valueMgDl) && p.valueMgDl > 0 && p.recordedAt)
    .sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime());

  if (sorted.length === 0) return null;

  const latest = sorted[sorted.length - 1]!;
  const latestMs = new Date(latest.recordedAt).getTime();
  const ageMinutes = Number.isFinite(latestMs)
    ? Math.max(0, Math.floor((nowMs - latestMs) / 60_000))
    : Number.POSITIVE_INFINITY;
  const stale = input.isStale ?? ageMinutes > PROJECTION_STALE_AGE_MINUTES;
  if (stale) return null;

  const motion = estimateRecentMotion(sorted, nowMs);
  const arrowRate = arrowRateMgDlPerMin(input.latestRawTrend);

  if (motion) {
    let rate = motion.rateMgDlPerMin;
    let method: Exclude<NearFutureProjectionMethod, "none"> = "history";
    let note =
      motion.pointCount >= 3
        ? `Based on recent direction and pace over ~${motion.spanMinutes} min (${motion.pointCount} readings).`
        : `Based on recent direction and pace over ~${motion.spanMinutes} min.`;

    if (arrowRate != null) {
      const blended = blendHistoryWithArrow(motion.rateMgDlPerMin, arrowRate, motion);
      rate = blended.rate;
      method = blended.method;
      if (method === "blended") {
        note = `Based on recent direction/pace (~${motion.spanMinutes} min) blended with the CGM trend arrow.`;
      }
    }

    // Keep a little acceleration only when history alone (or near-agreeing blend) drives the pace —
    // damp it if we leaned hard on the arrow.
    const accel = method === "arrow" ? 0 : motion.accelMgDlPerMin2 * (method === "blended" ? 0.65 : 1);

    return buildResult(latest.valueMgDl, rate, clampAccel(accel), input.units, method, note);
  }

  if (arrowRate != null) {
    return buildResult(
      latest.valueMgDl,
      clampRate(arrowRate),
      0,
      input.units,
      "arrow",
      "Based on the CGM trend arrow (history was too short to estimate pace).",
    );
  }

  return null;
}

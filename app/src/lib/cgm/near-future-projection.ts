import type { BgUnits } from "@/lib/cgm/types";
import { convertGlucoseValue } from "@/lib/cgm/units";

/** Window used to estimate rate from recent history. */
export const PROJECTION_HISTORY_WINDOW_MS = 20 * 60_000;
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

export type NearFutureProjectionPoint = {
  valueMgDl: number;
  recordedAt: string;
};

export type NearFutureProjectionMethod = "history" | "arrow" | "none";

export type NearFutureProjectionResult = {
  method: Exclude<NearFutureProjectionMethod, "none">;
  rateMgDlPerMin: number;
  /** Projected glucose in the caller's display units. */
  at15Min: number;
  at30Min: number;
  note: string;
  currentMgDl: number;
  currentDisplay: number;
  units: BgUnits;
};

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
  // Aliases that sometimes appear in APIs / Nightscout
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

function toDisplay(mgDl: number, units: BgUnits): number {
  return units === "mmol/L" ? convertGlucoseValue(mgDl, "mg/dL", "mmol/L") : Math.round(mgDl);
}

/**
 * Linear regression slope of glucose vs time (mg/dL per minute) over the recent window.
 * Returns null when there are not enough points or the span is too short.
 */
export function estimateHistorySlopeMgDlPerMin(
  points: NearFutureProjectionPoint[],
  nowMs = Date.now(),
): { rateMgDlPerMin: number; spanMinutes: number; pointCount: number } | null {
  const windowStart = nowMs - PROJECTION_HISTORY_WINDOW_MS;
  const inWindow = points
    .map((p) => ({ valueMgDl: p.valueMgDl, t: new Date(p.recordedAt).getTime() }))
    .filter((p) => Number.isFinite(p.t) && Number.isFinite(p.valueMgDl) && p.t >= windowStart && p.t <= nowMs + 60_000)
    .sort((a, b) => a.t - b.t);

  if (inWindow.length < PROJECTION_MIN_POINTS) return null;

  const oldest = inWindow[0]!;
  const newest = inWindow[inWindow.length - 1]!;
  const spanMs = newest.t - oldest.t;
  if (spanMs < PROJECTION_MIN_SPAN_MS) return null;

  const n = inWindow.length;
  // Use minutes relative to oldest for numerical stability
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  for (const p of inWindow) {
    const x = (p.t - oldest.t) / 60_000;
    const y = p.valueMgDl;
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumXX += x * x;
  }
  const denom = n * sumXX - sumX * sumX;
  if (Math.abs(denom) < 1e-9) return null;
  const rate = (n * sumXY - sumX * sumY) / denom;
  if (!Number.isFinite(rate)) return null;

  return {
    rateMgDlPerMin: clampRate(rate),
    spanMinutes: Math.round(spanMs / 60_000),
    pointCount: n,
  };
}

function projectFromRate(
  currentMgDl: number,
  rateMgDlPerMin: number,
  units: BgUnits,
  method: Exclude<NearFutureProjectionMethod, "none">,
  note: string,
): NearFutureProjectionResult {
  const at15 = currentMgDl + rateMgDlPerMin * 15;
  const at30 = currentMgDl + rateMgDlPerMin * 30;
  return {
    method,
    rateMgDlPerMin,
    at15Min: toDisplay(Math.max(0, at15), units),
    at30Min: toDisplay(Math.max(0, at30), units),
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
 * Short-horizon educational projection: prefer recent history slope, else CGM arrow rate.
 * Returns null when there is not enough data or the latest reading is stale.
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

  const history = estimateHistorySlopeMgDlPerMin(sorted, nowMs);
  if (history) {
    const note =
      history.pointCount >= 3
        ? `Based on the last ${history.spanMinutes} min of readings (${history.pointCount} points).`
        : `Based on the last ${history.spanMinutes} min of readings.`;
    return projectFromRate(latest.valueMgDl, history.rateMgDlPerMin, input.units, "history", note);
  }

  const arrowRate = arrowRateMgDlPerMin(input.latestRawTrend);
  if (arrowRate != null) {
    return projectFromRate(
      latest.valueMgDl,
      clampRate(arrowRate),
      input.units,
      "arrow",
      "Based on the CGM trend arrow (history was too short to estimate pace).",
    );
  }

  return null;
}

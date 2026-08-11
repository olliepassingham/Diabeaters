export type GlucoseRangeStatus = "low" | "in_range" | "high";

/** Chart / UI hex colors: low = red, high = orange, in range = green. */
export const GLUCOSE_RANGE_CHART_COLORS: Record<GlucoseRangeStatus, string> = {
  low: "#ef4444",
  in_range: "#10b981",
  high: "#f97316",
};

export function computeGlucoseRangeStatus(
  value: number,
  targetLow: number,
  targetHigh: number,
): GlucoseRangeStatus {
  if (!Number.isFinite(value) || !Number.isFinite(targetLow) || !Number.isFinite(targetHigh)) {
    return "in_range";
  }
  if (value < targetLow) return "low";
  if (value > targetHigh) return "high";
  return "in_range";
}

export function glucoseRangeStatusLabel(status: GlucoseRangeStatus): string {
  if (status === "low") return "Below target";
  if (status === "high") return "Above target";
  return "In target range";
}

export function glucoseRangeCardClasses(status: GlucoseRangeStatus): string {
  if (status === "low") return "border-red-500/40 bg-red-500/10 dark:border-red-500/45 dark:bg-red-950/40";
  if (status === "high") return "border-orange-500/35 bg-orange-500/10 dark:border-orange-500/40 dark:bg-orange-950/40";
  return "border-emerald-500/30 bg-emerald-500/8 dark:border-emerald-500/35 dark:bg-emerald-950/30";
}

export function glucoseRangeValueClasses(status: GlucoseRangeStatus): string {
  if (status === "low") return "text-red-700 dark:text-red-300";
  if (status === "high") return "text-orange-700 dark:text-orange-300";
  return "text-emerald-700 dark:text-emerald-300";
}

export function glucoseRangeChartStroke(status: GlucoseRangeStatus): string {
  return GLUCOSE_RANGE_CHART_COLORS[status];
}

export type GlucoseChartValuePoint = { x: number; y: number; value: number };

export type GlucoseRangePathSegment = {
  status: GlucoseRangeStatus;
  d: string;
};

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function crossingTs(aVal: number, bVal: number, thresholds: number[]): number[] {
  if (!Number.isFinite(aVal) || !Number.isFinite(bVal) || aVal === bVal) return [];
  const ts: number[] = [];
  for (const th of thresholds) {
    if (!Number.isFinite(th)) continue;
    const t = (th - aVal) / (bVal - aVal);
    if (t > 0 && t < 1) ts.push(t);
  }
  ts.sort((x, y) => x - y);
  const unique: number[] = [];
  for (const t of ts) {
    if (unique.length === 0 || Math.abs(unique[unique.length - 1]! - t) > 1e-6) unique.push(t);
  }
  return unique;
}

/**
 * Build SVG path `d` strings colored by glucose range.
 * Segments that cross a target bound are split so the stroke flips at the threshold.
 */
export function buildGlucoseRangePathSegments(
  points: GlucoseChartValuePoint[],
  targetLow: number,
  targetHigh: number,
): GlucoseRangePathSegment[] {
  if (points.length < 2) return [];
  if (!Number.isFinite(targetLow) || !Number.isFinite(targetHigh) || targetHigh <= targetLow) {
    const d = points
      .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
      .join(" ");
    return [{ status: "in_range", d }];
  }

  const thresholds = [targetLow, targetHigh];
  const buckets: Record<GlucoseRangeStatus, string[]> = {
    low: [],
    in_range: [],
    high: [],
  };

  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!;
    const b = points[i + 1]!;
    const ts = [0, ...crossingTs(a.value, b.value, thresholds), 1];
    for (let j = 0; j < ts.length - 1; j++) {
      const t0 = ts[j]!;
      const t1 = ts[j + 1]!;
      if (t1 - t0 < 1e-9) continue;
      const x0 = lerp(a.x, b.x, t0);
      const y0 = lerp(a.y, b.y, t0);
      const x1 = lerp(a.x, b.x, t1);
      const y1 = lerp(a.y, b.y, t1);
      const midVal = lerp(a.value, b.value, (t0 + t1) / 2);
      const status = computeGlucoseRangeStatus(midVal, targetLow, targetHigh);
      buckets[status].push(`M${x0.toFixed(1)},${y0.toFixed(1)} L${x1.toFixed(1)},${y1.toFixed(1)}`);
    }
  }

  const out: GlucoseRangePathSegment[] = [];
  for (const status of ["low", "in_range", "high"] as const) {
    if (buckets[status].length === 0) continue;
    out.push({ status, d: buckets[status].join(" ") });
  }
  return out;
}

/** Share of readings within target (0–100), or null if no points. */
export function percentGlucoseInRange(values: number[], targetLow: number, targetHigh: number): number | null {
  if (values.length === 0) return null;
  const inRange = values.filter((v) => v >= targetLow && v <= targetHigh).length;
  return Math.round((inRange / values.length) * 100);
}

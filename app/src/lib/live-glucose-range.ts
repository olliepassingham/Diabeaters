export type GlucoseRangeStatus = "low" | "in_range" | "high";

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
  if (status === "low") return "border-amber-500/35 bg-amber-500/10";
  if (status === "high") return "border-orange-500/35 bg-orange-500/10";
  return "border-emerald-500/30 bg-emerald-500/8";
}

export function glucoseRangeValueClasses(status: GlucoseRangeStatus): string {
  if (status === "low") return "text-amber-700 dark:text-amber-300";
  if (status === "high") return "text-orange-700 dark:text-orange-300";
  return "text-emerald-700 dark:text-emerald-300";
}

export function glucoseRangeChartStroke(status: GlucoseRangeStatus): string {
  if (status === "low") return "#f59e0b";
  if (status === "high") return "#f97316";
  return "#10b981";
}

/** Share of readings within target (0–100), or null if no points. */
export function percentGlucoseInRange(values: number[], targetLow: number, targetHigh: number): number | null {
  if (values.length === 0) return null;
  const inRange = values.filter((v) => v >= targetLow && v <= targetHigh).length;
  return Math.round((inRange / values.length) * 100);
}

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

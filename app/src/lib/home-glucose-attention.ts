import type { HealthStatus } from "@/lib/dashboard-health-status";

export type HomeGlucoseTrend = "rising" | "falling" | "flat" | null;

/** What the home pill should say about a live reading. Null means supplies and guides still own the pill. */
export type HomeGlucoseAttention = "low" | "dropping" | "high";

/** How close above the low line a falling reading still counts as heading into a hypo. */
export function homeGlucoseApproachMargin(bgUnits: "mmol/L" | "mg/dL"): number {
  return bgUnits === "mg/dL" ? 9 : 0.5;
}

export function resolveHomeGlucoseAttention(input: {
  bg: number;
  trend: HomeGlucoseTrend;
  bgUnits: "mmol/L" | "mg/dL";
  lowLine: number;
  highLine: number | null;
}): HomeGlucoseAttention | null {
  const { bg, trend, bgUnits, lowLine } = input;
  if (!Number.isFinite(bg) || !Number.isFinite(lowLine) || lowLine <= 0) return null;
  if (bg <= lowLine) return "low";
  if (trend === "falling" && bg <= lowLine + homeGlucoseApproachMargin(bgUnits)) return "dropping";
  const high = input.highLine;
  if (high != null && Number.isFinite(high) && high > lowLine && bg > high) return "high";
  return null;
}

const SUPPLY_PILL_LABEL: Record<HealthStatus, string> = {
  stable: "Stable",
  watch: "Watch",
  action: "Action needed",
};

/** Live glucose wins on the pill. In range, the supplies and guides status stays. */
export function resolveHomeStatusPill(
  supplyStatus: HealthStatus,
  attention: HomeGlucoseAttention | null,
): { status: HealthStatus; label: string } {
  if (attention === "low") return { status: "action", label: "Low" };
  if (attention === "dropping") return { status: "watch", label: "Dropping" };
  if (attention === "high") return { status: "watch", label: "High" };
  return { status: supplyStatus, label: SUPPLY_PILL_LABEL[supplyStatus] };
}

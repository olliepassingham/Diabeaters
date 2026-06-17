export type HypoSeverityBand = "mild" | "moderate" | "severe";

export type HypoSeverityView = {
  band: HypoSeverityBand;
  label: string;
  typicalCarbs: string;
  tone: "caution" | "critical";
};

function toMmol(bg: number, bgUnits: "mmol/L" | "mg/dL"): number {
  return bgUnits === "mg/dL" ? bg / 18 : bg;
}

/** Educational band from current BG — matches quick-reference tiers in Hypo help. */
export function classifyHypoSeverity(
  bg: number,
  bgUnits: "mmol/L" | "mg/dL",
): HypoSeverityView | null {
  if (!Number.isFinite(bg) || bg <= 0) return null;
  const mmol = toMmol(bg, bgUnits);
  if (mmol < 2.8) {
    return { band: "severe", label: "Severe low", typicalCarbs: "20–25g · may need help", tone: "critical" };
  }
  if (mmol < 3.5) {
    return { band: "moderate", label: "Moderate low", typicalCarbs: "15–20g fast carbs", tone: "caution" };
  }
  if (mmol <= 3.9) {
    return { band: "mild", label: "Mild low", typicalCarbs: "10–15g fast carbs", tone: "caution" };
  }
  return null;
}

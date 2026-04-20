import type { HypoTreatment, UserSettings } from "./storage";

/** Hypo treatments logged within the last `hoursBack` hours (inclusive of cutoff boundary). */
export function hypoTreatmentsInRollingHours(treatments: HypoTreatment[], hoursBack: number): HypoTreatment[] {
  const cutoff = Date.now() - hoursBack * 60 * 60 * 1000;
  return treatments.filter((t) => {
    const ms = new Date(t.timestamp).getTime();
    return Number.isFinite(ms) && ms >= cutoff;
  });
}

/** Most recent hypo with a treatment description or notes (for contextual copy). */
export function lastHypoWithDetail(treatments: HypoTreatment[]): { at: string; label: string } | null {
  const sorted = [...treatments].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  for (const h of sorted) {
    const t = h.treatment?.trim();
    if (t) return { at: h.timestamp, label: t };
    const n = h.notes?.trim();
    if (n) return { at: h.timestamp, label: n };
  }
  return null;
}

/**
 * Midpoint of saved target range, or low alone, in the same numeric units as settings (matches profile BG units).
 */
export function suggestedRecoveryTargetBg(
  settings: UserSettings | undefined,
  bgUnits: "mmol/L" | "mg/dL",
): number | null {
  const low = settings?.targetBgLow;
  const high = settings?.targetBgHigh;
  if (typeof low === "number" && typeof high === "number" && low > 0 && high >= low) {
    const mid = (low + high) / 2;
    return bgUnits === "mg/dL" ? Math.round(mid) : Math.round(mid * 10) / 10;
  }
  if (typeof low === "number" && low > 0) {
    return bgUnits === "mg/dL" ? Math.round(low) : Math.round(low * 10) / 10;
  }
  return null;
}

export function formatTargetBgInput(n: number, bgUnits: "mmol/L" | "mg/dL"): string {
  if (bgUnits === "mg/dL") return String(Math.round(n));
  const rounded = Math.round(n * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

import type { BgUnits } from "@/lib/cgm/types";

/** International consensus “very low” / Level 2 hypo threshold. */
export const VERY_LOW_MMOL = 3.0;
export const VERY_LOW_MGDL = 54;

/** International consensus “very high” threshold. */
export const VERY_HIGH_MMOL = 13.9;
export const VERY_HIGH_MGDL = 250;

export type GlucoseTirBand = "very_low" | "low" | "in_range" | "high" | "very_high";

export type GlucoseWindowSummary = {
  sampleCount: number;
  average: number;
  /** Whole-number percents that sum to 100 when sampleCount > 0. */
  percents: Record<GlucoseTirBand, number>;
  counts: Record<GlucoseTirBand, number>;
};

export function veryLowThreshold(units: BgUnits): number {
  return units === "mg/dL" ? VERY_LOW_MGDL : VERY_LOW_MMOL;
}

export function veryHighThreshold(units: BgUnits): number {
  return units === "mg/dL" ? VERY_HIGH_MGDL : VERY_HIGH_MMOL;
}

/**
 * Classify a reading into Clarity-style bands, using the user's target for
 * in-range and consensus thresholds for very low / very high.
 */
export function classifyGlucoseTirBand(
  value: number,
  targetLow: number,
  targetHigh: number,
  units: BgUnits,
): GlucoseTirBand {
  if (!Number.isFinite(value)) return "in_range";
  const vLow = veryLowThreshold(units);
  const vHigh = veryHighThreshold(units);
  const lowBound = Number.isFinite(targetLow) ? targetLow : vLow;
  const highBound = Number.isFinite(targetHigh) ? targetHigh : vHigh;

  if (value < vLow) return "very_low";
  if (value < lowBound) return "low";
  if (value <= highBound) return "in_range";
  if (value <= vHigh) return "high";
  return "very_high";
}

function emptyCounts(): Record<GlucoseTirBand, number> {
  return { very_low: 0, low: 0, in_range: 0, high: 0, very_high: 0 };
}

/**
 * Round band percents to whole numbers that sum to 100 (largest-remainder).
 * Empty input → all zeros.
 */
export function percentsFromCounts(counts: Record<GlucoseTirBand, number>, total: number): Record<GlucoseTirBand, number> {
  const bands: GlucoseTirBand[] = ["very_low", "low", "in_range", "high", "very_high"];
  if (total <= 0) {
    return emptyCounts();
  }
  const exact = bands.map((b) => ({ band: b, value: (counts[b] / total) * 100 }));
  const floors = exact.map((e) => ({ ...e, floor: Math.floor(e.value), frac: e.value - Math.floor(e.value) }));
  let remaining = 100 - floors.reduce((s, e) => s + e.floor, 0);
  floors.sort((a, b) => b.frac - a.frac || a.band.localeCompare(b.band));
  const out = emptyCounts();
  for (const e of floors) out[e.band] = e.floor;
  for (let i = 0; i < floors.length && remaining > 0; i++) {
    out[floors[i]!.band] += 1;
    remaining -= 1;
  }
  return out;
}

/** Average + five-band time-in-range for a chart window. Null when no readings. */
export function computeGlucoseWindowSummary(
  values: number[],
  targetLow: number,
  targetHigh: number,
  units: BgUnits,
): GlucoseWindowSummary | null {
  const finite = values.filter((v) => Number.isFinite(v));
  if (finite.length === 0) return null;

  const counts = emptyCounts();
  let sum = 0;
  for (const v of finite) {
    sum += v;
    counts[classifyGlucoseTirBand(v, targetLow, targetHigh, units)] += 1;
  }

  return {
    sampleCount: finite.length,
    average:
      units === "mg/dL"
        ? Math.round(sum / finite.length)
        : Math.round((sum / finite.length) * 10) / 10,
    counts,
    percents: percentsFromCounts(counts, finite.length),
  };
}

export const TIR_BAND_LABELS: Record<GlucoseTirBand, string> = {
  very_high: "Very high",
  high: "High",
  in_range: "In range",
  low: "Low",
  very_low: "Very low",
};

/** Display order matching Clarity (very high → very low). */
export const TIR_BAND_ORDER: GlucoseTirBand[] = ["very_high", "high", "in_range", "low", "very_low"];

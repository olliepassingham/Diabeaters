import type { BgUnits } from "@/lib/cgm/types";

const MGDL_PER_MMOL = 18;

export function mgDlToMmol(mgDl: number): number {
  return Math.round((mgDl / MGDL_PER_MMOL) * 10) / 10;
}

export function mmolToMgDl(mmol: number): number {
  return Math.round(mmol * MGDL_PER_MMOL);
}

export function convertGlucoseValue(value: number, from: BgUnits, to: BgUnits): number {
  if (from === to) return value;
  if (from === "mg/dL" && to === "mmol/L") return mgDlToMmol(value);
  return mmolToMgDl(value);
}

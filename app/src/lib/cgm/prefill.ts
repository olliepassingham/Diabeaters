import { formatTargetBgInput } from "@/lib/hypo-context";
import type { BgUnits, GlucoseReading } from "@/lib/cgm/types";
import { fetchLatestCgmReading } from "@/lib/cgm/registry";
import { formatAgeMinutes } from "@/lib/cgm/staleness";
import { getDrivingBgPrefill, type DrivingBgPrefill } from "@/lib/driving-prefill";

export type BgPrefillResult = {
  value: string;
  source: string;
  fromCgm: boolean;
  reading?: GlucoseReading;
};

export function bgPrefillFromReading(reading: GlucoseReading): BgPrefillResult {
  const age = formatAgeMinutes(reading.ageMinutes);
  const warn = reading.stalenessNote ? ` ${reading.stalenessNote}` : "";
  return {
    value: formatTargetBgInput(reading.value, reading.units),
    source: `${reading.sourceLabel} · ${age} ago${warn}`,
    fromCgm: true,
    reading,
  };
}

/** Async: CGM first (when enabled), then manual app history. */
export async function getBgPrefill(units: BgUnits): Promise<BgPrefillResult | null> {
  const cgm = await fetchLatestCgmReading(units);
  if (cgm) return bgPrefillFromReading(cgm);

  const manual: DrivingBgPrefill | null = getDrivingBgPrefill();
  if (!manual) return null;
  return { value: manual.value, source: manual.source, fromCgm: false };
}

import { formatTargetBgInput } from "@/lib/hypo-context";
import type { BgUnits, GlucoseReading } from "@/lib/cgm/types";
import { fetchLatestCgmReading } from "@/lib/cgm/registry";
import { formatAgeMinutes } from "@/lib/cgm/staleness";
import { withTimeout } from "@/lib/cgm/async-timeout";
import { getDrivingBgPrefill, type DrivingBgPrefill } from "@/lib/driving-prefill";

const CGM_PREFILL_TIMEOUT_MS = 14_000;

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
  let cgm: GlucoseReading | null = null;
  try {
    cgm = await withTimeout(
      fetchLatestCgmReading(units),
      CGM_PREFILL_TIMEOUT_MS,
      "CGM prefill timed out.",
    );
  } catch {
    // Fall through to manual history — never block the form on a hung health bridge.
  }
  if (cgm) return bgPrefillFromReading(cgm);

  const manual: DrivingBgPrefill | null = getDrivingBgPrefill();
  if (!manual) return null;
  return { value: manual.value, source: manual.source, fromCgm: false };
}

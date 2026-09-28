import type { BgUnits } from "@/lib/cgm/types";
import { formatTargetBgInput } from "@/lib/hypo-context";
import type { UserSettings } from "@/lib/storage";

export const DEFAULT_TARGET_BG_MMOL = { low: 4.0, high: 10.0 };
export const DEFAULT_TARGET_BG_MGDL = { low: 72, high: 180 };

export function defaultTargetBgRange(units: BgUnits): { low: number; high: number } {
  return units === "mg/dL" ? { ...DEFAULT_TARGET_BG_MGDL } : { ...DEFAULT_TARGET_BG_MMOL };
}

/** User-configured target range from settings, with app defaults when unset. */
export function resolveUserTargetBgRange(
  settings: UserSettings | null | undefined,
  units: BgUnits,
): { low: number; high: number } {
  const low = settings?.targetBgLow;
  const high = settings?.targetBgHigh;
  if (typeof low === "number" && typeof high === "number" && low > 0 && high >= low) {
    return { low, high };
  }
  return defaultTargetBgRange(units);
}

/** Field text for the target range, using 4–10 mmol/L (72–180 mg/dL) when a bound is unset. */
export function targetBgRangeInputValues(
  settings: UserSettings | null | undefined,
  units: BgUnits,
): { low: string; high: string } {
  const fallback = defaultTargetBgRange(units);
  const low = typeof settings?.targetBgLow === "number" && settings.targetBgLow > 0 ? settings.targetBgLow : fallback.low;
  const high =
    typeof settings?.targetBgHigh === "number" && settings.targetBgHigh > 0 ? settings.targetBgHigh : fallback.high;
  return {
    low: formatTargetBgInput(low, units),
    high: formatTargetBgInput(high, units),
  };
}

export function formatTargetBgRangeLabel(
  settings: UserSettings | null | undefined,
  units: BgUnits,
): string {
  const { low, high } = resolveUserTargetBgRange(settings, units);
  return `${formatTargetBgInput(low, units)}–${formatTargetBgInput(high, units)} ${units}`;
}

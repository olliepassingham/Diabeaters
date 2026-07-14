import type { BgUnits } from "@/lib/cgm/types";
import { formatTargetBgInput } from "@/lib/hypo-context";
import type { UserSettings } from "@/lib/storage";

export const DEFAULT_TARGET_BG_MMOL = { low: 4.0, high: 10.0 };
export const DEFAULT_TARGET_BG_MGDL = { low: 72, high: 180 };

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
  return units === "mmol/L" ? { ...DEFAULT_TARGET_BG_MMOL } : { ...DEFAULT_TARGET_BG_MGDL };
}

export function formatTargetBgRangeLabel(
  settings: UserSettings | null | undefined,
  units: BgUnits,
): string {
  const { low, high } = resolveUserTargetBgRange(settings, units);
  return `${formatTargetBgInput(low, units)}–${formatTargetBgInput(high, units)} ${units}`;
}

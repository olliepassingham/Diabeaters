import { DEFAULT_TARGET_BG_MGDL, DEFAULT_TARGET_BG_MMOL } from "@/lib/target-bg-range";
import { storage } from "@/lib/storage";

export const STARTER_TARGET_RANGE_SEEDED_KEY = "diabeaters_starter_target_range_seeded_v1";

export function hasStarterTargetRangeBeenSeeded(): boolean {
  try {
    return localStorage.getItem(STARTER_TARGET_RANGE_SEEDED_KEY) === "1";
  } catch {
    return true;
  }
}

function markStarterTargetRangeSeeded(): void {
  try {
    localStorage.setItem(STARTER_TARGET_RANGE_SEEDED_KEY, "1");
  } catch {
    // ignore
  }
}

/**
 * Prefill a typical clinic target range (4–10 mmol/L or 72–180 mg/dL) when unset.
 * Does not overwrite values the user already saved; clearing both after seed will not re-fill.
 */
export function seedDefaultTargetBgRangeIfNeeded(): { seeded: boolean } {
  if (hasStarterTargetRangeBeenSeeded()) return { seeded: false };

  const settings = storage.getSettings();
  if (settings.targetBgLow != null || settings.targetBgHigh != null) {
    markStarterTargetRangeSeeded();
    return { seeded: false };
  }

  const units = storage.getProfile()?.bgUnits === "mg/dL" ? "mg/dL" : "mmol/L";
  const range = units === "mg/dL" ? DEFAULT_TARGET_BG_MGDL : DEFAULT_TARGET_BG_MMOL;
  storage.saveSettings({
    ...settings,
    targetBgLow: range.low,
    targetBgHigh: range.high,
  });
  markStarterTargetRangeSeeded();
  return { seeded: true };
}

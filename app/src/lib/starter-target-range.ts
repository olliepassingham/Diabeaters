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
 * Target range is saved only after the person confirms it in Settings.
 * Tools still fall back to 4–10 mmol/L (72–180 mg/dL) for display when it is unset.
 */
export function seedDefaultTargetBgRangeIfNeeded(): { seeded: boolean } {
  const settings = storage.getSettings();
  if (settings.targetBgLow != null || settings.targetBgHigh != null) {
    markStarterTargetRangeSeeded();
  }
  return { seeded: false };
}

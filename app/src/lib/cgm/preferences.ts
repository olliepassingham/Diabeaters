const CGM_PREFS_KEY = "diabeaters_cgm_prefs_v1";

export type CgmPreferences = {
  /** Master switch for suggesting CGM values in tools. */
  prefillEnabled: boolean;
  /** Read blood glucose from HealthKit / Health Connect. */
  healthPlatformEnabled: boolean;
  /** Reserved for v2 — Nightscout base URL (no trailing slash). */
  nightscoutUrl?: string;
  /** Reserved for v2 — Nightscout API secret token. */
  nightscoutToken?: string;
};

export const DEFAULT_CGM_PREFERENCES: CgmPreferences = {
  prefillEnabled: false,
  healthPlatformEnabled: false,
};

export function readCgmPreferences(): CgmPreferences {
  if (typeof window === "undefined") return { ...DEFAULT_CGM_PREFERENCES };
  try {
    const raw = localStorage.getItem(CGM_PREFS_KEY);
    if (!raw) return { ...DEFAULT_CGM_PREFERENCES };
    const parsed = JSON.parse(raw) as Partial<CgmPreferences>;
    return {
      prefillEnabled: Boolean(parsed.prefillEnabled),
      healthPlatformEnabled: Boolean(parsed.healthPlatformEnabled),
      nightscoutUrl: typeof parsed.nightscoutUrl === "string" ? parsed.nightscoutUrl.trim() : undefined,
      nightscoutToken: typeof parsed.nightscoutToken === "string" ? parsed.nightscoutToken : undefined,
    };
  } catch {
    return { ...DEFAULT_CGM_PREFERENCES };
  }
}

export function writeCgmPreferences(next: CgmPreferences): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(CGM_PREFS_KEY, JSON.stringify(next));
}

export function isCgmPrefillActive(prefs: CgmPreferences = readCgmPreferences()): boolean {
  return prefs.prefillEnabled && prefs.healthPlatformEnabled;
}

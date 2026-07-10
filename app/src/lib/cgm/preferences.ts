const CGM_PREFS_KEY = "diabeaters_cgm_prefs_v1";

export type DexcomShareServer = "eu" | "us" | "jp";

export type LibreLinkUpRegion = "eu" | "us" | "global" | "de" | "ap" | "au";

export type CgmPreferences = {
  /** Master switch for suggesting CGM values in tools. */
  prefillEnabled: boolean;
  /** Read blood glucose from HealthKit / Health Connect. */
  healthPlatformEnabled: boolean;
  /**
   * iOS only: set after the Apple Health permission sheet completed at least once.
   * HealthKit does not expose true read-grant status to apps.
   */
  iosHealthPromptCompleted?: boolean;
  /** Near-live Dexcom Share (unofficial API). Device-stored; temporarily encrypted on server during active exercise alerts. */
  dexcomShareEnabled?: boolean;
  dexcomShareUsername?: string;
  dexcomSharePassword?: string;
  dexcomShareServer?: DexcomShareServer;
  /** Near-live LibreLink Up (unofficial API). Credentials stay on this device only. */
  libreLinkUpEnabled?: boolean;
  libreLinkUpEmail?: string;
  libreLinkUpPassword?: string;
  libreLinkUpRegion?: LibreLinkUpRegion;
  /** Reserved for v2 — Nightscout base URL (no trailing slash). */
  nightscoutUrl?: string;
  /** Reserved for v2 — Nightscout API secret token. */
  nightscoutToken?: string;
};

export const DEFAULT_CGM_PREFERENCES: CgmPreferences = {
  prefillEnabled: false,
  healthPlatformEnabled: false,
  iosHealthPromptCompleted: false,
  dexcomShareEnabled: false,
  dexcomShareServer: "eu",
  libreLinkUpEnabled: false,
  libreLinkUpRegion: "eu",
};

function normalizeServer(value: unknown): DexcomShareServer {
  if (value === "us") return "us";
  if (value === "jp") return "jp";
  return "eu";
}

function normalizeLibreRegion(value: unknown): LibreLinkUpRegion {
  if (value === "us" || value === "global" || value === "de" || value === "ap" || value === "au") return value;
  return "eu";
}

export function hasDexcomShareCredentials(prefs: CgmPreferences): boolean {
  return Boolean(prefs.dexcomShareEnabled && prefs.dexcomShareUsername?.trim() && prefs.dexcomSharePassword);
}

export function hasLibreLinkUpCredentials(prefs: CgmPreferences): boolean {
  return Boolean(prefs.libreLinkUpEnabled && prefs.libreLinkUpEmail?.trim() && prefs.libreLinkUpPassword);
}

/** Dexcom Share or LibreLink Up — near-live bridges for chip, trends, and supporter sync. */
export function hasLiveCgmCredentials(prefs: CgmPreferences): boolean {
  return hasDexcomShareCredentials(prefs) || hasLibreLinkUpCredentials(prefs);
}

export function hasAnyCgmSourceEnabled(prefs: CgmPreferences): boolean {
  if (prefs.healthPlatformEnabled) return true;
  if (hasDexcomShareCredentials(prefs)) return true;
  if (hasLibreLinkUpCredentials(prefs)) return true;
  if (prefs.nightscoutUrl?.trim() && prefs.nightscoutToken?.trim()) return true;
  return false;
}

export function readCgmPreferences(): CgmPreferences {
  if (typeof window === "undefined") return { ...DEFAULT_CGM_PREFERENCES };
  try {
    const raw = localStorage.getItem(CGM_PREFS_KEY);
    if (!raw) return { ...DEFAULT_CGM_PREFERENCES };
    const parsed = JSON.parse(raw) as Partial<CgmPreferences>;
    return {
      prefillEnabled: Boolean(parsed.prefillEnabled),
      healthPlatformEnabled: Boolean(parsed.healthPlatformEnabled),
      iosHealthPromptCompleted: Boolean(parsed.iosHealthPromptCompleted),
      dexcomShareEnabled: Boolean(parsed.dexcomShareEnabled),
      dexcomShareUsername:
        typeof parsed.dexcomShareUsername === "string" ? parsed.dexcomShareUsername.trim() : undefined,
      dexcomSharePassword: typeof parsed.dexcomSharePassword === "string" ? parsed.dexcomSharePassword : undefined,
      dexcomShareServer: normalizeServer(parsed.dexcomShareServer),
      libreLinkUpEnabled: Boolean(parsed.libreLinkUpEnabled),
      libreLinkUpEmail: typeof parsed.libreLinkUpEmail === "string" ? parsed.libreLinkUpEmail.trim() : undefined,
      libreLinkUpPassword: typeof parsed.libreLinkUpPassword === "string" ? parsed.libreLinkUpPassword : undefined,
      libreLinkUpRegion: normalizeLibreRegion(parsed.libreLinkUpRegion),
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
  return prefs.prefillEnabled && hasAnyCgmSourceEnabled(prefs);
}

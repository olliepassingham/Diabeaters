import type { CgmAdapter } from "@/lib/cgm/adapter";
import type { GlucoseReading, BgUnits, CgmSourceId, CgmAccessResult } from "@/lib/cgm/types";
import { dexcomShareCgmAdapter } from "@/lib/cgm/adapters/dexcom-share";
import { libreLinkUpCgmAdapter } from "@/lib/cgm/adapters/libre-link-up";
import { healthPlatformCgmAdapter } from "@/lib/cgm/adapters/health-platform";
import { nightscoutCgmAdapter } from "@/lib/cgm/adapters/nightscout";
import {
  hasDexcomShareCredentials,
  hasLibreLinkUpCredentials,
  isCgmPrefillActive,
  readCgmPreferences,
  writeCgmPreferences,
  type CgmPreferences,
  type DexcomShareServer,
  type LibreLinkUpRegion,
} from "@/lib/cgm/preferences";
import { isCgmSourceEnabledInV1 } from "@/lib/cgm/v1-scope";
import { testDexcomShareConnection, clearDexcomShareSessionCache, extractDexcomAccountIdFromInput } from "@/lib/cgm/dexcom-share-client";
import {
  clearLibreLinkUpSessionCache,
  testLibreLinkUpConnection,
  type LibreLinkUpRegion as LibreRegion,
} from "@/lib/cgm/libre-link-up-client";
import { isIosDevice } from "@/lib/native-platform";
import { appendCgmReadings } from "@/lib/cgm/cgm-history-store";
import { convertGlucoseValue } from "@/lib/cgm/units";

function shouldSkipCapgoAvailability(id: CgmSourceId): boolean {
  if (id !== "health_platform") return false;
  return isIosDevice();
}

const LIVE_CGM_SOURCES: CgmSourceId[] = ["dexcom_share", "libre_link_up", "nightscout"];

const ALL_ADAPTERS: CgmAdapter[] = [healthPlatformCgmAdapter, dexcomShareCgmAdapter, libreLinkUpCgmAdapter, nightscoutCgmAdapter];

export function listCgmAdapters(): CgmAdapter[] {
  return ALL_ADAPTERS;
}

export function getCgmAdapter(id: CgmSourceId): CgmAdapter | undefined {
  return ALL_ADAPTERS.find((a) => a.id === id);
}

function enabledAdapterIds(prefs: CgmPreferences): CgmSourceId[] {
  const ids: CgmSourceId[] = [];
  if (prefs.healthPlatformEnabled) ids.push("health_platform");
  if (hasDexcomShareCredentials(prefs)) ids.push("dexcom_share");
  if (hasLibreLinkUpCredentials(prefs)) ids.push("libre_link_up");
  if (prefs.nightscoutUrl?.trim() && prefs.nightscoutToken?.trim()) ids.push("nightscout");
  return ids;
}

function isAdapterEnabledInProduct(id: CgmSourceId): boolean {
  return isCgmSourceEnabledInV1(id) || LIVE_CGM_SOURCES.includes(id);
}

/** Fetch the freshest reading from enabled adapters (v1 UI: health platform). */
export async function fetchLatestCgmReading(userUnits: BgUnits): Promise<GlucoseReading | null> {
  const prefs = readCgmPreferences();
  if (!isCgmPrefillActive(prefs)) return null;

  const enabled = enabledAdapterIds(prefs).filter((id) => isAdapterEnabledInProduct(id));
  let best: GlucoseReading | null = null;

  for (const id of enabled) {
    const adapter = getCgmAdapter(id);
    if (!adapter) continue;
    // iOS health reads use our native bridge; skip Capgo isAvailable (can hang).
    if (!shouldSkipCapgoAvailability(id)) {
      const availability = await adapter.isAvailable();
      if (!availability.available) continue;
    }
    const reading = await adapter.getLatestReading(userUnits);
    if (!reading) continue;
    if (!best || reading.ageMinutes < best.ageMinutes) best = reading;
  }

  // Best-effort trickle into local multi-day history for the Patterns page —
  // every BG auto-fill anywhere in the app (dashboard, exercise, bedtime, the
  // status strip's 5-min poll, etc.) contributes a sample, across all sources
  // including HealthKit/Health Connect (which have no separate history API here).
  if (best) {
    try {
      appendCgmReadings([
        { recordedAt: best.recordedAt, valueMgDl: convertGlucoseValue(best.value, best.units, "mg/dL") },
      ]);
    } catch {
      // Never let history bookkeeping affect the prefill result.
    }
  }

  return best;
}

export async function getHealthPlatformAccessStatus(): Promise<CgmAccessResult> {
  return healthPlatformCgmAdapter.checkAccess();
}

export async function connectHealthPlatformCgm(): Promise<{ ok: boolean; error?: string }> {
  // iOS: do NOT call Capgo isAvailable() first — it can hang forever and never reach the
  // Health permission sheet. Go straight to our native HealthAuthorization bridge.
  if (isIosDevice()) {
    const access = await healthPlatformCgmAdapter.requestAccess();
    if (!access.granted) {
      return { ok: false, error: access.error ?? "Permission denied." };
    }
    const prefs = readCgmPreferences();
    writeCgmPreferences({
      ...prefs,
      healthPlatformEnabled: true,
      prefillEnabled: true,
      iosHealthPromptCompleted: true,
    });
    return { ok: true };
  }

  const availability = await healthPlatformCgmAdapter.isAvailable();
  if (!availability.available) {
    return { ok: false, error: availability.reason ?? "Health is not available." };
  }
  const access = await healthPlatformCgmAdapter.requestAccess();
  if (!access.granted) {
    return { ok: false, error: access.error ?? "Permission denied." };
  }
  const prefs = readCgmPreferences();
  writeCgmPreferences({
    ...prefs,
    healthPlatformEnabled: true,
    prefillEnabled: true,
  });
  return { ok: true };
}

export async function connectDexcomShareCgm(input: {
  username: string;
  password: string;
  server: DexcomShareServer;
}): Promise<{ ok: boolean; error?: string; sampleMgDl?: number }> {
  clearDexcomShareSessionCache();
  const username = extractDexcomAccountIdFromInput(input.username) ?? input.username.trim();
  const password = input.password;
  if (!username || !password) {
    return { ok: false, error: "Dexcom username and password are required." };
  }

  const result = await testDexcomShareConnection({
    username,
    password,
    server: input.server,
  });

  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  const prefs = readCgmPreferences();
  writeCgmPreferences({
    ...prefs,
    prefillEnabled: true,
    dexcomShareEnabled: true,
    dexcomShareUsername: result.resolvedAccountId,
    dexcomSharePassword: password,
    dexcomShareServer: input.server,
  });

  return { ok: true, sampleMgDl: result.reading.valueMgDl };
}

export async function disconnectDexcomShareCgm(): Promise<void> {
  clearDexcomShareSessionCache();
  const prefs = readCgmPreferences();
  writeCgmPreferences({
    ...prefs,
    dexcomShareEnabled: false,
    dexcomShareUsername: undefined,
    dexcomSharePassword: undefined,
  });
}

export async function connectLibreLinkUpCgm(input: {
  email: string;
  password: string;
  region: LibreLinkUpRegion;
}): Promise<{ ok: boolean; error?: string; sampleMgDl?: number }> {
  clearLibreLinkUpSessionCache();
  const email = input.email.trim();
  const password = input.password;
  if (!email || !password) {
    return { ok: false, error: "LibreLink Up email and password are required." };
  }

  const result = await testLibreLinkUpConnection({
    email,
    password,
    region: input.region as LibreRegion,
  });

  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  const prefs = readCgmPreferences();
  writeCgmPreferences({
    ...prefs,
    prefillEnabled: true,
    libreLinkUpEnabled: true,
    libreLinkUpEmail: email,
    libreLinkUpPassword: password,
    libreLinkUpRegion: input.region,
  });

  return { ok: true, sampleMgDl: result.reading.valueMgDl };
}

export async function disconnectLibreLinkUpCgm(): Promise<void> {
  clearLibreLinkUpSessionCache();
  const prefs = readCgmPreferences();
  writeCgmPreferences({
    ...prefs,
    libreLinkUpEnabled: false,
    libreLinkUpEmail: undefined,
    libreLinkUpPassword: undefined,
  });
}

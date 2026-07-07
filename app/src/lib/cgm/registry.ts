import type { CgmAdapter } from "@/lib/cgm/adapter";
import type { GlucoseReading, BgUnits, CgmSourceId } from "@/lib/cgm/types";
import { healthPlatformCgmAdapter } from "@/lib/cgm/adapters/health-platform";
import { nightscoutCgmAdapter } from "@/lib/cgm/adapters/nightscout";
import {
  isCgmPrefillActive,
  readCgmPreferences,
  writeCgmPreferences,
  type CgmPreferences,
} from "@/lib/cgm/preferences";
import { isCgmSourceEnabledInV1 } from "@/lib/cgm/v1-scope";

const ALL_ADAPTERS: CgmAdapter[] = [healthPlatformCgmAdapter, nightscoutCgmAdapter];

export function listCgmAdapters(): CgmAdapter[] {
  return ALL_ADAPTERS;
}

export function getCgmAdapter(id: CgmSourceId): CgmAdapter | undefined {
  return ALL_ADAPTERS.find((a) => a.id === id);
}

function enabledAdapterIds(prefs: CgmPreferences): CgmSourceId[] {
  const ids: CgmSourceId[] = [];
  if (prefs.healthPlatformEnabled) ids.push("health_platform");
  if (prefs.nightscoutUrl?.trim() && prefs.nightscoutToken?.trim()) ids.push("nightscout");
  return ids;
}

/** Fetch the freshest reading from enabled adapters (v1 UI: health platform). */
export async function fetchLatestCgmReading(userUnits: BgUnits): Promise<GlucoseReading | null> {
  const prefs = readCgmPreferences();
  if (!isCgmPrefillActive(prefs)) return null;

  const enabled = enabledAdapterIds(prefs).filter((id) => isCgmSourceEnabledInV1(id) || id === "nightscout");
  let best: GlucoseReading | null = null;

  for (const id of enabled) {
    const adapter = getCgmAdapter(id);
    if (!adapter) continue;
    const availability = await adapter.isAvailable();
    if (!availability.available) continue;
    const reading = await adapter.getLatestReading(userUnits);
    if (!reading) continue;
    if (!best || reading.ageMinutes < best.ageMinutes) best = reading;
  }

  return best;
}

export async function connectHealthPlatformCgm(): Promise<{ ok: boolean; error?: string }> {
  const availability = await healthPlatformCgmAdapter.isAvailable();
  if (!availability.available) {
    return { ok: false, error: availability.reason ?? "Health is not available." };
  }
  const access = await healthPlatformCgmAdapter.requestAccess();
  if (!access.granted) {
    return { ok: false, error: access.error ?? "Permission denied." };
  }
  const prefs = readCgmPreferences();
  writeCgmPreferences({ ...prefs, healthPlatformEnabled: true, prefillEnabled: true });
  return { ok: true };
}

import type { CgmAdapter } from "@/lib/cgm/adapter";
import type { CgmAccessResult, CgmAvailability, BgUnits, GlucoseReading } from "@/lib/cgm/types";
import { withTimeout } from "@/lib/cgm/async-timeout";
import {
  fetchLatestDexcomShareReading,
  mapDexcomShareTrend,
  type DexcomShareServer,
} from "@/lib/cgm/dexcom-share-client";
import { readCgmPreferences } from "@/lib/cgm/preferences";
import { assessReadingStaleness } from "@/lib/cgm/staleness";
import { convertGlucoseValue } from "@/lib/cgm/units";
import { CGM_PREFILL_STALE_AGE_MINUTES } from "@/lib/cgm/v1-scope";

const DEXCOM_READ_TIMEOUT_MS = 12_000;

function dexcomCredentialsFromPrefs(): {
  username: string;
  password: string;
  server: DexcomShareServer;
} | null {
  const prefs = readCgmPreferences();
  const username = prefs.dexcomShareUsername?.trim();
  const password = prefs.dexcomSharePassword;
  if (!prefs.dexcomShareEnabled || !username || !password) return null;
  return {
    username,
    password,
    server: prefs.dexcomShareServer === "us" ? "us" : prefs.dexcomShareServer === "jp" ? "jp" : "eu",
  };
}

export const dexcomShareCgmAdapter: CgmAdapter = {
  id: "dexcom_share",
  label: "Dexcom Share",
  description: "Near-live readings from Dexcom Share (same login as your Dexcom app). Unofficial API.",

  async isAvailable(): Promise<CgmAvailability> {
    if (!dexcomCredentialsFromPrefs()) {
      return { available: false, reason: "Dexcom Share is not configured." };
    }
    return { available: true };
  },

  async requestAccess(): Promise<CgmAccessResult> {
    return this.checkAccess();
  },

  async checkAccess(): Promise<CgmAccessResult> {
    if (!dexcomCredentialsFromPrefs()) {
      return { granted: false, error: "Dexcom username and password required." };
    }
    return { granted: true };
  },

  async getLatestReading(userUnits: BgUnits): Promise<GlucoseReading | null> {
    const creds = dexcomCredentialsFromPrefs();
    if (!creds) return null;

    try {
      const entry = await withTimeout(
        fetchLatestDexcomShareReading(creds),
        DEXCOM_READ_TIMEOUT_MS,
        "Dexcom Share took too long to return glucose.",
      );
      if (!entry) return null;

      const { ageMinutes, isStale, stalenessNote } = assessReadingStaleness(entry.recordedAt);
      if (ageMinutes > CGM_PREFILL_STALE_AGE_MINUTES) return null;

      const value =
        userUnits === "mmol/L"
          ? convertGlucoseValue(entry.valueMgDl, "mg/dL", "mmol/L")
          : Math.round(entry.valueMgDl);

      return {
        value,
        units: userUnits,
        recordedAt: entry.recordedAt,
        source: "dexcom_share",
        sourceLabel: "Dexcom Share",
        trend: mapDexcomShareTrend(entry.trend),
        ageMinutes,
        isStale,
        stalenessNote,
      };
    } catch {
      return null;
    }
  },
};

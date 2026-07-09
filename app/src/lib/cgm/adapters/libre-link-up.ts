import type { CgmAdapter } from "@/lib/cgm/adapter";
import type { CgmAccessResult, CgmAvailability, BgUnits, GlucoseReading } from "@/lib/cgm/types";
import { withTimeout } from "@/lib/cgm/async-timeout";
import {
  fetchLatestLibreLinkUpReading,
  libreTrendToExerciseTrend,
  type LibreLinkUpRegion,
} from "@/lib/cgm/libre-link-up-client";
import { hasLibreLinkUpCredentials, readCgmPreferences } from "@/lib/cgm/preferences";
import { assessReadingStaleness } from "@/lib/cgm/staleness";
import { convertGlucoseValue } from "@/lib/cgm/units";
import { CGM_PREFILL_STALE_AGE_MINUTES } from "@/lib/cgm/v1-scope";

const LIBRE_READ_TIMEOUT_MS = 14_000;

function libreCredentialsFromPrefs(): {
  email: string;
  password: string;
  region: LibreLinkUpRegion;
} | null {
  const prefs = readCgmPreferences();
  const email = prefs.libreLinkUpEmail?.trim();
  const password = prefs.libreLinkUpPassword;
  if (!hasLibreLinkUpCredentials(prefs) || !email || !password) return null;
  const region = prefs.libreLinkUpRegion ?? "eu";
  return { email, password, region };
}

export const libreLinkUpCgmAdapter: CgmAdapter = {
  id: "libre_link_up",
  label: "LibreLink Up",
  description:
    "Near-live readings from LibreLink Up (care-partner app). Use the login for the account that follows their sensor.",

  async isAvailable(): Promise<CgmAvailability> {
    if (!libreCredentialsFromPrefs()) {
      return { available: false, reason: "LibreLink Up is not configured." };
    }
    return { available: true };
  },

  async requestAccess(): Promise<CgmAccessResult> {
    return this.checkAccess();
  },

  async checkAccess(): Promise<CgmAccessResult> {
    if (!libreCredentialsFromPrefs()) {
      return { granted: false, error: "LibreLink Up email and password required." };
    }
    return { granted: true };
  },

  async getLatestReading(userUnits: BgUnits): Promise<GlucoseReading | null> {
    const creds = libreCredentialsFromPrefs();
    if (!creds) return null;

    try {
      const entry = await withTimeout(
        fetchLatestLibreLinkUpReading(creds),
        LIBRE_READ_TIMEOUT_MS,
        "LibreLink Up took too long to return glucose.",
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
        source: "libre_link_up",
        sourceLabel: "LibreLink Up",
        trend: libreTrendToExerciseTrend(entry.trend),
        ageMinutes,
        isStale,
        stalenessNote,
      };
    } catch {
      return null;
    }
  },
};

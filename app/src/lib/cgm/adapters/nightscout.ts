import type { CgmAdapter } from "@/lib/cgm/adapter";
import type { CgmAccessResult, CgmAvailability, BgUnits, GlucoseReading } from "@/lib/cgm/types";
import { readCgmPreferences } from "@/lib/cgm/preferences";
import { convertGlucoseValue } from "@/lib/cgm/units";
import { assessReadingStaleness } from "@/lib/cgm/staleness";
import { CGM_PREFILL_STALE_AGE_MINUTES } from "@/lib/cgm/v1-scope";

type NightscoutEntry = {
  sgv?: number;
  date?: number;
  direction?: string;
};

function mapDirection(raw?: string): GlucoseReading["trend"] {
  if (!raw) return null;
  const d = raw.toUpperCase();
  if (d.includes("UP") || d === "DOUBLE_UP" || d === "SINGLE_UP") return "rising";
  if (d.includes("DOWN") || d === "DOUBLE_DOWN" || d === "SINGLE_DOWN") return "falling";
  if (d === "FLAT") return "flat";
  return "not_sure";
}

/**
 * v2 adapter stub — fetches latest Nightscout entry when URL + token are configured.
 * Not exposed in settings UI in v1.
 */
export const nightscoutCgmAdapter: CgmAdapter = {
  id: "nightscout",
  label: "Nightscout",
  description: "Read from your self-hosted Nightscout site (v2 — optional power-user path).",

  async isAvailable(): Promise<CgmAvailability> {
    const prefs = readCgmPreferences();
    if (!prefs.nightscoutUrl?.trim()) {
      return { available: false, reason: "Nightscout URL is not configured." };
    }
    return { available: true };
  },

  async requestAccess(): Promise<CgmAccessResult> {
    return this.checkAccess();
  },

  async checkAccess(): Promise<CgmAccessResult> {
    const prefs = readCgmPreferences();
    if (!prefs.nightscoutUrl?.trim() || !prefs.nightscoutToken?.trim()) {
      return { granted: false, error: "Nightscout URL and API token required." };
    }
    return { granted: true };
  },

  async getLatestReading(userUnits: BgUnits): Promise<GlucoseReading | null> {
    const prefs = readCgmPreferences();
    const base = prefs.nightscoutUrl?.trim().replace(/\/$/, "");
    const token = prefs.nightscoutToken?.trim();
    if (!base || !token) return null;

    const url = `${base}/api/v1/entries.json?count=1&token=${encodeURIComponent(token)}`;
    let rows: NightscoutEntry[];
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      rows = (await res.json()) as NightscoutEntry[];
    } catch {
      return null;
    }

    const entry = rows[0];
    if (!entry?.sgv || !entry.date) return null;

    const recordedAt = new Date(entry.date).toISOString();
    const { ageMinutes, isStale, stalenessNote } = assessReadingStaleness(recordedAt);
    if (ageMinutes > CGM_PREFILL_STALE_AGE_MINUTES) return null;

    const valueMgDl = entry.sgv;
    const value =
      userUnits === "mmol/L" ? convertGlucoseValue(valueMgDl, "mg/dL", "mmol/L") : Math.round(valueMgDl);

    return {
      value,
      units: userUnits,
      recordedAt,
      source: "nightscout",
      sourceLabel: "Nightscout",
      trend: mapDirection(entry.direction),
      ageMinutes,
      isStale,
      stalenessNote,
    };
  },
};

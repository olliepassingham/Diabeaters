import { fetchDexcomShareHistory } from "@/lib/cgm/dexcom-share-client";
import { fetchLibreLinkUpHistory, type LibreLinkUpRegion } from "@/lib/cgm/libre-link-up-client";
import {
  hasDexcomShareCredentials,
  hasLibreLinkUpCredentials,
  readCgmPreferences,
  type DexcomShareServer,
} from "@/lib/cgm/preferences";
import { resolveLiveCgmHistorySource } from "@/lib/cgm/live-cgm-source";
import type { CgmSourceId } from "@/lib/cgm/types";
import { appendCgmReadings } from "@/lib/cgm/cgm-history-store";

export type LiveCgmGlucoseEntry = {
  valueMgDl: number;
  recordedAt: string;
  trend: string | null;
};

function dexcomServerFromPrefs(server: DexcomShareServer | undefined): "eu" | "us" | "jp" {
  if (server === "us") return "us";
  if (server === "jp") return "jp";
  return "eu";
}

export function liveCgmSourceLabel(source: CgmSourceId | null): string {
  if (source === "libre_link_up") return "LibreLink Up";
  if (source === "dexcom_share") return "Dexcom Share";
  return "CGM";
}

/** Best-effort trickle-into-history for local multi-day patterns; never blocks the caller. */
function recordHistoryBatch(entries: LiveCgmGlucoseEntry[]): void {
  if (entries.length === 0) return;
  try {
    appendCgmReadings(entries.map((e) => ({ recordedAt: e.recordedAt, valueMgDl: e.valueMgDl })));
  } catch {
    // Ignore — history bookkeeping should never affect the fetch result.
  }
}

export async function fetchLiveCgmHistory(options: {
  minutes: number;
  maxCount: number;
}): Promise<{ entries: LiveCgmGlucoseEntry[]; source: CgmSourceId; sourceLabel: string } | null> {
  const prefs = readCgmPreferences();
  const source = resolveLiveCgmHistorySource(prefs);
  if (!source) return null;

  if (source === "dexcom_share" && hasDexcomShareCredentials(prefs)) {
    const username = prefs.dexcomShareUsername?.trim();
    const password = prefs.dexcomSharePassword;
    if (!username || !password) return null;
    const entries = await fetchDexcomShareHistory(
      { username, password, server: dexcomServerFromPrefs(prefs.dexcomShareServer) },
      options,
    );
    const mapped = entries.map((e) => ({ valueMgDl: e.valueMgDl, recordedAt: e.recordedAt, trend: e.trend }));
    recordHistoryBatch(mapped);
    return { source, sourceLabel: liveCgmSourceLabel(source), entries: mapped };
  }

  if (source === "libre_link_up" && hasLibreLinkUpCredentials(prefs)) {
    const email = prefs.libreLinkUpEmail?.trim();
    const password = prefs.libreLinkUpPassword;
    if (!email || !password) return null;
    const region = (prefs.libreLinkUpRegion ?? "eu") as LibreLinkUpRegion;
    const entries = await fetchLibreLinkUpHistory({ email, password, region }, options);
    const mapped = entries.map((e) => ({ valueMgDl: e.valueMgDl, recordedAt: e.recordedAt, trend: e.trend }));
    recordHistoryBatch(mapped);
    return { source, sourceLabel: liveCgmSourceLabel(source), entries: mapped };
  }

  return null;
}

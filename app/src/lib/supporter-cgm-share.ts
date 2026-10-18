import { hasDexcomShareCredentials, readCgmPreferences, type CgmPreferences } from "@/lib/cgm/preferences";
import { listCarerLinksForPatient } from "@/lib/carers";
import { invokeSupporterCgmShare } from "@/lib/invoke-supporter-cgm-share";
import { normalizeBgUnits } from "@/lib/alcohol-night-tool";
import { resolveUserTargetBgRange } from "@/lib/target-bg-range";
import { storage } from "@/lib/storage";

export const SUPPORTER_CGM_SHARE_REFRESH_MS = 6 * 60 * 60 * 1000;

export type SupporterCgmShareMemory = {
  mode: "registered" | "cleared";
  fingerprint: string;
  at: number;
} | null;

export function planSupporterCgmShare(input: {
  sharingEnabled: boolean;
  last: SupporterCgmShareMemory;
  fingerprint: string;
  now: number;
  refreshMs: number;
}): "register" | "clear" | "skip" {
  if (!input.sharingEnabled) {
    if (input.last?.mode === "cleared") return "skip";
    return "clear";
  }
  if (
    input.last?.mode === "registered" &&
    input.last.fingerprint === input.fingerprint &&
    input.now - input.last.at < input.refreshMs
  ) {
    return "skip";
  }
  return "register";
}

function fingerprintFor(prefs: CgmPreferences, units: "mmol/L" | "mg/dL", low: number, high: number): string {
  const server = prefs.dexcomShareServer === "us" ? "us" : prefs.dexcomShareServer === "jp" ? "jp" : "eu";
  return [server, prefs.dexcomShareUsername?.trim() ?? "", prefs.dexcomSharePassword ?? "", units, low, high].join("|");
}

let lastSync: SupporterCgmShareMemory = null;

export function resetSupporterCgmShareSyncState(): void {
  lastSync = null;
}

/** Upload encrypted Dexcom Share login while live glucose sharing is on, or remove it when sharing stops. */
export async function syncSupporterCgmShare(): Promise<void> {
  const prefs = readCgmPreferences();
  const hasDexcom = hasDexcomShareCredentials(prefs);
  let sharingEnabled = false;
  if (hasDexcom) {
    const links = await listCarerLinksForPatient();
    if (links.error || !links.data) return;
    sharingEnabled = links.data.some((link) => link.scopes.live_glucose !== false);
  }
  const units = normalizeBgUnits(storage.getProfile()?.bgUnits);
  const targets = resolveUserTargetBgRange(storage.getSettings(), units);
  const fingerprint = sharingEnabled ? fingerprintFor(prefs, units, targets.low, targets.high) : "";
  const action = planSupporterCgmShare({
    sharingEnabled,
    last: lastSync,
    fingerprint,
    now: Date.now(),
    refreshMs: SUPPORTER_CGM_SHARE_REFRESH_MS,
  });
  if (action === "skip") return;

  if (action === "clear") {
    const result = await invokeSupporterCgmShare({ action: "unregister" });
    if (result.success) lastSync = { mode: "cleared", fingerprint: "", at: Date.now() };
    return;
  }

  const username = prefs.dexcomShareUsername?.trim();
  const password = prefs.dexcomSharePassword;
  if (!username || !password) return;
  const server = prefs.dexcomShareServer === "us" ? "us" : prefs.dexcomShareServer === "jp" ? "jp" : "eu";
  const result = await invokeSupporterCgmShare({
    action: "register",
    dexcom_server: server,
    dexcom_username: username,
    dexcom_password: password,
    bg_units: units,
    target_low: targets.low,
    target_high: targets.high,
  });
  if (result.success && (result.action === "registered" || result.action === "unregistered")) {
    lastSync =
      result.action === "registered"
        ? { mode: "registered", fingerprint, at: Date.now() }
        : { mode: "cleared", fingerprint: "", at: Date.now() };
  }
}

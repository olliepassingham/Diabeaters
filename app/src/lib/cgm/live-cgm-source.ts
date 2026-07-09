import type { CgmPreferences } from "@/lib/cgm/preferences";
import { hasDexcomShareCredentials, hasLibreLinkUpCredentials } from "@/lib/cgm/preferences";
import type { CgmSourceId } from "@/lib/cgm/types";

/** Which near-live source to use for history charts (Dexcom preferred when both are set). */
export function resolveLiveCgmHistorySource(prefs: CgmPreferences): CgmSourceId | null {
  if (hasDexcomShareCredentials(prefs)) return "dexcom_share";
  if (hasLibreLinkUpCredentials(prefs)) return "libre_link_up";
  return null;
}

export function liveCgmConnectMessage(): string {
  return "Connect Dexcom Share or LibreLink Up in Settings → CGM to see your glucose trend.";
}

export function liveCgmOvernightMessage(): string {
  return "Connect Dexcom Share or LibreLink Up in Settings → CGM to review how last night went.";
}

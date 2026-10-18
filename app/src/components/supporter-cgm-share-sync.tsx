import { useEffect } from "react";
import { syncSupporterCgmShare } from "@/lib/supporter-cgm-share";
import { DIABEATER_SETTINGS_CHANGED_EVENT } from "@/lib/storage";

/**
 * While the user account is open, keep an encrypted Dexcom Share login on the
 * server so supporters still get readings after this account signs out.
 */
export function SupporterCgmShareSync() {
  useEffect(() => {
    let mounted = true;
    const sync = () => {
      if (!mounted) return;
      void syncSupporterCgmShare();
    };
    sync();
    const interval = window.setInterval(sync, 60_000);
    window.addEventListener(DIABEATER_SETTINGS_CHANGED_EVENT, sync);
    return () => {
      mounted = false;
      window.clearInterval(interval);
      window.removeEventListener(DIABEATER_SETTINGS_CHANGED_EVENT, sync);
    };
  }, []);

  return null;
}

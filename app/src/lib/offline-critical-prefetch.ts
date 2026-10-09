import { prefetchScenariosHubAndRoutes } from "@/lib/scenarios-route-prefetch";
import { prefetchToolsHubLinkedChunks } from "@/lib/tools-route-prefetch";

let started = false;

/**
 * Warm guides, tools, and safety chunks after the shell can paint.
 * The service worker precaches those files for offline use.
 * Help Now, emergency, and hypo help still ship in the first file via `offline-safety-entry`.
 */
export function prefetchOfflineCriticalRoutes(): void {
  if (started || typeof window === "undefined") return;
  started = true;
  const run = () => {
    prefetchScenariosHubAndRoutes();
    prefetchToolsHubLinkedChunks();
    void import("@/pages/help-now");
    void import("@/pages/emergency-card");
    void import("@/pages/tools/cgm-live");
  };
  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(run, { timeout: 4000 });
  } else {
    window.setTimeout(run, 2500);
  }
}

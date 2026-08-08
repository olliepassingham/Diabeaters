import { prefetchScenariosHubAndRoutes } from "@/lib/scenarios-route-prefetch";
import { prefetchToolsHubLinkedChunks } from "@/lib/tools-route-prefetch";

let started = false;

/**
 * Warm dashboard, guides, tools, and safety chunks as soon as the JS bundle loads.
 * Critical for offline use after a single online session (and bundled native builds).
 * Help Now / emergency / hypo also ship via `offline-safety-entry` side-effect imports.
 */
export function prefetchOfflineCriticalRoutes(): void {
  if (started || typeof window === "undefined") return;
  started = true;
  prefetchScenariosHubAndRoutes();
  prefetchToolsHubLinkedChunks();
  void import("@/pages/help-now");
  void import("@/pages/emergency-card");
  void import("@/pages/tools/cgm-live");
}

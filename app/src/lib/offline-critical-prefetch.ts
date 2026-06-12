import { prefetchScenariosHubAndRoutes } from "@/lib/scenarios-route-prefetch";
import { prefetchToolsHubLinkedChunks } from "@/lib/tools-route-prefetch";

let started = false;

/**
 * Warm dashboard, guides, and tools chunks as soon as the JS bundle loads.
 * Critical for offline use after a single online session (and bundled native builds).
 */
export function prefetchOfflineCriticalRoutes(): void {
  if (started || typeof window === "undefined") return;
  started = true;
  void import("@/pages/dashboard");
  void import("@/pages/tools/index");
  prefetchScenariosHubAndRoutes();
  prefetchToolsHubLinkedChunks();
}

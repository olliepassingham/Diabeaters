import { prefetchCommunityNavigationBundle } from "@/components/bottom-nav";
import { prefetchScenariosHubAndRoutes } from "@/lib/scenarios-route-prefetch";
import { prefetchToolsHubLinkedChunks } from "@/lib/tools-route-prefetch";

let prefetchedDashboard = false;
let prefetchedCarerView = false;
let prefetchedDemoBundle = false;
let prefetchedCommunityFeed = false;

/** Feed list + cards — separate chunk from the community page shell. */
export function prefetchCommunityFeedChunk(): void {
  if (prefetchedCommunityFeed) return;
  prefetchedCommunityFeed = true;
  void import("@/components/community/feed-post-list");
}

/** Warm the home dashboard chunk (common demo landing page). */
export function prefetchDashboardRoute(): void {
  if (prefetchedDashboard) return;
  prefetchedDashboard = true;
  void import("@/pages/dashboard");
}

/** Warm Supporter Mode hub (common demo page). */
export function prefetchCarerViewRoute(): void {
  if (prefetchedCarerView) return;
  prefetchedCarerView = true;
  void import("@/pages/carer-view");
  void import("@/pages/carer-view/activity-log");
}

/**
 * Warm lazy chunks for typical live demos: home, feed/DMs, supporter view, tools hub.
 * Safe to call repeatedly; dynamic imports dedupe in flight.
 */
export function prefetchDemoCriticalRoutes(): void {
  if (prefetchedDemoBundle) return;
  prefetchedDemoBundle = true;
  prefetchDashboardRoute();
  prefetchCarerViewRoute();
  prefetchCommunityNavigationBundle();
  prefetchCommunityFeedChunk();
  prefetchToolsHubLinkedChunks();
  prefetchScenariosHubAndRoutes();
}

/** Warm community route chunks soon after gate (feed is often the slowest sub-chunk). */
export function scheduleCommunityRoutePrefetch(): void {
  if (typeof window === "undefined") return;
  const run = () => {
    prefetchCommunityNavigationBundle();
    prefetchCommunityFeedChunk();
  };
  window.requestAnimationFrame(() => {
    if (typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(run, { timeout: 1500 });
    } else {
      window.setTimeout(run, 0);
    }
  });
}

/** Schedule demo warm-up after first paint so it does not compete with startup gates. */
export function scheduleDemoRoutePrefetch(): void {
  if (typeof window === "undefined") return;

  const run = () => prefetchDemoCriticalRoutes();

  window.requestAnimationFrame(() => {
    if (typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(run, { timeout: 3500 });
    } else {
      window.setTimeout(run, 1200);
    }
  });
}

import {
  historyBackWithViewTransition,
  navigateWithViewTransition,
} from "@/lib/nav-view-transition";
import { hapticLight } from "@/lib/haptics";
import {
  canNavigateBack,
  getBackLabel,
  getInAppNavPrev,
  hasInAppNavHistory,
  isGuidesDrilldownPath,
  isRootTabRoute,
  isToolsDrilldownPath,
  normalizeNavPath,
  resolveBackFallback,
  trackNavHistory,
} from "@/lib/nav-back-routes";
import { clearTabStackPath } from "@/lib/tab-path-stacks";

export {
  canNavigateBack,
  getBackLabel,
  getInAppNavPrev,
  hasInAppNavHistory,
  isGuidesDrilldownPath,
  isRootTabRoute,
  isToolsDrilldownPath,
  normalizeNavPath,
  resolveBackFallback,
  trackNavHistory,
};

type SetLocation = (path: string, options?: { replace?: boolean }) => void;

function shouldUseHubBack(explicitFallback: string | undefined, hub: string): boolean {
  // Allow a page-specific fallback (e.g. Routines → Exercise) to win over the hub.
  if (explicitFallback && explicitFallback !== hub) return false;
  return true;
}

export function navigateBack(
  pathname: string,
  setLocation: SetLocation,
  explicitFallback?: string,
): void {
  const fallback = explicitFallback ?? resolveBackFallback(pathname);
  void hapticLight();

  // Guides always pop to the Guides list (not prior history / home / tools).
  if (isGuidesDrilldownPath(pathname) && shouldUseHubBack(explicitFallback, "/scenarios")) {
    clearTabStackPath("scenarios");
    navigateWithViewTransition(setLocation, "/scenarios", {
      replace: true,
      direction: "back",
    });
    return;
  }

  // Tools always pop to the Tools list (same hub pattern as Guides).
  if (isToolsDrilldownPath(pathname) && shouldUseHubBack(explicitFallback, "/tools")) {
    clearTabStackPath("tools");
    navigateWithViewTransition(setLocation, "/tools", {
      replace: true,
      direction: "back",
    });
    return;
  }

  // Prefer the real previous in-app page when we have one (e.g. Exercise → Routines).
  // history.back() is immediate (see historyBackWithViewTransition) — do not await
  // popstate inside startViewTransition (that stalled ~280ms).
  if (hasInAppNavHistory(pathname)) {
    historyBackWithViewTransition();
    return;
  }

  // Known parent when history is empty (deep link / cold open).
  if (fallback) {
    navigateWithViewTransition(setLocation, fallback, {
      replace: true,
      direction: "back",
    });
    return;
  }

  if (typeof window !== "undefined" && window.history.length > 1) {
    historyBackWithViewTransition();
  }
}

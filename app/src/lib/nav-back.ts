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
  normalizeNavPath,
  resolveBackFallback,
  trackNavHistory,
};

type SetLocation = (path: string, options?: { replace?: boolean }) => void;

export function navigateBack(
  pathname: string,
  setLocation: SetLocation,
  explicitFallback?: string,
): void {
  const fallback = explicitFallback ?? resolveBackFallback(pathname);
  void hapticLight();

  // Guides always pop to the Guides list (not prior history / home / tools).
  if (isGuidesDrilldownPath(pathname) && !explicitFallback) {
    clearTabStackPath("scenarios");
    navigateWithViewTransition(setLocation, "/scenarios", {
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

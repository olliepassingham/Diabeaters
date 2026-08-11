import {
  historyBackWithViewTransition,
  navigateWithViewTransition,
} from "@/lib/nav-view-transition";
import { hapticLight } from "@/lib/haptics";
import {
  canNavigateBack,
  getBackLabel,
  hasInAppNavHistory,
  isRootTabRoute,
  normalizeNavPath,
  resolveBackFallback,
  trackNavHistory,
} from "@/lib/nav-back-routes";

export {
  canNavigateBack,
  getBackLabel,
  hasInAppNavHistory,
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

  // Prefer the real previous in-app page when we have one (e.g. Exercise → Routines).
  // Falling back first caused a no-op loop for /routines → /tools/routines → /routines.
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

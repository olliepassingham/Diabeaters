import { navigateWithViewTransition } from "@/lib/nav-view-transition";
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

export function navigateBack(
  pathname: string,
  setLocation: (path: string) => void,
  explicitFallback?: string,
): void {
  const fallback = explicitFallback ?? resolveBackFallback(pathname);
  void hapticLight();

  if (hasInAppNavHistory(pathname)) {
    window.history.back();
    return;
  }

  if (fallback) {
    navigateWithViewTransition(setLocation, fallback);
    return;
  }

  if (typeof window !== "undefined" && window.history.length > 1) {
    window.history.back();
  }
}

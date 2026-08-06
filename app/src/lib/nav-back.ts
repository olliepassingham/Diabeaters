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

  // Prefer animated stack-pop to the known parent (Tools/Guides detail → hub).
  // History.back alone skips view transitions and feels like a remount flash.
  if (fallback) {
    navigateWithViewTransition(setLocation, fallback, {
      replace: true,
      direction: "back",
    });
    return;
  }

  if (hasInAppNavHistory(pathname)) {
    historyBackWithViewTransition();
    return;
  }

  if (typeof window !== "undefined" && window.history.length > 1) {
    historyBackWithViewTransition();
  }
}

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
  planNavigateBack,
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
  planNavigateBack,
  resolveBackFallback,
  trackNavHistory,
};

type SetLocation = (path: string, options?: { replace?: boolean }) => void;

export function navigateBack(
  pathname: string,
  setLocation: SetLocation,
  explicitFallback?: string,
): void {
  void hapticLight();
  const plan = planNavigateBack(pathname, explicitFallback);

  if (plan.kind === "history") {
    // history.back() is immediate (see historyBackWithViewTransition) — do not await
    // popstate inside startViewTransition (that stalled ~280ms).
    historyBackWithViewTransition();
    return;
  }

  if (plan.kind === "href") {
    if (plan.clearTab) clearTabStackPath(plan.clearTab);
    navigateWithViewTransition(setLocation, plan.href, {
      replace: true,
      direction: "back",
    });
    return;
  }

  if (typeof window !== "undefined" && window.history.length > 1) {
    historyBackWithViewTransition();
  }
}

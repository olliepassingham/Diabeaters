import { useLayoutEffect, useRef } from "react";
import { canNavigateBack, navigateBack } from "@/lib/nav-back";
import { isCapacitorNativeShell } from "@/lib/native-platform";

const EDGE_ZONE_PX = 28;
const SWIPE_THRESHOLD_PX = 72;
const GESTURE_DECIDE_PX = 12;
const HORIZONTAL_BIAS = 8;

type GestureState = {
  active: boolean;
  startX: number;
  startY: number;
  decided: boolean;
  horizontal: boolean;
};

function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest(
      "input, textarea, select, button, a, [role='button'], [contenteditable='true'], [data-no-edge-swipe-back]",
    ),
  );
}

function isHorizontalScrollContainer(el: Element | null): boolean {
  if (!el) return false;
  const node = el.closest("[data-horizontal-scroll], .overflow-x-auto, .overflow-x-scroll");
  if (!node || !(node instanceof HTMLElement)) return false;
  return node.scrollWidth > node.clientWidth + 2;
}

export type UseEdgeSwipeBackOptions = {
  pathname: string;
  setLocation: (path: string) => void;
  enabled?: boolean;
};

/**
 * iOS-style edge swipe from the left screen edge to go back (native shell only).
 */
export function useEdgeSwipeBack({ pathname, setLocation, enabled = true }: UseEdgeSwipeBackOptions): void {
  const pathRef = useRef(pathname);
  const setLocationRef = useRef(setLocation);
  const enabledRef = useRef(enabled);
  pathRef.current = pathname;
  setLocationRef.current = setLocation;
  enabledRef.current = enabled;

  useLayoutEffect(() => {
    if (!isCapacitorNativeShell() || !enabled) return;

    const gesture: GestureState = {
      active: false,
      startX: 0,
      startY: 0,
      decided: false,
      horizontal: false,
    };

    const reset = () => {
      gesture.active = false;
      gesture.decided = false;
      gesture.horizontal = false;
    };

    const onTouchStart = (e: TouchEvent) => {
      if (!enabledRef.current || e.touches.length !== 1) return;
      if (!canNavigateBack(pathRef.current)) return;
      if (isInteractiveTarget(e.target)) return;

      const t = e.touches[0];
      if (t.clientX > EDGE_ZONE_PX) return;
      if (isHorizontalScrollContainer(e.target as Element)) return;

      gesture.active = true;
      gesture.startX = t.clientX;
      gesture.startY = t.clientY;
      gesture.decided = false;
      gesture.horizontal = false;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!gesture.active || e.touches.length !== 1) return;

      const t = e.touches[0];
      const dx = t.clientX - gesture.startX;
      const dy = t.clientY - gesture.startY;

      if (!gesture.decided) {
        if (Math.abs(dx) < GESTURE_DECIDE_PX && Math.abs(dy) < GESTURE_DECIDE_PX) return;
        gesture.decided = true;
        gesture.horizontal = Math.abs(dx) > Math.abs(dy) + HORIZONTAL_BIAS;
        if (!gesture.horizontal || dx < 0) {
          reset();
          return;
        }
      }

      if (gesture.horizontal && dx > 0) {
        e.preventDefault();
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (!gesture.active) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - gesture.startX;
      const shouldGoBack = gesture.horizontal && dx >= SWIPE_THRESHOLD_PX;
      reset();
      if (!shouldGoBack || !canNavigateBack(pathRef.current)) return;
      navigateBack(pathRef.current, setLocationRef.current);
    };

    const onTouchCancel = () => reset();

    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("touchend", onTouchEnd, { passive: true });
    document.addEventListener("touchcancel", onTouchCancel, { passive: true });

    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
      document.removeEventListener("touchcancel", onTouchCancel);
    };
  }, [enabled]);
}

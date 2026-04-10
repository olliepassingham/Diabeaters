import type { RefObject } from "react";
import { useCallback, useLayoutEffect, useRef, useState } from "react";

const SCROLL_TOP_EPS = 2;
const PULL_THRESHOLD = 72;
const MAX_PULL_VISUAL = 96;
const GESTURE_DECIDE_PX = 12;
const HORIZONTAL_BIAS = 8;

export type UsePullToRefreshOptions = {
  /** Element inside the app shell; `closest("main")` resolves the scroll container. */
  anchorRef: RefObject<HTMLElement | null>;
  onRefresh: () => Promise<void>;
  enabled?: boolean;
  isBusy?: boolean;
};

/**
 * Pull-to-refresh for layouts where scrolling lives on `<main overflow-y-auto>`, not `window`.
 * Touch only; use an explicit control for mouse / keyboard.
 */
export function usePullToRefresh({
  anchorRef,
  onRefresh,
  enabled = true,
  isBusy = false,
}: UsePullToRefreshOptions) {
  const [pullDistance, setPullDistance] = useState(0);

  const busyRef = useRef(isBusy);
  const enabledRef = useRef(enabled);
  const onRefreshRef = useRef(onRefresh);
  const pullRef = useRef(0);
  busyRef.current = isBusy;
  enabledRef.current = enabled;
  onRefreshRef.current = onRefresh;

  const gestureRef = useRef({
    active: false,
    startY: 0,
    startX: 0,
    decided: false,
    vertical: false,
  });

  const setPull = useCallback((px: number) => {
    const v = px > 0 ? Math.min(px, MAX_PULL_VISUAL) : 0;
    pullRef.current = v;
    setPullDistance(v);
  }, []);

  useLayoutEffect(() => {
    if (!enabled) {
      setPullDistance(0);
      return;
    }

    let attachedTo: HTMLElement | null = null;
    let raf = 0;

    const resolveMain = () => anchorRef.current?.closest("main") ?? null;

    const touchStart = (e: TouchEvent) => {
      if (!enabledRef.current || busyRef.current || e.touches.length !== 1) return;
      const main = resolveMain();
      if (!main || main.scrollTop > SCROLL_TOP_EPS) return;

      const t = e.touches[0];
      gestureRef.current = {
        active: true,
        startY: t.clientY,
        startX: t.clientX,
        decided: false,
        vertical: false,
      };
    };

    const touchMove = (e: TouchEvent) => {
      const g = gestureRef.current;
      if (!g.active || !enabledRef.current || busyRef.current || e.touches.length !== 1) return;

      const main = resolveMain();
      if (!main) {
        g.active = false;
        setPull(0);
        return;
      }

      if (main.scrollTop > SCROLL_TOP_EPS) {
        g.active = false;
        setPull(0);
        return;
      }

      const t = e.touches[0];
      const dy = t.clientY - g.startY;
      const dx = t.clientX - g.startX;

      if (!g.decided) {
        if (Math.abs(dx) < GESTURE_DECIDE_PX && Math.abs(dy) < GESTURE_DECIDE_PX) return;
        g.decided = true;
        g.vertical = Math.abs(dy) >= Math.abs(dx) + HORIZONTAL_BIAS;
        if (!g.vertical) {
          g.active = false;
          return;
        }
      }

      if (!g.vertical) return;

      if (dy > 0) {
        setPull(dy * 0.48);
      } else {
        setPull(0);
      }
    };

    const touchEnd = () => {
      const g = gestureRef.current;
      if (!g.active) return;
      g.active = false;

      const dist = pullRef.current;
      setPull(0);

      if (!enabledRef.current || busyRef.current) return;
      const main = resolveMain();
      if (main && main.scrollTop > SCROLL_TOP_EPS) return;

      if (g.vertical && dist >= PULL_THRESHOLD) {
        void onRefreshRef.current();
      }
    };

    const touchCancel = () => {
      gestureRef.current.active = false;
      setPull(0);
    };

    const bind = () => {
      const mainEl = resolveMain();
      if (!mainEl) {
        raf = requestAnimationFrame(bind);
        return;
      }
      attachedTo = mainEl;
      mainEl.addEventListener("touchstart", touchStart, { passive: true });
      mainEl.addEventListener("touchmove", touchMove, { passive: true });
      mainEl.addEventListener("touchend", touchEnd);
      mainEl.addEventListener("touchcancel", touchCancel);
    };

    bind();

    return () => {
      cancelAnimationFrame(raf);
      if (attachedTo) {
        attachedTo.removeEventListener("touchstart", touchStart);
        attachedTo.removeEventListener("touchmove", touchMove);
        attachedTo.removeEventListener("touchend", touchEnd);
        attachedTo.removeEventListener("touchcancel", touchCancel);
      }
    };
  }, [anchorRef, enabled, setPull]);

  return {
    pullDistance,
    pullProgress: Math.min(1, pullDistance / PULL_THRESHOLD),
  };
}

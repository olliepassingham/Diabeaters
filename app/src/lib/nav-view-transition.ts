import { flushSync } from "react-dom";

export type NavTransitionDirection = "forward" | "back";

type SetLocation = (path: string, options?: { replace?: boolean }) => void;

type StartViewTransitionResult = {
  finished: Promise<unknown>;
};

type DocumentWithViewTransition = Document & {
  startViewTransition?: (cb: () => void | Promise<void>) => StartViewTransitionResult;
};

/** Chrome 111+, Safari 18+, etc. — same-document tab transitions. */
export function supportsViewTransition(): boolean {
  return typeof document !== "undefined" && "startViewTransition" in document;
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  if (typeof window.matchMedia !== "function") return false;
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/** Drive CSS `html[data-nav-direction]` for forward fade vs stack-pop slide. */
export function setNavTransitionDirection(direction: NavTransitionDirection): void {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.navDirection = direction;
}

function clearNavTransitionDirectionSoon(): void {
  if (typeof document === "undefined") return;
  window.setTimeout(() => {
    delete document.documentElement.dataset.navDirection;
  }, 320);
}

function runViewTransition(update: () => void | Promise<void>): void {
  if (prefersReducedMotion()) {
    void Promise.resolve(update());
    clearNavTransitionDirectionSoon();
    return;
  }
  const doc = document as DocumentWithViewTransition;
  if (typeof doc.startViewTransition === "function") {
    const transition = doc.startViewTransition(update);
    void transition.finished.finally(clearNavTransitionDirectionSoon);
  } else {
    void Promise.resolve(update());
    clearNavTransitionDirectionSoon();
  }
}

/**
 * Run a wouter navigation inside a View Transition when supported, so the
 * browser can animate `#app-scroll-main` (see `view-transition-name` in CSS).
 * Falls back to a plain `setLocation`. Skips VT when reduced-motion is on.
 */
export function navigateWithViewTransition(
  setLocation: SetLocation,
  path: string,
  options?: { replace?: boolean; direction?: NavTransitionDirection },
): void {
  setNavTransitionDirection(options?.direction ?? "forward");
  runViewTransition(() => {
    flushSync(() => {
      if (options?.replace) {
        setLocation(path, { replace: true });
      } else {
        setLocation(path);
      }
    });
  });
}

/**
 * Pop the browser history inside a View Transition when possible so back
 * (button / edge swipe / Android back) matches stack-pop motion.
 */
export function historyBackWithViewTransition(): void {
  setNavTransitionDirection("back");
  if (prefersReducedMotion() || !supportsViewTransition()) {
    window.history.back();
    clearNavTransitionDirectionSoon();
    return;
  }

  runViewTransition(async () => {
    await new Promise<void>((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        window.removeEventListener("popstate", onPop);
        // Two frames so React/wouter can commit the previous route before VT snapshots.
        requestAnimationFrame(() => {
          requestAnimationFrame(() => resolve());
        });
      };
      const onPop = () => finish();
      window.addEventListener("popstate", onPop);
      window.history.back();
      window.setTimeout(finish, 280);
    });
  });
}

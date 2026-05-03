import { flushSync } from "react-dom";

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

/**
 * Run a wouter navigation inside a View Transition when supported, so the
 * browser can animate `#app-scroll-main` (see `view-transition-name` in CSS).
 * Falls back to a plain `setLocation`. Skips VT when reduced-motion is on.
 */
export function navigateWithViewTransition(setLocation: (path: string) => void, path: string): void {
  if (prefersReducedMotion()) {
    setLocation(path);
    return;
  }
  const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
  if (typeof doc.startViewTransition === "function") {
    doc.startViewTransition(() => {
      flushSync(() => setLocation(path));
    });
  } else {
    setLocation(path);
  }
}

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import { useLayoutEffect } from "react";
import { useLocation, useSearch } from "wouter";

/** Snappy ease-out — close to iOS system curves */
const easeOut = [0.22, 1, 0.36, 1] as const;

/**
 * Cross-fade (and light vertical motion on non-tab routes) when the wouter
 * route key changes. Bottom-tab cluster shares one key so lazy routes are not
 * remounted on every tab tap — scroll is reset on pathname change instead.
 * Respects prefers-reduced-motion.
 */
export function AnimatedRouteOutlet({ children }: { children: ReactNode }) {
  const [pathname] = useLocation();
  const search = useSearch();
  const reduceMotion = useReducedMotion();

  const isBottomTabRoute =
    pathname === "/" ||
    pathname === "/account" ||
    pathname.startsWith("/scenarios") ||
    pathname.startsWith("/community") ||
    pathname.startsWith("/tools") ||
    pathname.startsWith("/education") ||
    pathname.startsWith("/carer-view");

  const routeKey = isBottomTabRoute ? "bottom-tabs" : `${pathname}${search ? `?${search}` : ""}`;
  const tabBucket = isBottomTabRoute;
  const duration = reduceMotion ? 0 : tabBucket ? 0 : 0.14;

  useLayoutEffect(() => {
    const el = document.getElementById("app-scroll-main");
    if (!el) return;
    el.scrollTop = 0;
  }, [pathname]);

  const initial = reduceMotion
    ? { opacity: 1, y: 0 }
    : tabBucket
      ? { opacity: 1, y: 0 }
      : { opacity: 0, y: 8 };
  const exit = reduceMotion
    ? { opacity: 1, y: 0 }
    : tabBucket
      ? { opacity: 1, y: 0 }
      : { opacity: 0, y: -5 };

  return (
    <AnimatePresence initial={false} mode="sync">
      <motion.div
        key={routeKey}
        className="min-w-0 w-full"
        initial={initial}
        animate={{ opacity: 1, y: 0 }}
        exit={exit}
        transition={{ duration, ease: easeOut }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

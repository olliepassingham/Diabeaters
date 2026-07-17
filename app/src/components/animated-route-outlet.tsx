import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import { useLayoutEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { cn } from "@/lib/utils";
import { supportsViewTransition } from "@/lib/nav-view-transition";

/** Snappy ease-out — close to iOS system curves */
const easeOut = [0.22, 1, 0.36, 1] as const;

/**
 * Cross-fade (and light vertical motion) when the route key changes.
 * Bottom tabs: when `startViewTransition` is available, the outlet keeps a
 * stable key so routes are not remounted — the browser animates `#app-scroll-main`
 * (see `navigateWithViewTransition` in the bottom nav). Otherwise the outlet
 * keys by pathname for a short Framer transition on tab changes.
 */
export function AnimatedRouteOutlet({
  children,
  fillHeight = false,
}: {
  children: ReactNode;
  fillHeight?: boolean;
}) {
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

  const vt = supportsViewTransition();
  const stableTabOutlet = isBottomTabRoute && (vt || !!reduceMotion);
  const routeKey = stableTabOutlet
    ? "bottom-tabs"
    : `${pathname}${search ? `?${search}` : ""}`;

  const tabFramerTransition =
    isBottomTabRoute && !stableTabOutlet && !reduceMotion ? 0.12 : isBottomTabRoute ? 0 : 0.14;
  const duration = reduceMotion ? 0 : tabFramerTransition;

  useLayoutEffect(() => {
    const el = document.getElementById("app-scroll-main");
    if (!el) return;
    // Instant, not smooth: the container has `scroll-behavior: smooth` for in-page
    // anchors, but new pages must start at the top without a visible scroll-up.
    el.scrollTo({ top: 0, behavior: "instant" });
  }, [pathname]);

  const tabMotionBucket = isBottomTabRoute && stableTabOutlet;
  const initial = reduceMotion
    ? { opacity: 1, y: 0 }
    : tabMotionBucket
      ? { opacity: 1, y: 0 }
      : { opacity: 0, y: 8 };
  const exit = reduceMotion
    ? { opacity: 1, y: 0 }
    : tabMotionBucket
      ? { opacity: 1, y: 0 }
      : { opacity: 0, y: -5 };

  return (
    <AnimatePresence initial={false} mode="sync">
      <motion.div
        key={routeKey}
        className={cn("min-w-0 w-full", fillHeight && "flex min-h-0 flex-1 flex-col h-full")}
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

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import { useLocation, useSearch } from "wouter";

const easeApple = [0.25, 0.1, 0.25, 1] as const;

/**
 * Soft cross-fade when the wouter route key changes (main app chrome only).
 * Respects prefers-reduced-motion.
 */
export function AnimatedRouteOutlet({ children }: { children: ReactNode }) {
  const [pathname] = useLocation();
  const search = useSearch();
  const reduceMotion = useReducedMotion();
  // For the bottom-tab "main" pages, avoid forcing a remount on every navigation.
  // Remounting here causes all child route trees to reset and refetch, which makes tab switching feel slow.
  const isBottomTabRoute =
    pathname === "/" ||
    pathname.startsWith("/scenarios") ||
    pathname.startsWith("/community") ||
    pathname.startsWith("/tools") ||
    pathname.startsWith("/education") ||
    pathname.startsWith("/carer-view");

  const routeKey = isBottomTabRoute ? "bottom-tabs" : `${pathname}${search ? `?${search}` : ""}`;
  const duration = reduceMotion || isBottomTabRoute ? 0 : 0.18;

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={routeKey}
        className="min-w-0 w-full"
        initial={{ opacity: reduceMotion ? 1 : 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: reduceMotion ? 1 : 0 }}
        transition={{ duration, ease: easeApple }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

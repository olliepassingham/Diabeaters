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
  const routeKey = `${pathname}${search ? `?${search}` : ""}`;
  const duration = reduceMotion ? 0 : 0.18;

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

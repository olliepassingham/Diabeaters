import { isAiCoachEnabled } from "@/lib/flags";

/**
 * Warm Vite chunks for a single href linked from the Tools hub (or bottom nav).
 * Safe to call repeatedly; dynamic import dedupes in flight.
 */
export function prefetchToolsDestinationHref(href: string): void {
  const q = href.indexOf("?");
  const path = (q >= 0 ? href.slice(0, q) : href) || "/";

  if (path === "/tools/hypo-help") {
    void import("@/pages/tools/hypo-help");
    return;
  }
  if (path === "/tools/hypo-history") {
    void import("@/pages/tools/hypo-history");
    return;
  }
  if (path === "/tools/activity") {
    void import("@/pages/tools/activity-log");
    return;
  }
  if (path === "/tools/patterns") {
    void import("@/pages/tools/patterns");
    return;
  }
  if (path === "/tools/glucose-converter") {
    void import("@/pages/tools/glucose-converter");
    return;
  }
  if (path === "/tools/correction") {
    void import("@/pages/tools/correction-help");
    return;
  }
  if (path === "/tools/cgm-live") {
    void import("@/pages/tools/cgm-live");
    return;
  }
  if (path === "/tools/tips") {
    void import("@/pages/tools/tips");
    return;
  }
  if (path === "/adviser") {
    void import("@/pages/adviser");
    return;
  }
  if (path === "/routines") {
    void import("@/pages/routines");
    return;
  }
  if (path === "/supplies") {
    void import("@/pages/supplies");
    return;
  }
  if (path === "/appointments") {
    void import("@/pages/appointments");
    return;
  }
  if (path === "/education") {
    void import("@/pages/education/index");
    return;
  }
  if (path === "/coach" && isAiCoachEnabled) {
    void import("@/pages/coach");
  }
}

/** Fire common tool destinations in parallel (hub idle warm-up). */
export function prefetchToolsHubLinkedChunks(): void {
  void import("@/pages/tools/hypo-help");
  void import("@/pages/tools/hypo-history");
  void import("@/pages/tools/activity-log");
  void import("@/pages/tools/patterns");
  void import("@/pages/tools/glucose-converter");
  void import("@/pages/tools/correction-help");
  void import("@/pages/tools/tips");
  void import("@/pages/adviser");
  void import("@/pages/routines");
  void import("@/pages/supplies");
  void import("@/pages/appointments");
  void import("@/pages/education/index");
  if (isAiCoachEnabled) void import("@/pages/coach");
}

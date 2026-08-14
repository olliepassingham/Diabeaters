const NAV_CURRENT_KEY = "diabeater:nav-current";
const NAV_PREV_KEY = "diabeater:nav-prev";

/** Bottom-tab hub routes — no back gesture or hardware back (except Android exit). */
const ROOT_TAB_ROUTES = new Set([
  "/",
  "/scenarios",
  "/tools",
  "/community",
  "/account",
  "/carer-view",
]);

const EXPLICIT_PARENT: Record<string, string> = {
  "/settings": "/account",
  "/ratios": "/settings/ratios",
  "/routines": "/tools",
  "/notifications": "/",
  "/supplies": "/tools",
  "/appointments": "/tools",
  "/adviser": "/tools",
  // Legacy aliases → Guides hub (not the nested scenario route).
  "/bedtime": "/scenarios",
  "/sick-day": "/scenarios",
  "/travel": "/scenarios",
  "/emergency-card": "/settings/emergency",
  "/medical-sources": "/settings/about",
  "/help-now": "/",
  "/family-carers": "/account",
  "/supporter-profile": "/account",
  "/coach": "/tools",
  "/privacy": "/",
  "/support": "/",
  "/mode": "/account",
  "/carer-setup": "/welcome",
  "/education": "/tools",
};

const BACK_LABELS: Record<string, string> = {
  "/": "Home",
  "/settings": "Settings",
  "/scenarios": "Guides",
  "/tools": "Tools",
  "/community": "Feed",
  "/account": "Account",
  "/carer-view": "Supporter",
  "/community/messages": "Messages",
  "/education": "Learn",
  "/welcome": "Welcome",
};

export function normalizeNavPath(pathname: string): string {
  const raw = (pathname || "/").split("?")[0]?.split("#")[0] ?? "/";
  if (raw.length > 1 && raw.endsWith("/")) return raw.slice(0, -1);
  return raw || "/";
}

export function isRootTabRoute(pathname: string): boolean {
  return ROOT_TAB_ROUTES.has(normalizeNavPath(pathname));
}

export function isGuidesDrilldownPath(pathname: string): boolean {
  const path = normalizeNavPath(pathname);
  if (path.startsWith("/scenarios/")) return true;
  return path === "/bedtime" || path === "/sick-day" || path === "/travel";
}

/** Tools-tab nested routes — Back should return to the Tools list. */
export function isToolsDrilldownPath(pathname: string): boolean {
  const path = normalizeNavPath(pathname);
  if (path === "/tools") return false;
  if (path.startsWith("/tools/")) return true;
  if (path.startsWith("/education")) return true;
  return (
    path === "/routines" ||
    path === "/supplies" ||
    path === "/appointments" ||
    path === "/adviser" ||
    path === "/coach" ||
    path === "/ratios"
  );
}

export function resolveBackFallback(pathname: string): string | null {
  const path = normalizeNavPath(pathname);
  if (isRootTabRoute(path)) return null;

  if (EXPLICIT_PARENT[path]) return EXPLICIT_PARENT[path];

  if (/^\/community\/messages\/[^/]+$/.test(path)) return "/community/messages";
  if (/^\/community\/post\/[^/]+$/.test(path)) return "/community";
  if (/^\/community\/profile\/[^/]+$/.test(path)) return "/community";
  if (/^\/community\/u\/[^/]+$/.test(path)) return "/community";
  if (/^\/education\/[^/]+$/.test(path)) return "/education";
  if (/^\/carer-view\/[^/]+$/.test(path)) return "/carer-view";

  if (path.startsWith("/settings/")) return "/settings";
  if (path.startsWith("/tools/")) return "/tools";
  if (path.startsWith("/scenarios/")) return "/scenarios";
  if (path.startsWith("/community/")) return "/community";

  return null;
}

export function getBackLabel(fallbackPath: string): string {
  const path = normalizeNavPath(fallbackPath);
  return BACK_LABELS[path] ?? "Back";
}

export function trackNavHistory(pathname: string): void {
  if (typeof window === "undefined") return;
  try {
    const normalized = normalizeNavPath(pathname);
    const prev = sessionStorage.getItem(NAV_CURRENT_KEY);
    if (prev && prev !== normalized) {
      sessionStorage.setItem(NAV_PREV_KEY, prev);
    }
    sessionStorage.setItem(NAV_CURRENT_KEY, normalized);
  } catch {
    // ignore quota / private mode
  }
}

export function getInAppNavPrev(pathname: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    const prev = sessionStorage.getItem(NAV_PREV_KEY);
    const current = normalizeNavPath(pathname);
    if (prev && prev !== current) return prev;
    return null;
  } catch {
    return null;
  }
}

export function hasInAppNavHistory(pathname: string): boolean {
  return Boolean(getInAppNavPrev(pathname));
}

function shouldUseHubBack(explicitFallback: string | undefined, hub: string): boolean {
  // Allow a page-specific fallback (e.g. Routines → Exercise) to win over the hub.
  if (explicitFallback && explicitFallback !== hub) return false;
  return true;
}

export type NavBackPlan =
  | { kind: "history" }
  | { kind: "href"; href: string; clearTab?: "tools" | "scenarios" }
  | { kind: "none" };

/**
 * Where Back should go. In-app previous page wins over Tools/Guides hub,
 * so Home → Patterns → Back returns to Home instead of the Tools list.
 */
export function planNavigateBack(pathname: string, explicitFallback?: string): NavBackPlan {
  const path = normalizeNavPath(pathname);
  const fallback = explicitFallback ?? resolveBackFallback(path);

  if (hasInAppNavHistory(path)) {
    return { kind: "history" };
  }

  if (isGuidesDrilldownPath(path) && shouldUseHubBack(explicitFallback, "/scenarios")) {
    return { kind: "href", href: "/scenarios", clearTab: "scenarios" };
  }
  if (isToolsDrilldownPath(path) && shouldUseHubBack(explicitFallback, "/tools")) {
    return { kind: "href", href: "/tools", clearTab: "tools" };
  }
  if (fallback) {
    return { kind: "href", href: fallback };
  }
  return { kind: "none" };
}

export function canNavigateBack(pathname: string): boolean {
  const path = normalizeNavPath(pathname);
  if (isRootTabRoute(path)) return false;
  if (resolveBackFallback(path)) return true;
  if (hasInAppNavHistory(path)) return true;
  return typeof window !== "undefined" && window.history.length > 1;
}

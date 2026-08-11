/**
 * Per-tab path stacks for bottom navigation (Tools / Guides / Community / Home / Account).
 * Remembers the last nested route so switching tabs restores depth instead of always
 * wiping to the hub. Re-tapping the active tab’s hub resets that stack.
 */

const STORAGE_KEY = "diabeater:tab-path-stacks:v1";

export type TabStackId = "home" | "scenarios" | "tools" | "community" | "messages" | "account" | "carer";

type TabStacks = Partial<Record<TabStackId, string>>;

function normalizePath(pathname: string): string {
  const raw = (pathname || "/").split("?")[0]?.split("#")[0] ?? "/";
  if (raw.length > 1 && raw.endsWith("/")) return raw.slice(0, -1);
  return raw || "/";
}

export function tabStackIdForPath(pathname: string): TabStackId | null {
  const path = normalizePath(pathname);
  if (path === "/" || path === "/notifications" || path === "/help-now") return "home";
  if (path === "/account" || path.startsWith("/settings") || path === "/mode" || path === "/family-carers") {
    return "account";
  }
  if (path.startsWith("/carer-view") || path.startsWith("/carer-setup")) return "carer";
  if (path === "/community/messages" || path.startsWith("/community/messages/")) return "messages";
  if (path === "/community" || path.startsWith("/community/")) return "community";
  if (
    path === "/tools" ||
    path.startsWith("/tools/") ||
    path.startsWith("/education") ||
    path === "/routines" ||
    path === "/supplies" ||
    path === "/appointments" ||
    path === "/adviser" ||
    path === "/coach" ||
    path === "/ratios"
  ) {
    return "tools";
  }
  if (
    path === "/scenarios" ||
    path.startsWith("/scenarios/") ||
    path === "/bedtime" ||
    path === "/sick-day" ||
    path === "/travel"
  ) {
    return "scenarios";
  }
  return null;
}

export function hubHrefForTabStack(id: TabStackId): string {
  switch (id) {
    case "home":
      return "/";
    case "scenarios":
      return "/scenarios";
    case "tools":
      return "/tools";
    case "community":
      return "/community";
    case "messages":
      return "/community/messages";
    case "account":
      return "/account";
    case "carer":
      return "/carer-view";
    default:
      return "/";
  }
}

function readStacks(): TabStacks {
  if (typeof sessionStorage === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as TabStacks;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeStacks(stacks: TabStacks): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(stacks));
  } catch {
    /* ignore */
  }
}

/** Persist the current path under its tab stack (call when leaving via bottom nav). */
export function rememberTabPath(pathname: string): void {
  const id = tabStackIdForPath(pathname);
  if (!id) return;
  const path = normalizePath(pathname);
  const hub = hubHrefForTabStack(id);
  const stacks = readStacks();
  if (path === hub) {
    delete stacks[id];
  } else {
    stacks[id] = path;
  }
  writeStacks(stacks);
}

/** Clear a remembered nested path for a tab (e.g. after hierarchical Back to Guides). */
export function clearTabStackPath(id: TabStackId): void {
  const stacks = readStacks();
  if (!(id in stacks)) return;
  delete stacks[id];
  writeStacks(stacks);
}

/** Destination when tapping a bottom-nav tab (restore nested path when present). */
export function resolveTabNavigationTarget(tabHref: string, currentPathname: string): string {
  const current = normalizePath(currentPathname);
  const hub = normalizePath(tabHref);
  const idFromHub: Record<string, TabStackId> = {
    "/": "home",
    "/scenarios": "scenarios",
    "/tools": "tools",
    "/community": "community",
    "/community/messages": "messages",
    "/account": "account",
    "/carer-view": "carer",
  };
  const destIdResolved = idFromHub[hub];
  if (!destIdResolved) return hub;

  const currentId = tabStackIdForPath(current);

  // Guides: always open the list of guides (never restore Sick day / Exercise / etc.).
  if (destIdResolved === "scenarios") {
    if (currentId && currentId !== "scenarios") {
      rememberTabPath(current);
    }
    clearTabStackPath("scenarios");
    return hub;
  }

  // Re-tap same tab while nested → reset to hub (iOS-like).
  if (currentId === destIdResolved && current !== hub) {
    clearTabStackPath(destIdResolved);
    return hub;
  }

  // Leaving current tab: remember depth.
  if (currentId && currentId !== destIdResolved) {
    rememberTabPath(current);
  }

  const stacks = readStacks();
  const saved = stacks[destIdResolved];
  if (saved && saved !== hub) return saved;
  return hub;
}

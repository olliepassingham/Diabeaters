/** Push / OS notification tap: open the header notification bell popover (not the full page). */
export const NOTIFICATION_BELL_DEEP_LINK = "/notifications?bell=1";

/** Dispatched when the header notification bell should open programmatically. */
export const OPEN_NOTIFICATION_BELL_EVENT = "diabeaters:open-notification-bell";

/** Dispatched when the header notification bell should close (e.g. another sheet is taking over). */
export const CLOSE_NOTIFICATION_BELL_EVENT = "diabeaters:close-notification-bell";

const PENDING_OPEN_BELL_KEY = "diabeaters:pending_open_notification_bell";

export function isNotificationBellDeepLink(path: string): boolean {
  const raw = path.trim();
  if (!raw) return false;
  try {
    const url = new URL(raw, "https://app.diabeaters.local");
    if (url.pathname !== "/notifications") return false;
    return url.searchParams.get("bell") === "1";
  } catch {
    return raw === NOTIFICATION_BELL_DEEP_LINK;
  }
}

export function storePendingOpenNotificationBell(): void {
  try {
    sessionStorage.setItem(PENDING_OPEN_BELL_KEY, "1");
  } catch {
    // ignore
  }
}

export function consumePendingOpenNotificationBell(): boolean {
  try {
    if (sessionStorage.getItem(PENDING_OPEN_BELL_KEY) !== "1") return false;
    sessionStorage.removeItem(PENDING_OPEN_BELL_KEY);
    return true;
  } catch {
    return false;
  }
}

export function requestOpenNotificationBell(): void {
  storePendingOpenNotificationBell();
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(OPEN_NOTIFICATION_BELL_EVENT));
}

/** Close the header notification popover so it can't stack over another sheet (e.g. hypo check-in respond). */
export function requestCloseNotificationBell(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(CLOSE_NOTIFICATION_BELL_EVENT));
}

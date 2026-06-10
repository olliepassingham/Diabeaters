import { scheduleNativeAppBadgeSync } from "@/lib/native-app-badge";

/** Dispatched when DM thread list / read state should be re-fetched (e.g. header unread badge). */
export const DM_INBOX_CHANGED = "diabeaters:dm-inbox-changed";

export function notifyDmInboxChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(DM_INBOX_CHANGED));
  scheduleNativeAppBadgeSync(0);
}

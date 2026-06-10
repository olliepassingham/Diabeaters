import { scheduleNativeAppBadgeSync } from "@/lib/native-app-badge";

/** Dispatched when in-app notification rows change so global UI (e.g. header bell) can refetch. */
export const INAPP_NOTIFICATIONS_CHANGED = "diabeaters:inapp-notifications-changed";

export type InAppNotificationsChangedDetail = {
  /** When true, the full /notifications page should not refetch (it already updated local state). */
  skipPageRefresh?: boolean;
};

export function notifyInAppNotificationsChanged(detail?: InAppNotificationsChangedDetail): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(INAPP_NOTIFICATIONS_CHANGED, { detail }));
  scheduleNativeAppBadgeSync(0);
}

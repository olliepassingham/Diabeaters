import type { PushNotificationSchema } from "@capacitor/push-notifications";

import { getPathForInAppNotification } from "@/lib/in-app-notifications-nav";

const PENDING_PUSH_DEEP_LINK_KEY = "diabeaters:pending_push_deep_link";
export const PUSH_DEEP_LINK_PENDING_EVENT = "diabeater:push-deep-link-pending";

export function isSafeInAppPath(path: string): boolean {
  const next = path.trim();
  return Boolean(next) && next.startsWith("/") && !next.startsWith("//");
}

function notificationDataRecord(notification: PushNotificationSchema): Record<string, unknown> {
  if (!notification.data || typeof notification.data !== "object" || Array.isArray(notification.data)) {
    return {};
  }
  return notification.data as Record<string, unknown>;
}

/** Resolve in-app route from push custom data (APNs root keys / FCM data map). */
export function getPathForPushNotificationData(data: Record<string, unknown>): string | null {
  return getPathForInAppNotification({
    id: "",
    user_id: "",
    title: "",
    body: "",
    data,
    created_at: "",
    read: false,
  });
}

export function getPathFromPushNotification(notification: PushNotificationSchema): string | null {
  return getPathForPushNotificationData(notificationDataRecord(notification));
}

export function storePendingPushDeepLink(path: string): void {
  if (!isSafeInAppPath(path)) return;
  try {
    sessionStorage.setItem(PENDING_PUSH_DEEP_LINK_KEY, path.trim());
  } catch {
    // ignore
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(PUSH_DEEP_LINK_PENDING_EVENT));
  }
}

export function consumePendingPushDeepLink(): string | null {
  try {
    const raw = sessionStorage.getItem(PENDING_PUSH_DEEP_LINK_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(PENDING_PUSH_DEEP_LINK_KEY);
    return isSafeInAppPath(raw) ? raw.trim() : null;
  } catch {
    return null;
  }
}

let navigate: ((path: string) => void) | null = null;
let navigationReady = false;

export function setPushDeepLinkNavigationHandler(handler: ((path: string) => void) | null): void {
  navigate = handler;
}

export function setPushDeepLinkNavigationReady(ready: boolean): void {
  navigationReady = ready;
  if (ready && navigate) {
    const pending = consumePendingPushDeepLink();
    if (pending) navigate(pending);
  }
}

export function handlePushDeepLinkFromNotification(notification: PushNotificationSchema): void {
  const path = getPathFromPushNotification(notification);
  if (!path) return;
  storePendingPushDeepLink(path);
  if (navigationReady && navigate) {
    const pending = consumePendingPushDeepLink();
    if (pending) navigate(pending);
  }
}

/** Custom data to attach when re-posting a foreground remote push as a local notification. */
export function extraForPushNotificationDeepLink(notification: PushNotificationSchema): Record<string, unknown> {
  const data = notificationDataRecord(notification);
  const path = getPathForPushNotificationData(data);
  const extra: Record<string, unknown> = {
    source: "remote_push_foreground",
    push_id: notification.id ?? null,
  };
  if (path) extra.deep_link = path;
  if (typeof data.kind === "string") extra.kind = data.kind;
  if (typeof data.thread_id === "string") extra.thread_id = data.thread_id;
  if (typeof data.message_id === "string") extra.message_id = data.message_id;
  return extra;
}

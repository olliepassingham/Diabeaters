import type { PushNotificationSchema } from "@capacitor/push-notifications";

import { carerNameFromCheckInNotification, checkInIdFromNotificationData } from "@/lib/hypo-check-ins";
import { getPathForInAppNotification } from "@/lib/in-app-notifications-nav";
import { DIABEATER_OPEN_HYPO_DIALOG_EVENT, isHypoLogDeepLink } from "@/lib/hypo-check-in-events";
import { requestOpenHypoCheckInRespondSheet } from "@/lib/hypo-check-in-respond-deep-link";
import {
  isNotificationBellDeepLink,
  requestOpenNotificationBell,
  storePendingOpenNotificationBell,
} from "@/lib/notification-inbox-deep-link";
import { applyActiveCarerPatientFromNotification } from "@/lib/carer-session";

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

export function applyPushDeepLinkPath(path: string, navigateTo: (path: string) => void): void {
  if (!isSafeInAppPath(path)) return;
  if (isNotificationBellDeepLink(path)) {
    requestOpenNotificationBell();
    return;
  }
  if (isHypoLogDeepLink(path)) {
    navigateTo(path.trim());
    window.requestAnimationFrame(() => {
      window.dispatchEvent(new Event(DIABEATER_OPEN_HYPO_DIALOG_EVENT));
    });
    return;
  }
  navigateTo(path.trim());
}

export function setPushDeepLinkNavigationReady(ready: boolean): void {
  navigationReady = ready;
  if (ready && navigate) {
    const pending = consumePendingPushDeepLink();
    if (pending) applyPushDeepLinkPath(pending, navigate);
  }
}

export function handlePushDeepLinkFromNotification(notification: PushNotificationSchema): void {
  const data = notificationDataRecord(notification);
  const path = getPathFromPushNotification(notification);
  if (!path) return;

  applyActiveCarerPatientFromNotification(data, path);

  if (data.kind === "hypo_check_in") {
    const checkInId = checkInIdFromNotificationData(data);
    if (checkInId) {
      requestOpenHypoCheckInRespondSheet({
        checkInId,
        carerName: carerNameFromCheckInNotification(data),
      });
    }
  }

  storePendingPushDeepLink(path);
  if (navigationReady && navigate) {
    const pending = consumePendingPushDeepLink();
    if (pending) applyPushDeepLinkPath(pending, navigate);
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
  if (typeof data.patient_user_id === "string") extra.patient_user_id = data.patient_user_id;
  if (typeof data.check_in_id === "string") extra.check_in_id = data.check_in_id;
  if (typeof data.carer_name === "string") extra.carer_name = data.carer_name;
  return extra;
}

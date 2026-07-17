import type { PushNotificationSchema } from "@capacitor/push-notifications";

/** Extract display strings from a Capacitor push payload (incl. custom data fallbacks). */
export function titleBodyFromPushNotification(notification: PushNotificationSchema): {
  title: string;
  body: string;
} {
  const data =
    notification.data && typeof notification.data === "object"
      ? (notification.data as Record<string, unknown>)
      : {};
  const aps =
    data.aps && typeof data.aps === "object" ? (data.aps as Record<string, unknown>) : null;
  const alert = aps?.alert;
  let alertTitle = "";
  let alertBody = "";
  if (alert && typeof alert === "object" && !Array.isArray(alert)) {
    const a = alert as Record<string, unknown>;
    alertTitle = typeof a.title === "string" ? a.title : "";
    alertBody = typeof a.body === "string" ? a.body : "";
  } else if (typeof alert === "string") {
    alertBody = alert;
  }

  const title =
    notification.title?.trim() ||
    alertTitle.trim() ||
    (typeof data.title === "string" ? data.title.trim() : "") ||
    "Diabeaters";
  const body =
    notification.body?.trim() ||
    alertBody.trim() ||
    (typeof data.body === "string" ? data.body.trim() : "") ||
    "You have a new notification";

  return { title, body };
}

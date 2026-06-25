import type { InAppNotificationRow } from "@/lib/carer-notify-types";
import { checkInIdFromNotificationData, setPendingHypoCheckInForLog } from "@/lib/hypo-check-ins";
import { getPathForInAppNotification } from "@/lib/in-app-notifications-nav";
import {
  DIABEATER_OPEN_HYPO_DIALOG_EVENT,
  HYPO_LOG_DEEP_LINK,
  isHypoLogDeepLink,
} from "@/lib/hypo-check-in-events";
import {
  isNotificationBellDeepLink,
  requestOpenNotificationBell,
} from "@/lib/notification-inbox-deep-link";

/** Navigate home and open the hypo log dialog (used by check-in alerts). */
export function requestOpenHypoLogScreen(
  navigate: (path: string) => void,
  options?: { checkInId?: string | null },
): void {
  const checkInId = options?.checkInId?.trim();
  if (checkInId) setPendingHypoCheckInForLog(checkInId);

  const onHomeWithHypoLog =
    typeof window !== "undefined" &&
    window.location.pathname === "/" &&
    new URLSearchParams(window.location.search).get("hypo_log") === "1";

  if (typeof window === "undefined" || window.location.pathname !== "/" || !onHomeWithHypoLog) {
    navigate(HYPO_LOG_DEEP_LINK);
  }

  const open = () => window.dispatchEvent(new Event(DIABEATER_OPEN_HYPO_DIALOG_EVENT));
  if (onHomeWithHypoLog) {
    open();
  } else {
    window.requestAnimationFrame(open);
  }
}

/** Navigate for a tapped in-app notification (handles special cases like hypo check-ins). */
export function navigateForInAppNotification(
  row: InAppNotificationRow,
  navigate: (path: string) => void,
): void {
  const data = row.data && typeof row.data === "object" ? (row.data as Record<string, unknown>) : {};
  const kind = typeof data.kind === "string" ? data.kind : "";

  if (kind === "hypo_check_in") {
    requestOpenHypoLogScreen(navigate, { checkInId: checkInIdFromNotificationData(data) });
    return;
  }

  const path = getPathForInAppNotification(row);
  if (!path) return;

  if (isNotificationBellDeepLink(path)) {
    requestOpenNotificationBell();
    return;
  }

  if (isHypoLogDeepLink(path)) {
    requestOpenHypoLogScreen(navigate);
    return;
  }

  navigate(path);
}

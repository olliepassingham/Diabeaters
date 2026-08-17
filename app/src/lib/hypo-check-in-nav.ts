import type { InAppNotificationRow } from "@/lib/carer-notify-types";
import {
  carerNameFromCheckInNotification,
  checkInIdFromNotificationData,
  glucoseConcernFromNotification,
  setPendingHypoCheckInForLog,
} from "@/lib/hypo-check-ins";
import { getPathForInAppNotification } from "@/lib/in-app-notifications-nav";
import {
  DIABEATER_OPEN_HYPO_DIALOG_EVENT,
  HYPO_LOG_DEEP_LINK,
  isHypoLogDeepLink,
} from "@/lib/hypo-check-in-events";
import { requestOpenHypoCheckInRespondSheet } from "@/lib/hypo-check-in-respond-deep-link";
import {
  isNotificationBellDeepLink,
  requestOpenNotificationBell,
} from "@/lib/notification-inbox-deep-link";
import { applyActiveCarerPatientFromNotification } from "@/lib/carer-session";

/** Navigate home and open the hypo log dialog (used when logging a hypo from a check-in). */
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
    const checkInId = checkInIdFromNotificationData(data);
    navigate("/");
    if (checkInId) {
      const openSheet = () => {
        requestOpenHypoCheckInRespondSheet({
          checkInId,
          carerName: carerNameFromCheckInNotification(data),
          glucoseConcern: glucoseConcernFromNotification(data),
        });
      };
      if (typeof window !== "undefined" && window.location.pathname === "/") {
        openSheet();
      } else {
        window.requestAnimationFrame(openSheet);
      }
    }
    return;
  }

  const path = getPathForInAppNotification(row);
  if (!path) return;

  applyActiveCarerPatientFromNotification(data, path);

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

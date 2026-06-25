import type { InAppNotificationRow } from "@/lib/carer-notify-types";
import { checkInIdFromNotificationData, setPendingHypoCheckInForLog } from "@/lib/hypo-check-ins";
import {
  isNotificationBellDeepLink,
  requestOpenNotificationBell,
} from "@/lib/notification-inbox-deep-link";
import { DIABEATER_OPEN_HYPO_DIALOG_EVENT } from "@/lib/storage";

/** Opens the dashboard hypo log dialog (home + `?hypo_log=1`). */
export const HYPO_LOG_DEEP_LINK = "/?hypo_log=1";

export function isHypoLogDeepLink(path: string): boolean {
  const raw = path.trim();
  if (!raw) return false;
  try {
    const url = new URL(raw, "https://app.diabeaters.local");
    return url.pathname === "/" && url.searchParams.get("hypo_log") === "1";
  } catch {
    return raw === HYPO_LOG_DEEP_LINK;
  }
}

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

/**
 * Resolves the in-app route for a notification row (explicit deep_link or known `data.kind`).
 * Returns null when there is no recognised target (full page leaves you in place; bell may fall back).
 */
export function getPathForInAppNotification(row: InAppNotificationRow): string | null {
  const data = row.data && typeof row.data === "object" ? (row.data as Record<string, unknown>) : {};
  const kind = typeof data.kind === "string" ? data.kind : "";
  const target = typeof data.deep_link === "string" ? data.deep_link.trim() : "";
  if (target && !isNotificationBellDeepLink(target)) {
    if (kind === "hypo_check_in" && (target === "/" || target === "/dashboard")) {
      return HYPO_LOG_DEEP_LINK;
    }
    if (kind === "hypo_logged_self" && (target === "/" || target === "/dashboard")) {
      return "/tools/hypo-history";
    }
    if (target === "/dashboard") return "/";
    return target;
  }

  if (kind === "bedtime_reminder") return "/scenarios/bedtime";
  if (kind === "supplies_low") return "/supplies";
  if (kind === "hypo_logged_self") return "/tools/hypo-history";
  if (kind === "hypo_acknowledged") return "/tools/hypo-history";
  if (kind === "hypo_check_in") return HYPO_LOG_DEEP_LINK;
  if (kind === "hypo_check_in_response") return "/carer-view";
  if (kind === "hypo_logged" || kind === "scenario_started" || kind === "alcohol_night_mode" || kind === "appointment_reminder_support") {
    return "/carer-view";
  }
  if (
    kind === "feed_post_like" ||
    kind === "feed_post_comment" ||
    kind === "feed_post_mention" ||
    kind === "feed_comment_mention"
  ) {
    const postId = typeof data.post_id === "string" ? data.post_id : "";
    return postId ? `/community/post/${postId}` : "/community";
  }
  if (kind === "new_follower") {
    const followerId = typeof data.follower_user_id === "string" ? data.follower_user_id : "";
    return followerId ? `/community/profile/${followerId}` : "/community";
  }
  if (kind === "dm_message") {
    const threadId = typeof data.thread_id === "string" ? data.thread_id : "";
    return threadId ? `/community/messages/${threadId}` : "/community/messages";
  }

  return null;
}

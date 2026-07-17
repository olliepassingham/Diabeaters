import type { InAppNotificationRow } from "@/lib/carer-notify-types";
import { HYPO_LOG_DEEP_LINK } from "@/lib/hypo-check-in-events";
import { isNotificationBellDeepLink, NOTIFICATION_BELL_DEEP_LINK } from "@/lib/notification-inbox-deep-link";

export { HYPO_LOG_DEEP_LINK, isHypoLogDeepLink } from "@/lib/hypo-check-in-events";

function notificationData(row: InAppNotificationRow): Record<string, unknown> {
  return row.data && typeof row.data === "object" ? (row.data as Record<string, unknown>) : {};
}

function pathFromKind(kind: string, data: Record<string, unknown>, bellDeepLink: boolean): string | null {
  if (kind === "bedtime_reminder") return "/scenarios/bedtime";
  if (kind === "appointment_reminder") return "/appointments";
  if (kind === "supplies_low") return bellDeepLink ? "/carer-view" : "/supplies";
  if (kind === "hypo_logged_self") return "/tools/hypo-history";
  if (kind === "hypo_acknowledged") return "/tools/hypo-history";
  if (kind === "hypo_check_in") return "/";
  if (kind === "hypo_check_in_response") return "/carer-view";
  if (
    kind === "hypo_logged" ||
    kind === "scenario_started" ||
    kind === "alcohol_night_mode" ||
    kind === "appointment_reminder_support"
  ) {
    return "/carer-view";
  }
  if (kind === "live_glucose_out_of_range" || kind === "live_glucose_check_in") return "/carer-view/glucose";
  if (kind === "exercise_cgm_alert") return "/scenarios/exercise";
  if (
    kind === "feed_post_like" ||
    kind === "feed_post_comment" ||
    kind === "feed_post_mention" ||
    kind === "feed_comment_mention" ||
    kind === "feed_comment_like"
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

/**
 * Resolves the in-app route for a notification row (explicit deep_link or known `data.kind`).
 * Returns null when there is no recognised target (full page leaves you in place; bell may fall back).
 */
export function getPathForInAppNotification(row: InAppNotificationRow): string | null {
  const data = notificationData(row);
  const kind = typeof data.kind === "string" ? data.kind : "";
  const target = typeof data.deep_link === "string" ? data.deep_link.trim() : "";
  const bellDeepLink = Boolean(target && isNotificationBellDeepLink(target));

  if (target && !bellDeepLink) {
    if (kind === "hypo_logged_self" && (target === "/" || target === "/dashboard")) {
      return "/tools/hypo-history";
    }
    if (target === "/dashboard") return "/";
    return target;
  }

  const byKind = pathFromKind(kind, data, bellDeepLink);
  if (byKind) return byKind;

  if (bellDeepLink) return NOTIFICATION_BELL_DEEP_LINK;

  return null;
}

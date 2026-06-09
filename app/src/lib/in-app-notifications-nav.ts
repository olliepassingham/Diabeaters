import type { InAppNotificationRow } from "@/lib/carer-notify-types";

/**
 * Resolves the in-app route for a notification row (explicit deep_link or known `data.kind`).
 * Returns null when there is no recognised target (full page leaves you in place; bell may fall back).
 */
export function getPathForInAppNotification(row: InAppNotificationRow): string | null {
  const data = row.data && typeof row.data === "object" ? (row.data as Record<string, unknown>) : {};
  const kind = typeof data.kind === "string" ? data.kind : "";
  const target = typeof data.deep_link === "string" ? data.deep_link.trim() : "";
  if (target) {
    if (kind === "hypo_logged_self" && (target === "/" || target === "/dashboard")) {
      return "/tools/hypo-history";
    }
    if (target === "/dashboard") return "/";
    return target;
  }

  if (kind === "bedtime_reminder") return "/scenarios/bedtime";
  if (kind === "supplies_low") return "/supplies";
  if (kind === "hypo_logged_self") return "/tools/hypo-history";
  if (kind === "hypo_logged" || kind === "scenario_started" || kind === "appointment_reminder_support") {
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

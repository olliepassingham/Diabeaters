import type { InAppNotificationRow } from "@/lib/carer-notify-types";

/** Two-letter style initials for avatars. */
export function initialsFromDisplayName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] ?? "?";
  const b = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";
  return (a + b).toUpperCase();
}

export function notificationKind(row: InAppNotificationRow): string {
  const d = row.data && typeof row.data === "object" ? (row.data as Record<string, unknown>) : {};
  return typeof d.kind === "string" ? d.kind : "";
}

/** DM alerts use the messages inbox badge; hide them from the notification bell and `/notifications`. */
export function isDmMessageInAppNotification(row: InAppNotificationRow): boolean {
  return notificationKind(row) === "dm_message";
}

/**
 * Profile id to load for avatar + display name (DM sender or community feed actor).
 */
export function profileUserIdForInAppNotification(row: InAppNotificationRow): string | null {
  const d = row.data && typeof row.data === "object" ? (row.data as Record<string, unknown>) : {};
  const kind = typeof d.kind === "string" ? d.kind : "";
  if (kind === "dm_message" && typeof d.sender_user_id === "string" && d.sender_user_id.trim()) {
    return d.sender_user_id;
  }
  if (
    (kind === "feed_post_like" ||
      kind === "feed_post_comment" ||
      kind === "feed_post_mention" ||
      kind === "feed_comment_mention") &&
    typeof d.actor_user_id === "string" &&
    d.actor_user_id.trim()
  ) {
    return d.actor_user_id;
  }
  if (kind === "hypo_check_in" && typeof d.carer_id === "string" && d.carer_id.trim()) {
    return d.carer_id;
  }
  return null;
}

export function collectProfileUserIdsForNotifications(rows: InAppNotificationRow[]): string[] {
  return [
    ...new Set(rows.map(profileUserIdForInAppNotification).filter((id): id is string => Boolean(id))),
  ];
}

/** Primary line: person name when we have a profile row; otherwise notification title. */
export function primaryLineForNotification(
  row: InAppNotificationRow,
  meta: { name: string } | undefined,
): string {
  if (meta?.name?.trim()) return meta.name.trim();
  const id = profileUserIdForInAppNotification(row);
  if (id) return row.title?.trim() || "Direct message";
  return row.title?.trim() || "Notification";
}

export function showsProfileAvatar(row: InAppNotificationRow): boolean {
  return profileUserIdForInAppNotification(row) != null;
}

/** Short subtitle: prefer notification title when primary line is a person name. */
export function subtitleForNotification(
  row: InAppNotificationRow,
  meta: { name: string } | undefined,
): string | null {
  const body = row.body?.trim();
  if (body) return body;
  const title = row.title?.trim();
  if (meta?.name?.trim() && title && title !== meta.name.trim()) return title;
  return null;
}

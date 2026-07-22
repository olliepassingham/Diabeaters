import type { DmMessageRow } from "@/lib/community/types";

type DmActionMessage = Pick<
  DmMessageRow,
  "sender_id" | "read_at" | "deleted_at" | "body" | "image_storage_path" | "edited_at"
>;

function isOwnUnreadActive(message: DmActionMessage, viewerId: string): boolean {
  if (!viewerId || message.sender_id !== viewerId) return false;
  if (message.deleted_at) return false;
  return message.read_at == null;
}

/** True when the viewer can unsend this message (own message, still unread, not already deleted). */
export function canDeleteUnreadDmMessage(message: DmActionMessage, viewerId: string): boolean {
  return isOwnUnreadActive(message, viewerId);
}

/**
 * True when the viewer can edit this message's text while it is still unread.
 * Shared post/story cards and image-only messages are excluded — there is no plain text to edit.
 */
export function canEditUnreadDmMessage(
  message: DmActionMessage,
  viewerId: string,
  options?: { isSharedContent?: boolean },
): boolean {
  if (!isOwnUnreadActive(message, viewerId)) return false;
  if (options?.isSharedContent) return false;
  return Boolean(message.body?.trim());
}

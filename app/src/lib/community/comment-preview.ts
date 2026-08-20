/** Short preview for comment notifications (push + in-app). */
export function commentNotificationPreview(body: string, hasImage: boolean): string {
  const trimmed = body.trim();
  if (trimmed) {
    return trimmed.length > 120 ? `${trimmed.slice(0, 120)}…` : trimmed;
  }
  return hasImage ? "sent a photo" : "commented on your post";
}

import type { InAppNotificationRow } from "@/lib/carer-notify-types";
import { countUnreadDmThreadsForCurrentUser } from "@/lib/community/dm-supabase";
import { isDmMessageInAppNotification } from "@/lib/in-app-notification-display";
import { getSupabase } from "@/lib/supabase";

/** Unread in-app rows that appear in the bell (excludes DM message rows). */
export function countUnreadInAppExcludingDmFromRows(rows: InAppNotificationRow[]): number {
  return rows.filter((r) => !r.read && !isDmMessageInAppNotification(r)).length;
}

/**
 * Home-screen badge = unread bell notifications + unread DM conversations
 * (same split as the header bell vs Messages link).
 */
export function nativeAppBadgeCountFromParts(inAppUnread: number, dmThreadUnread: number): number {
  return Math.max(0, inAppUnread) + Math.max(0, dmThreadUnread);
}

export async function countUnreadInAppNotificationsExcludingDm(): Promise<{
  count: number;
  error: Error | null;
}> {
  const supabase = getSupabase();
  if (!supabase) return { count: 0, error: new Error("Supabase not configured") };

  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData.session?.user?.id;
  if (!uid) return { count: 0, error: null };

  const unreadQuery = () =>
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", uid)
      .eq("read", false);

  const [allRes, dmRes] = await Promise.all([
    unreadQuery(),
    unreadQuery().filter("data->>kind", "eq", "dm_message"),
  ]);

  if (allRes.error) return { count: 0, error: new Error(allRes.error.message) };
  if (dmRes.error) return { count: 0, error: new Error(dmRes.error.message) };

  const totalUnread = allRes.count ?? 0;
  const dmUnread = dmRes.count ?? 0;
  return { count: Math.max(0, totalUnread - dmUnread), error: null };
}

export async function fetchNativeAppBadgeCount(): Promise<{ count: number; error: Error | null }> {
  const [inAppRes, dmRes] = await Promise.all([
    countUnreadInAppNotificationsExcludingDm(),
    countUnreadDmThreadsForCurrentUser(),
  ]);

  if (inAppRes.error) return { count: 0, error: inAppRes.error };
  if (dmRes.error) return { count: 0, error: dmRes.error };

  return {
    count: nativeAppBadgeCountFromParts(inAppRes.count, dmRes.count),
    error: null,
  };
}

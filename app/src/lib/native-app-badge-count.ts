import type { InAppNotificationRow } from "@/lib/carer-notify-types";
import { countUnreadDmThreadsForCurrentUser } from "@/lib/community/dm-supabase";
import { includeDmThreadsInHomeScreenBadge } from "@/lib/flags";
import { isDmMessageInAppNotification } from "@/lib/in-app-notification-display";
import { getSupabase } from "@/lib/supabase";

export { includeDmThreadsInHomeScreenBadge };

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

export type HeaderUnreadCounts = {
  bell: number;
  dmThreads: number;
  total: number;
};

export async function fetchHeaderUnreadCounts(options?: {
  includeDmThreads?: boolean;
}): Promise<{ counts: HeaderUnreadCounts; error: Error | null }> {
  const includeDm = options?.includeDmThreads ?? includeDmThreadsInHomeScreenBadge();

  const inAppRes = await countUnreadInAppNotificationsExcludingDm();
  if (inAppRes.error) return { counts: { bell: 0, dmThreads: 0, total: 0 }, error: inAppRes.error };

  let dmThreads = 0;
  if (includeDm) {
    const dmRes = await countUnreadDmThreadsForCurrentUser();
    if (dmRes.error) return { counts: { bell: 0, dmThreads: 0, total: 0 }, error: dmRes.error };
    dmThreads = dmRes.count;
  }

  return {
    counts: {
      bell: inAppRes.count,
      dmThreads,
      total: nativeAppBadgeCountFromParts(inAppRes.count, dmThreads),
    },
    error: null,
  };
}

export async function fetchNativeAppBadgeCount(): Promise<{ count: number; error: Error | null }> {
  const { counts, error } = await fetchHeaderUnreadCounts();
  if (error) return { count: 0, error };
  return { count: counts.total, error: null };
}

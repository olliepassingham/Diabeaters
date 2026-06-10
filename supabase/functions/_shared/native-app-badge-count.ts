/**
 * Home-screen badge count for push payloads (service role).
 * Mirrors app/src/lib/native-app-badge-count.ts: unread bell rows + unread DM threads.
 */
import { createClient } from "jsr:@supabase/supabase-js@2";

type SupabaseAdmin = ReturnType<typeof createClient>;

export function notificationKindFromData(data: unknown): string {
  const d = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  return typeof d.kind === "string" ? d.kind : "";
}

export function isDmMessageKind(data: unknown): boolean {
  return notificationKindFromData(data) === "dm_message";
}

/** Unread in-app rows that appear in the bell (excludes DM message rows). */
export function countUnreadInAppExcludingDmFromRows(
  rows: Array<{ read?: boolean; data?: unknown }>,
): number {
  return rows.filter((r) => !r.read && !isDmMessageKind(r.data)).length;
}

export function nativeAppBadgeCountFromParts(inAppUnread: number, dmThreadUnread: number): number {
  return Math.max(0, inAppUnread) + Math.max(0, dmThreadUnread);
}

export async function countUnreadInAppNotificationsExcludingDm(
  admin: SupabaseAdmin,
  userId: string,
): Promise<{ count: number; error: string | null }> {
  const unreadQuery = () =>
    admin
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("read", false);

  const [allRes, dmRes] = await Promise.all([
    unreadQuery(),
    unreadQuery().filter("data->>kind", "eq", "dm_message"),
  ]);

  if (allRes.error) return { count: 0, error: allRes.error.message };
  if (dmRes.error) return { count: 0, error: dmRes.error.message };

  const totalUnread = allRes.count ?? 0;
  const dmUnread = dmRes.count ?? 0;
  return { count: Math.max(0, totalUnread - dmUnread), error: null };
}

/**
 * Threads where the latest message is from someone else and still unread,
 * excluding conversations hidden in dm_thread_user_settings (not local-only hidden).
 */
export async function countUnreadDmThreadsForUser(
  admin: SupabaseAdmin,
  userId: string,
): Promise<{ count: number; error: string | null }> {
  const { data: rpcData, error: rpcErr } = await admin.rpc("count_unread_dm_threads_for_user", {
    p_user_id: userId,
  });

  if (!rpcErr) {
    const n = typeof rpcData === "number" ? rpcData : Number(rpcData ?? 0);
    return { count: Number.isFinite(n) ? Math.max(0, n) : 0, error: null };
  }

  // Fallback before migration is applied.
  if (rpcErr.message && !rpcErr.message.includes("count_unread_dm_threads_for_user")) {
    console.warn("[native-app-badge-count] dm rpc failed, using fallback:", rpcErr.message);
  }

  const { data: memberRows, error: memErr } = await admin
    .from("dm_thread_members")
    .select("thread_id")
    .eq("user_id", userId);

  if (memErr) return { count: 0, error: memErr.message };

  const threadIds = (memberRows ?? []).map((r: { thread_id: string }) => String(r.thread_id));
  if (threadIds.length === 0) return { count: 0, error: null };

  const { data: hiddenRows, error: hiddenErr } = await admin
    .from("dm_thread_user_settings")
    .select("thread_id")
    .eq("user_id", userId)
    .eq("hidden", true);

  let hidden = new Set<string>();
  if (hiddenErr) {
    const msg = hiddenErr.message.toLowerCase();
    if (!msg.includes("dm_thread_user_settings") && !msg.includes("does not exist")) {
      return { count: 0, error: hiddenErr.message };
    }
  } else {
    hidden = new Set((hiddenRows ?? []).map((r: { thread_id: string }) => String(r.thread_id)));
  }
  const visibleIds = threadIds.filter((id) => !hidden.has(id));
  if (visibleIds.length === 0) return { count: 0, error: null };

  const { data: messages, error: msgErr } = await admin
    .from("dm_messages")
    .select("thread_id, sender_id, read_at, created_at, id")
    .in("thread_id", visibleIds)
    .order("created_at", { ascending: false });

  if (msgErr) return { count: 0, error: msgErr.message };

  const latestByThread = new Map<string, { sender_id: string; read_at: string | null }>();
  for (const row of messages ?? []) {
    const tid = String((row as { thread_id: string }).thread_id);
    if (!latestByThread.has(tid)) {
      latestByThread.set(tid, {
        sender_id: String((row as { sender_id: string }).sender_id),
        read_at: (row as { read_at: string | null }).read_at,
      });
    }
  }

  let count = 0;
  for (const m of latestByThread.values()) {
    if (m.sender_id !== userId && m.read_at == null) count += 1;
  }

  return { count, error: null };
}

export async function fetchNativeAppBadgeCountForUser(
  admin: SupabaseAdmin,
  userId: string,
): Promise<{ count: number; error: string | null }> {
  const [inAppRes, dmRes] = await Promise.all([
    countUnreadInAppNotificationsExcludingDm(admin, userId),
    countUnreadDmThreadsForUser(admin, userId),
  ]);

  if (inAppRes.error) return { count: 0, error: inAppRes.error };
  if (dmRes.error) return { count: 0, error: dmRes.error };

  return {
    count: nativeAppBadgeCountFromParts(inAppRes.count, dmRes.count),
    error: null,
  };
}

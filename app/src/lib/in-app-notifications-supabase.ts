/**
 * In-app notification rows from `public.notifications` (carer inbox).
 */
import { getSupabase } from "./supabase";
import type { InAppNotificationRow } from "./carer-notify-types";

function mapRow(row: Record<string, unknown>): InAppNotificationRow {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    title: String(row.title ?? ""),
    body: String(row.body ?? ""),
    data: (row.data && typeof row.data === "object" ? row.data : {}) as InAppNotificationRow["data"],
    created_at: String(row.created_at),
    read: Boolean(row.read),
  };
}

export async function fetchInAppNotificationsForUser(): Promise<{
  data: InAppNotificationRow[] | null;
  error: Error | null;
}> {
  const supabase = getSupabase();
  if (!supabase) return { data: null, error: new Error("Supabase not configured") };

  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData.session?.user?.id;
  if (!uid) return { data: [], error: null };

  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", uid)
    .order("created_at", { ascending: false })
    .limit(40);

  if (error) return { data: null, error: new Error(error.message) };
  return { data: (data ?? []).map((r) => mapRow(r as Record<string, unknown>)), error: null };
}

export async function markInAppNotificationRead(id: string): Promise<{ error: Error | null }> {
  const supabase = getSupabase();
  if (!supabase) return { error: new Error("Supabase not configured") };

  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData.session?.user?.id;
  if (!uid) return { error: new Error("Not signed in") };

  const { error } = await supabase.from("notifications").update({ read: true }).eq("id", id).eq("user_id", uid);

  if (error) return { error: new Error(error.message) };
  return { error: null };
}

export async function markAllInAppNotificationsRead(): Promise<{ error: Error | null }> {
  const supabase = getSupabase();
  if (!supabase) return { error: new Error("Supabase not configured") };

  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData.session?.user?.id;
  if (!uid) return { error: new Error("Not signed in") };

  const { error } = await supabase.from("notifications").update({ read: true }).eq("user_id", uid).eq("read", false);

  if (error) return { error: new Error(error.message) };
  return { error: null };
}

/** Removes all in-app notification rows for the current user. Prefer RPC (works without client DELETE RLS). */
export async function deleteAllInAppNotificationsForUser(): Promise<{ error: Error | null }> {
  const supabase = getSupabase();
  if (!supabase) return { error: new Error("Supabase not configured") };

  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData.session?.user?.id;
  if (!uid) return { error: new Error("Not signed in") };

  const { error: rpcError } = await supabase.rpc("clear_my_notifications");
  if (!rpcError) return { error: null };

  const { error: delError } = await supabase.from("notifications").delete().eq("user_id", uid);
  if (!delError) return { error: null };

  return {
    error: new Error(
      [rpcError.message, delError.message].filter(Boolean).join(" · ") || "Could not clear notifications",
    ),
  };
}

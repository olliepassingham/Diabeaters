/**
 * Blocks: user_blocks (Supabase + RLS). Feeds hide blocked users via RLS; DMs blocked on send and get_or_create_dm_thread.
 */
import { getSupabase } from "@/lib/supabase";

export type BlockStatus = { iBlockedThem: boolean; theyBlockedMe: boolean };

export async function getBlockStatus(otherUserId: string): Promise<{
  status: BlockStatus;
  error: Error | null;
}> {
  const supabase = getSupabase();
  if (!supabase) {
    return {
      status: { iBlockedThem: false, theyBlockedMe: false },
      error: new Error("Supabase not configured"),
    };
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData.session?.user?.id;
  if (!uid) {
    return { status: { iBlockedThem: false, theyBlockedMe: false }, error: null };
  }

  const { data: row1, error: e1 } = await supabase
    .from("user_blocks")
    .select("blocker_id")
    .eq("blocker_id", uid)
    .eq("blocked_id", otherUserId)
    .maybeSingle();

  const { data: row2, error: e2 } = await supabase
    .from("user_blocks")
    .select("blocker_id")
    .eq("blocker_id", otherUserId)
    .eq("blocked_id", uid)
    .maybeSingle();

  const err = e1 ?? e2;
  if (err) {
    return {
      status: { iBlockedThem: false, theyBlockedMe: false },
      error: new Error(err.message),
    };
  }

  return {
    status: { iBlockedThem: !!row1, theyBlockedMe: !!row2 },
    error: null,
  };
}

export async function blockUser(blockedId: string): Promise<{ error: Error | null }> {
  const supabase = getSupabase();
  if (!supabase) return { error: new Error("Supabase not configured") };

  const { data: sessionData } = await supabase.auth.getSession();
  const me = sessionData.session?.user?.id;
  if (!me) return { error: new Error("Not signed in") };
  if (blockedId === me) return { error: new Error("Invalid") };

  const { error } = await supabase.from("user_blocks").insert({ blocker_id: me, blocked_id: blockedId });
  if (error) return { error: new Error(error.message) };
  return { error: null };
}

export async function listBlockRelatedUserIdsForCurrentUser(): Promise<{
  ids: Set<string>;
  error: Error | null;
}> {
  const supabase = getSupabase();
  if (!supabase) return { ids: new Set(), error: new Error("Supabase not configured") };

  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData.session?.user?.id;
  if (!uid) return { ids: new Set(), error: null };

  const out = new Set<string>();

  const { data: blockedByMe, error: e1 } = await supabase
    .from("user_blocks")
    .select("blocked_id")
    .eq("blocker_id", uid);
  if (e1) return { ids: new Set(), error: new Error(e1.message) };
  for (const row of blockedByMe ?? []) {
    const id = (row as { blocked_id: string }).blocked_id;
    if (id) out.add(String(id));
  }

  const { data: blockers, error: e2 } = await supabase
    .from("user_blocks")
    .select("blocker_id")
    .eq("blocked_id", uid);
  if (e2) return { ids: new Set(), error: new Error(e2.message) };
  for (const row of blockers ?? []) {
    const id = (row as { blocker_id: string }).blocker_id;
    if (id) out.add(String(id));
  }

  return { ids: out, error: null };
}

export async function unblockUser(blockedId: string): Promise<{ error: Error | null }> {
  const supabase = getSupabase();
  if (!supabase) return { error: new Error("Supabase not configured") };

  const { data: sessionData } = await supabase.auth.getSession();
  const me = sessionData.session?.user?.id;
  if (!me) return { error: new Error("Not signed in") };

  const { error } = await supabase.from("user_blocks").delete().eq("blocker_id", me).eq("blocked_id", blockedId);

  if (error) return { error: new Error(error.message) };
  return { error: null };
}

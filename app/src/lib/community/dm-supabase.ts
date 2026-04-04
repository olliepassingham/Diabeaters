/**
 * Direct messages: dm_threads, dm_thread_members, dm_messages (Supabase + RLS).
 */
import { getSupabase } from "@/lib/supabase";
import type { DmMessageRow, DmThreadMemberRow, DmThreadRow } from "./types";

function mapThread(r: Record<string, unknown>): DmThreadRow {
  return {
    id: String(r.id),
    created_at: String(r.created_at ?? ""),
    updated_at: String(r.updated_at ?? ""),
  };
}

function mapMember(r: Record<string, unknown>): DmThreadMemberRow {
  return {
    thread_id: String(r.thread_id),
    user_id: String(r.user_id),
    joined_at: String(r.joined_at ?? ""),
  };
}

function mapMessage(r: Record<string, unknown>): DmMessageRow {
  return {
    id: String(r.id),
    thread_id: String(r.thread_id),
    sender_id: String(r.sender_id),
    body: String(r.body ?? ""),
    created_at: String(r.created_at ?? ""),
    read_at: r.read_at == null ? null : String(r.read_at),
  };
}

export async function getOrCreateDmThread(otherUserId: string): Promise<{
  data: string | null;
  error: Error | null;
}> {
  const supabase = getSupabase();
  if (!supabase) return { data: null, error: new Error("Supabase not configured") };

  const { data, error } = await supabase.rpc("get_or_create_dm_thread", {
    p_other_user: otherUserId,
  });

  if (error) return { data: null, error: new Error(error.message) };
  if (data == null) return { data: null, error: new Error("No thread id returned") };
  return { data: String(data), error: null };
}

export type ThreadWithMembers = DmThreadRow & { members: DmThreadMemberRow[] };

export async function fetchDmThreadsForCurrentUser(): Promise<{
  data: ThreadWithMembers[] | null;
  error: Error | null;
}> {
  const supabase = getSupabase();
  if (!supabase) return { data: null, error: new Error("Supabase not configured") };

  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData.session?.user?.id;
  if (!uid) return { data: null, error: new Error("Not signed in") };

  const { data: myMemberships, error: mErr } = await supabase
    .from("dm_thread_members")
    .select("thread_id")
    .eq("user_id", uid);

  if (mErr) return { data: null, error: new Error(mErr.message) };

  const threadIds = [...new Set((myMemberships ?? []).map((r) => String((r as { thread_id: string }).thread_id)))];
  if (threadIds.length === 0) return { data: [], error: null };

  const { data: threads, error: tErr } = await supabase
    .from("dm_threads")
    .select("*")
    .in("id", threadIds)
    .order("updated_at", { ascending: false });

  if (tErr) return { data: null, error: new Error(tErr.message) };

  const withMembers: ThreadWithMembers[] = [];

  for (const t of threads ?? []) {
    const tr = mapThread(t as Record<string, unknown>);
    const { data: mems, error: memErr } = await supabase.from("dm_thread_members").select("*").eq("thread_id", tr.id);

    if (memErr) return { data: null, error: new Error(memErr.message) };
    const members = (mems ?? []).map((m) => mapMember(m as Record<string, unknown>));
    withMembers.push({ ...tr, members });
  }

  return { data: withMembers, error: null };
}

export async function fetchDmMessages(threadId: string): Promise<{
  data: DmMessageRow[] | null;
  error: Error | null;
}> {
  const supabase = getSupabase();
  if (!supabase) return { data: null, error: new Error("Supabase not configured") };

  const { data, error } = await supabase
    .from("dm_messages")
    .select("*")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });

  if (error) return { data: null, error: new Error(error.message) };
  return { data: (data ?? []).map((r) => mapMessage(r as Record<string, unknown>)), error: null };
}

/** Latest message per thread (parallel queries; empty threads map to null). */
export async function fetchLatestDmMessageForThreads(threadIds: string[]): Promise<{
  data: Map<string, DmMessageRow | null>;
  error: Error | null;
}> {
  const supabase = getSupabase();
  if (!supabase) {
    return { data: new Map(), error: new Error("Supabase not configured") };
  }
  if (threadIds.length === 0) return { data: new Map(), error: null };

  const results = await Promise.all(
    threadIds.map(async (tid) => {
      const { data, error } = await supabase
        .from("dm_messages")
        .select("*")
        .eq("thread_id", tid)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) return { tid, err: new Error(error.message), row: null as DmMessageRow | null };
      if (!data) return { tid, err: null, row: null };
      return { tid, err: null, row: mapMessage(data as Record<string, unknown>) };
    }),
  );

  const failed = results.find((r) => r.err);
  if (failed?.err) return { data: new Map(), error: failed.err };

  const map = new Map<string, DmMessageRow | null>();
  for (const r of results) {
    map.set(r.tid, r.row);
  }
  return { data: map, error: null };
}

export async function insertDmMessage(threadId: string, body: string): Promise<{
  data: DmMessageRow | null;
  error: Error | null;
}> {
  const supabase = getSupabase();
  if (!supabase) return { data: null, error: new Error("Supabase not configured") };

  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData.session?.user?.id;
  if (!uid) return { data: null, error: new Error("Not signed in") };

  const trimmed = body.trim();
  if (!trimmed) return { data: null, error: new Error("Message cannot be empty") };

  const { data, error } = await supabase
    .from("dm_messages")
    .insert({ thread_id: threadId, sender_id: uid, body: trimmed })
    .select("*")
    .single();

  if (error) return { data: null, error: new Error(error.message) };
  if (!data) return { data: null, error: new Error("No row returned") };
  return { data: mapMessage(data as Record<string, unknown>), error: null };
}

/** Other participant in a 1:1 thread (for display). */
export function otherMemberUserId(members: DmThreadMemberRow[], currentUserId: string): string | null {
  const other = members.find((m) => m.user_id !== currentUserId);
  return other?.user_id ?? null;
}

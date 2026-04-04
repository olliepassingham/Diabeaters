/**
 * Timeline: community_posts + community_post_comments (Supabase + RLS).
 * Push/in-app notifications for new posts or DMs: deferred — see docs/sql/community_social_v2.sql header.
 */
import { getSupabase } from "@/lib/supabase";
import { listFolloweeIdsForCurrentUser } from "./follows-supabase";
import type { CommunityPostCommentRow, CommunityPostRow } from "./types";

function mapPost(r: Record<string, unknown>): CommunityPostRow {
  return {
    id: String(r.id),
    author_id: String(r.author_id),
    body: String(r.body ?? ""),
    created_at: String(r.created_at ?? ""),
  };
}

function mapComment(r: Record<string, unknown>): CommunityPostCommentRow {
  return {
    id: String(r.id),
    post_id: String(r.post_id),
    author_id: String(r.author_id),
    body: String(r.body ?? ""),
    created_at: String(r.created_at ?? ""),
  };
}

export async function fetchCommunityPosts(limit = 40): Promise<{
  data: CommunityPostRow[] | null;
  error: Error | null;
}> {
  const supabase = getSupabase();
  if (!supabase) return { data: null, error: new Error("Supabase not configured") };

  const { data, error } = await supabase
    .from("community_posts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return { data: null, error: new Error(error.message) };
  return { data: (data ?? []).map((r) => mapPost(r as Record<string, unknown>)), error: null };
}

/** Posts from people you follow plus your own (RLS still applies for blocks). */
export async function fetchCommunityPostsFromFollowing(limit = 40): Promise<{
  data: CommunityPostRow[] | null;
  error: Error | null;
}> {
  const supabase = getSupabase();
  if (!supabase) return { data: null, error: new Error("Supabase not configured") };

  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData.session?.user?.id;
  if (!uid) return { data: null, error: new Error("Not signed in") };

  const { ids: followeeIds, error: fErr } = await listFolloweeIdsForCurrentUser();
  if (fErr) return { data: null, error: fErr };

  const authorIds = [...new Set([uid, ...followeeIds])];

  const { data, error } = await supabase
    .from("community_posts")
    .select("*")
    .in("author_id", authorIds)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return { data: null, error: new Error(error.message) };
  return { data: (data ?? []).map((r) => mapPost(r as Record<string, unknown>)), error: null };
}

export async function insertCommunityPost(body: string): Promise<{
  data: CommunityPostRow | null;
  error: Error | null;
}> {
  const supabase = getSupabase();
  if (!supabase) return { data: null, error: new Error("Supabase not configured") };

  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData.session?.user?.id;
  if (!uid) return { data: null, error: new Error("Not signed in") };

  const trimmed = body.trim();
  if (!trimmed) return { data: null, error: new Error("Post cannot be empty") };

  const { data, error } = await supabase
    .from("community_posts")
    .insert({ author_id: uid, body: trimmed })
    .select("*")
    .single();

  if (error) return { data: null, error: new Error(error.message) };
  if (!data) return { data: null, error: new Error("No row returned") };
  return { data: mapPost(data as Record<string, unknown>), error: null };
}

export async function fetchCommentsForPost(postId: string): Promise<{
  data: CommunityPostCommentRow[] | null;
  error: Error | null;
}> {
  const supabase = getSupabase();
  if (!supabase) return { data: null, error: new Error("Supabase not configured") };

  const { data, error } = await supabase
    .from("community_post_comments")
    .select("*")
    .eq("post_id", postId)
    .order("created_at", { ascending: true });

  if (error) return { data: null, error: new Error(error.message) };
  return { data: (data ?? []).map((r) => mapComment(r as Record<string, unknown>)), error: null };
}

export async function insertCommunityComment(postId: string, body: string): Promise<{
  data: CommunityPostCommentRow | null;
  error: Error | null;
}> {
  const supabase = getSupabase();
  if (!supabase) return { data: null, error: new Error("Supabase not configured") };

  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData.session?.user?.id;
  if (!uid) return { data: null, error: new Error("Not signed in") };

  const trimmed = body.trim();
  if (!trimmed) return { data: null, error: new Error("Comment cannot be empty") };

  const { data, error } = await supabase
    .from("community_post_comments")
    .insert({ post_id: postId, author_id: uid, body: trimmed })
    .select("*")
    .single();

  if (error) return { data: null, error: new Error(error.message) };
  if (!data) return { data: null, error: new Error("No row returned") };
  return { data: mapComment(data as Record<string, unknown>), error: null };
}

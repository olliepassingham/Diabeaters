/**
 * Follow graph: user_follows (Supabase + RLS).
 */
import { getSupabase } from "@/lib/supabase";

export async function followUser(followeeId: string): Promise<{ error: Error | null }> {
  const supabase = getSupabase();
  if (!supabase) return { error: new Error("Supabase not configured") };

  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData.session?.user?.id;
  if (!uid) return { error: new Error("Not signed in") };
  if (followeeId === uid) return { error: new Error("Cannot follow yourself") };

  const { error } = await supabase.from("user_follows").insert({ follower_id: uid, followee_id: followeeId });
  if (error) return { error: new Error(error.message) };
  return { error: null };
}

export async function unfollowUser(followeeId: string): Promise<{ error: Error | null }> {
  const supabase = getSupabase();
  if (!supabase) return { error: new Error("Supabase not configured") };

  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData.session?.user?.id;
  if (!uid) return { error: new Error("Not signed in") };

  const { error } = await supabase
    .from("user_follows")
    .delete()
    .eq("follower_id", uid)
    .eq("followee_id", followeeId);

  if (error) return { error: new Error(error.message) };
  return { error: null };
}

export async function isFollowing(followeeId: string): Promise<{ value: boolean; error: Error | null }> {
  const supabase = getSupabase();
  if (!supabase) return { value: false, error: new Error("Supabase not configured") };

  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData.session?.user?.id;
  if (!uid) return { value: false, error: null };

  const { data, error } = await supabase
    .from("user_follows")
    .select("follower_id")
    .eq("follower_id", uid)
    .eq("followee_id", followeeId)
    .maybeSingle();

  if (error) return { value: false, error: new Error(error.message) };
  return { value: !!data, error: null };
}

export async function listFolloweeIdsForCurrentUser(): Promise<{ ids: string[]; error: Error | null }> {
  const supabase = getSupabase();
  if (!supabase) return { ids: [], error: new Error("Supabase not configured") };

  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData.session?.user?.id;
  if (!uid) return { ids: [], error: new Error("Not signed in") };

  const { data, error } = await supabase
    .from("user_follows")
    .select("followee_id")
    .eq("follower_id", uid);

  if (error) return { ids: [], error: new Error(error.message) };
  const ids = (data ?? []).map((r) => String((r as { followee_id: string }).followee_id));
  return { ids, error: null };
}

export async function listFollowers(
  userId: string,
  limit = 200,
): Promise<{ ids: string[]; error: Error | null }> {
  const supabase = getSupabase();
  if (!supabase) return { ids: [], error: new Error("Supabase not configured") };

  const { data, error } = await supabase
    .from("user_follows")
    .select("follower_id")
    .eq("followee_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return { ids: [], error: new Error(error.message) };
  const ids = (data ?? []).map((r) => String((r as { follower_id: string }).follower_id));
  return { ids, error: null };
}

export async function listFollowing(
  userId: string,
  limit = 200,
): Promise<{ ids: string[]; error: Error | null }> {
  const supabase = getSupabase();
  if (!supabase) return { ids: [], error: new Error("Supabase not configured") };

  const { data, error } = await supabase
    .from("user_follows")
    .select("followee_id")
    .eq("follower_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return { ids: [], error: new Error(error.message) };
  const ids = (data ?? []).map((r) => String((r as { followee_id: string }).followee_id));
  return { ids, error: null };
}

export async function getFollowCounts(userId: string): Promise<{
  followers: number;
  following: number;
  error: Error | null;
}> {
  const supabase = getSupabase();
  if (!supabase) {
    return { followers: 0, following: 0, error: new Error("Supabase not configured") };
  }

  const { count: followers, error: e1 } = await supabase
    .from("user_follows")
    .select("*", { count: "exact", head: true })
    .eq("followee_id", userId);

  const { count: following, error: e2 } = await supabase
    .from("user_follows")
    .select("*", { count: "exact", head: true })
    .eq("follower_id", userId);

  const err = e1 ?? e2;
  if (err) return { followers: 0, following: 0, error: new Error(err.message) };
  return { followers: followers ?? 0, following: following ?? 0, error: null };
}

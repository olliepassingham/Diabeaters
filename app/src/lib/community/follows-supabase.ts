/**
 * Follow graph: user_follows (Supabase + RLS).
 */
import { logEdgeInvokeFailure } from "@/lib/dev-log";
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

  // The DB trigger inserts the in-app notification; this edge call sends iOS push when enabled.
  void supabase.functions
    .invoke("notify_feed_push", { body: { kind: "new_follower", followee_id: followeeId } })
    .then(({ error: fnErr }) => {
      if (fnErr) logEdgeInvokeFailure("notify_feed_push new_follower", fnErr.message);
    });

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

  const { data, error } = await supabase.rpc("public_follow_counts", { p_user_id: userId });
  if (error) {
    return { followers: 0, following: 0, error: new Error(error.message) };
  }
  const row = data as { followers?: unknown; following?: unknown } | null;
  const followers =
    typeof row?.followers === "number"
      ? row.followers
      : typeof row?.followers === "string"
        ? Number(row.followers)
        : Number(row?.followers);
  const following =
    typeof row?.following === "number"
      ? row.following
      : typeof row?.following === "string"
        ? Number(row.following)
        : Number(row?.following);
  return {
    followers: Number.isFinite(followers) ? followers : 0,
    following: Number.isFinite(following) ? following : 0,
    error: null,
  };
}

import {
  fetchCommunityPostsPage,
  listFolloweeIdsForCurrentUser,
} from "@/lib/community";
import { getProfilesByIds, type ProfileRow } from "@/lib/profile";
import { getSupabase } from "@/lib/supabase";

export type FollowSuggestionReason =
  | "follows_you"
  | "followed_by_network"
  | "commented_on_your_post"
  | "similar_topics"
  | "active_in_feed";

export type FollowSuggestion = {
  id: string;
  name: string;
  avatar_url: string | null;
  handle: string;
  reason: FollowSuggestionReason;
  reasonLabel: string;
};

const REASON_LABELS: Record<FollowSuggestionReason, string> = {
  follows_you: "Follows you",
  followed_by_network: "Followed by people you follow",
  commented_on_your_post: "Replied on your posts",
  similar_topics: "Posts in topics you use",
  active_in_feed: "Active on the feed",
};

function shortId(id: string) {
  return id.length > 12 ? `${id.slice(0, 8)}…` : id;
}

function isFollowSuggestionReason(v: string): v is FollowSuggestionReason {
  return v in REASON_LABELS;
}

function profileToSuggestion(
  id: string,
  pr: ProfileRow | undefined,
  reason: FollowSuggestionReason,
): FollowSuggestion | null {
  const handle = (pr?.public_handle ?? "").trim();
  const isPublic = pr?.is_public !== false;
  if (!handle || !isPublic) return null;
  return {
    id,
    name: pr?.full_name?.trim() || shortId(id),
    avatar_url: pr?.avatar_url ?? null,
    handle,
    reason,
    reasonLabel: REASON_LABELS[reason],
  };
}

type RpcRow = { user_id: string; score: number; primary_reason: string };

/** Server-ranked suggestions (requires migration `suggest_community_follow_profiles`). */
async function fetchFollowSuggestionsFromRpc(
  limit: number,
): Promise<{ data: FollowSuggestion[] | null; error: Error | null }> {
  const supabase = getSupabase();
  if (!supabase) return { data: null, error: new Error("Supabase not configured") };

  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session?.user?.id) {
    return { data: [], error: null };
  }

  const { data, error } = await supabase.rpc("suggest_community_follow_profiles", {
    p_limit: limit,
  });

  if (error) return { data: null, error: new Error(error.message) };

  const rows = (data ?? []) as RpcRow[];
  if (rows.length === 0) return { data: [], error: null };

  const ids = rows.map((r) => String(r.user_id));
  const profiles = await getProfilesByIds(ids);

  const out: FollowSuggestion[] = [];
  for (const row of rows) {
    const id = String(row.user_id);
    const rawReason = String(row.primary_reason ?? "active_in_feed");
    const reason = isFollowSuggestionReason(rawReason) ? rawReason : "active_in_feed";
    const item = profileToSuggestion(id, profiles.get(id), reason);
    if (item) out.push(item);
  }

  return { data: out, error: null };
}

/** Client fallback when RPC is unavailable (older DB). */
async function fetchFollowSuggestionsClientFallback(
  viewerId: string,
  limit: number,
): Promise<{ data: FollowSuggestion[]; error: Error | null }> {
  const scores = new Map<string, { score: number; reason: FollowSuggestionReason }>();

  const add = (id: string, weight: number, reason: FollowSuggestionReason) => {
    if (!id || id === viewerId) return;
    const cur = scores.get(id);
    const nextScore = (cur?.score ?? 0) + weight;
    const nextReason = !cur || weight >= cur.score ? reason : cur.reason;
    scores.set(id, { score: nextScore, reason: nextReason });
  };

  const [followingRes, pageRes, followersRes] = await Promise.all([
    listFolloweeIdsForCurrentUser(),
    fetchCommunityPostsPage(50, null),
    (async () => {
      const supabase = getSupabase();
      if (!supabase) return { ids: [] as string[], error: null };
      const { data, error } = await supabase
        .from("user_follows")
        .select("follower_id")
        .eq("followee_id", viewerId)
        .limit(30);
      if (error) return { ids: [], error: new Error(error.message) };
      return {
        ids: (data ?? []).map((r) => String((r as { follower_id: string }).follower_id)),
        error: null,
      };
    })(),
  ]);

  if (followingRes.error) return { data: [], error: followingRes.error };
  const followeeSet = new Set(followingRes.ids);

  for (const id of followersRes.ids) {
    if (!followeeSet.has(id)) add(id, 100, "follows_you");
  }

  const myTopics = new Set<string>();
  for (const p of pageRes.data ?? []) {
    if (p.author_id === viewerId && p.topic) myTopics.add(p.topic);
  }

  for (const p of pageRes.data ?? []) {
    const id = String(p.author_id);
    if (followeeSet.has(id)) continue;
    if (myTopics.has(p.topic)) add(id, 50, "similar_topics");
    else add(id, 25, "active_in_feed");
  }

  const ranked = [...scores.entries()]
    .filter(([id]) => !followeeSet.has(id))
    .sort((a, b) => b[1].score - a[1].score)
    .slice(0, limit);

  if (ranked.length === 0) return { data: [], error: null };

  const profiles = await getProfilesByIds(ranked.map(([id]) => id));
  const out: FollowSuggestion[] = [];
  for (const [id, meta] of ranked) {
    const item = profileToSuggestion(id, profiles.get(id), meta.reason);
    if (item) out.push(item);
  }
  return { data: out, error: null };
}

/**
 * Rich follow suggestions for the Following tab and Find people dialog.
 * Prefer server RPC; falls back to lightweight client heuristics.
 */
export async function fetchFollowSuggestions(
  viewerId: string | undefined,
  limit = 12,
): Promise<{ data: FollowSuggestion[]; error: Error | null }> {
  if (!viewerId) return { data: [], error: null };

  const rpc = await fetchFollowSuggestionsFromRpc(limit);
  if (rpc.data !== null) return { data: rpc.data, error: rpc.error };

  return fetchFollowSuggestionsClientFallback(viewerId, limit);
}

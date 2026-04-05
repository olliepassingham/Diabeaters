/**
 * Timeline: community_posts + community_post_comments (Supabase + RLS).
 * Images: bucket `community_post_images`, paths stored in image_urls jsonb.
 * Pagination: RPC fetch_community_posts_page (see supabase migration).
 */
import { getSupabase } from "@/lib/supabase";
import { listFolloweeIdsForCurrentUser } from "./follows-supabase";
import type { CommunityPostCommentRow, CommunityPostRow } from "./types";

export const COMMUNITY_POST_IMAGES_BUCKET = "community_post_images";
export const MAX_POST_IMAGES = 4;
export const MAX_POST_IMAGE_BYTES = 5 * 1024 * 1024;

export type FeedCursor = { created_at: string; id: string };

const PAGE_LIMIT_CAP = 100;

function mapPost(r: Record<string, unknown>): CommunityPostRow {
  const cc = Number(r.comment_count ?? 0);
  const lc = Number(r.like_count ?? 0);
  return {
    id: String(r.id),
    author_id: String(r.author_id),
    body: String(r.body ?? ""),
    image_urls: parseImageUrls(r.image_urls),
    is_reported: Boolean(r.is_reported),
    comment_count: Number.isFinite(cc) ? Math.max(0, Math.floor(cc)) : 0,
    like_count: Number.isFinite(lc) ? Math.max(0, Math.floor(lc)) : 0,
    liked_by_me: Boolean(r.liked_by_me),
    created_at: String(r.created_at ?? ""),
  };
}

/** Which of these post IDs the current user has liked (for merging into feed rows). */
export async function fetchMyLikesForPostIds(postIds: string[]): Promise<Set<string>> {
  if (postIds.length === 0) return new Set();
  const supabase = getSupabase();
  if (!supabase) return new Set();
  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData.session?.user?.id;
  if (!uid) return new Set();

  const { data, error } = await supabase
    .from("community_post_reactions")
    .select("post_id")
    .eq("user_id", uid)
    .in("post_id", postIds);

  if (error) return new Set();
  return new Set((data ?? []).map((row: { post_id: string }) => String(row.post_id)));
}

function mergeLikedIntoPosts(posts: CommunityPostRow[], likedIds: Set<string>): CommunityPostRow[] {
  return posts.map((p) => ({ ...p, liked_by_me: likedIds.has(p.id) }));
}

export async function togglePostLike(
  postId: string,
  currentlyLiked: boolean,
): Promise<{ error: Error | null }> {
  const supabase = getSupabase();
  if (!supabase) return { error: new Error("Supabase not configured") };

  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData.session?.user?.id;
  if (!uid) return { error: new Error("Not signed in") };

  if (currentlyLiked) {
    const { error } = await supabase
      .from("community_post_reactions")
      .delete()
      .eq("post_id", postId)
      .eq("user_id", uid);
    if (error) return { error: new Error(error.message) };
    return { error: null };
  }

  const { error } = await supabase.from("community_post_reactions").insert({
    post_id: postId,
    user_id: uid,
  });
  if (error) return { error: new Error(error.message) };
  return { error: null };
}

function parseImageUrls(raw: unknown): string[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw.map(String);
  return [];
}

function mapComment(r: Record<string, unknown>): CommunityPostCommentRow {
  return {
    id: String(r.id),
    post_id: String(r.post_id),
    author_id: String(r.author_id),
    body: String(r.body ?? ""),
    is_reported: Boolean(r.is_reported),
    created_at: String(r.created_at ?? ""),
  };
}

function extFromFile(f: File): string {
  const n = f.name.toLowerCase();
  if (n.endsWith(".png")) return "png";
  if (n.endsWith(".webp")) return "webp";
  if (n.endsWith(".gif")) return "gif";
  return "jpg";
}

function validateImageFiles(files: File[]): Error | null {
  if (files.length > MAX_POST_IMAGES) {
    return new Error(`You can attach up to ${MAX_POST_IMAGES} images per post.`);
  }
  for (const f of files) {
    if (f.size > MAX_POST_IMAGE_BYTES) {
      return new Error("Each image must be 5MB or smaller.");
    }
    if (!f.type.startsWith("image/")) {
      return new Error("Only image files are allowed.");
    }
  }
  return null;
}

/** Signed URLs for displaying private bucket images (short TTL; refresh on feed load). */
export async function getPostImageSignedUrls(paths: string[]): Promise<string[]> {
  const supabase = getSupabase();
  if (!supabase || paths.length === 0) return [];
  const out: string[] = [];
  for (const path of paths) {
    const { data, error } = await supabase.storage
      .from(COMMUNITY_POST_IMAGES_BUCKET)
      .createSignedUrl(path, 3600);
    if (error || !data?.signedUrl) continue;
    out.push(data.signedUrl);
  }
  return out;
}

export async function fetchCommunityPostsPage(
  limit: number,
  cursor: FeedCursor | null,
): Promise<{
  data: CommunityPostRow[] | null;
  error: Error | null;
}> {
  const supabase = getSupabase();
  if (!supabase) return { data: null, error: new Error("Supabase not configured") };

  const lim = Math.min(Math.max(limit, 1), PAGE_LIMIT_CAP);

  const { data, error } = await supabase.rpc("fetch_community_posts_page", {
    p_limit: lim,
    p_cursor_created_at: cursor?.created_at ?? null,
    p_cursor_id: cursor?.id ?? null,
    p_author_ids: null,
  });

  if (error) return { data: null, error: new Error(error.message) };
  const rows = (data ?? []).map((row: Record<string, unknown>) => mapPost(row));
  const liked = await fetchMyLikesForPostIds(rows.map((p: CommunityPostRow) => p.id));
  return {
    data: mergeLikedIntoPosts(rows, liked),
    error: null,
  };
}

/** Posts from people you follow plus your own (RLS still applies for blocks). */
export async function fetchCommunityPostsFromFollowingPage(
  limit: number,
  cursor: FeedCursor | null,
): Promise<{
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
  const lim = Math.min(Math.max(limit, 1), PAGE_LIMIT_CAP);

  const { data, error } = await supabase.rpc("fetch_community_posts_page", {
    p_limit: lim,
    p_cursor_created_at: cursor?.created_at ?? null,
    p_cursor_id: cursor?.id ?? null,
    p_author_ids: authorIds,
  });

  if (error) return { data: null, error: new Error(error.message) };
  const rows = (data ?? []).map((row: Record<string, unknown>) => mapPost(row));
  const liked = await fetchMyLikesForPostIds(rows.map((p: CommunityPostRow) => p.id));
  return {
    data: mergeLikedIntoPosts(rows, liked),
    error: null,
  };
}

export async function insertCommunityPost(
  body: string,
  imageFiles?: File[],
): Promise<{
  data: CommunityPostRow | null;
  error: Error | null;
}> {
  const supabase = getSupabase();
  if (!supabase) return { data: null, error: new Error("Supabase not configured") };

  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData.session?.user?.id;
  if (!uid) return { data: null, error: new Error("Not signed in") };

  const trimmed = body.trim();
  const files = imageFiles?.filter(Boolean) ?? [];
  const vErr = validateImageFiles(files);
  if (vErr) return { data: null, error: vErr };

  if (!trimmed && files.length === 0) {
    return { data: null, error: new Error("Add text or at least one photo.") };
  }

  if (files.length === 0) {
    const { data, error } = await supabase
      .from("community_posts")
      .insert({ author_id: uid, body: trimmed, image_urls: [] })
      .select("*")
      .single();

    if (error) return { data: null, error: new Error(error.message) };
    if (!data) return { data: null, error: new Error("No row returned") };
    return { data: mapPost(data as Record<string, unknown>), error: null };
  }

  const pendingId = crypto.randomUUID();
  const pendingPaths: string[] = [];
  let postId: string | null = null;
  const movedDests: string[] = [];

  try {
    for (let i = 0; i < files.length; i++) {
      const ext = extFromFile(files[i]!);
      const path = `${uid}/pending/${pendingId}/${i}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from(COMMUNITY_POST_IMAGES_BUCKET)
        .upload(path, files[i]!, {
          cacheControl: "3600",
          upsert: false,
          contentType: files[i]!.type || undefined,
        });
      if (upErr) throw new Error(upErr.message);
      pendingPaths.push(path);
    }

    const { data, error } = await supabase
      .from("community_posts")
      .insert({
        author_id: uid,
        body: trimmed,
        image_urls: pendingPaths,
      })
      .select("*")
      .single();

    if (error) throw new Error(error.message);
    if (!data) throw new Error("No row returned");

    postId = String((data as Record<string, unknown>).id);
    const finalPaths: string[] = [];

    for (let i = 0; i < pendingPaths.length; i++) {
      const ext = extFromFile(files[i]!);
      const dest = `${uid}/${postId}/${i}.${ext}`;
      const { error: mvErr } = await supabase.storage
        .from(COMMUNITY_POST_IMAGES_BUCKET)
        .move(pendingPaths[i]!, dest);
      if (mvErr) throw new Error(mvErr.message);
      finalPaths.push(dest);
      movedDests.push(dest);
    }

    const { data: updated, error: updErr } = await supabase
      .from("community_posts")
      .update({ image_urls: finalPaths })
      .eq("id", postId)
      .select("*")
      .single();

    if (updErr) throw new Error(updErr.message);
    if (!updated) throw new Error("Update returned no row");
    return { data: mapPost(updated as Record<string, unknown>), error: null };
  } catch (e) {
    if (postId) {
      await supabase.from("community_posts").delete().eq("id", postId);
    }
    const uniq = [...new Set([...pendingPaths, ...movedDests])];
    if (uniq.length > 0) {
      await supabase.storage.from(COMMUNITY_POST_IMAGES_BUCKET).remove(uniq);
    }
    const msg = e instanceof Error ? e.message : "Upload failed";
    return { data: null, error: new Error(msg) };
  }
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
  return {
    data: (data ?? []).map((r) => mapComment(r as Record<string, unknown>)),
    error: null,
  };
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

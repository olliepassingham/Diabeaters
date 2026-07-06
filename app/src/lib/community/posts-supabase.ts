/**
 * Timeline: community_posts + community_post_comments (Supabase + RLS).
 * Images: bucket `community_post_images`, paths stored in image_urls jsonb.
 * Pagination: RPC fetch_community_posts_page (see supabase migration).
 */
import { logEdgeInvokeFailure } from "@/lib/dev-log";
import { getSupabase } from "@/lib/supabase";
import { canEngageWithCommunityFeed, COMMUNITY_FEED_ENGAGE_REQUIRED_MESSAGE, getProfilesByIds } from "@/lib/profile";
import { listFolloweeIdsForCurrentUser } from "./follows-supabase";
import {
  isCommunityContentNoteId,
  type CommunityContentNoteId,
} from "./content-notes";
import {
  isCommunityPostKind,
  parseMentionMap,
  parseMentionedUserIds,
  parsePostExtra,
  type CommunityPostKind,
} from "./post-kinds";
import { buildMentionsForPost } from "./post-mentions";
import {
  getPostMediaSignedUrl,
  getPostMediaSignedUrls,
} from "./post-media-signed-urls";
import type { CommunityPostAuthorPreview, CommunityPostCommentRow, CommunityPostRow } from "./types";
import {
  DEFAULT_COMMUNITY_TOPIC,
  isCommunityTopicId,
  type CommunityTopicId,
} from "./topics";

export const COMMUNITY_POST_IMAGES_BUCKET = "community_post_images";
export const MAX_POST_IMAGES = 4;
export const MAX_POST_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_POST_VIDEO_BYTES = 50 * 1024 * 1024;

export type FeedCursor = { created_at: string; id: string };

const PAGE_LIMIT_CAP = 100;

/** PostgREST only exposes the new RPC after the topic migration; clearer hint when the DB is behind. */
function wrapFeedRpcError(err: { message: string }): Error {
  const msg = err.message;
  if (
    msg.includes("fetch_community_posts_page") ||
    (msg.includes("schema cache") && msg.includes("function"))
  ) {
    return new Error(
      `${msg} Apply migration 20260409120000_community_post_topics (see docs/sql/community_post_topics.sql), then reload the API schema in Supabase Dashboard → Settings → API.`,
    );
  }
  if (msg.includes("search_community_posts")) {
    return new Error(
      `${msg} Apply migration 20260507140000_community_feed_search_saves_realtime.sql, then reload the API schema in Supabase Dashboard → Settings → API.`,
    );
  }
  if (msg.includes("content_note") || msg.includes("image_alt_texts")) {
    return new Error(
      `${msg} Apply migration 20260411120000_community_posts_feed_ux_columns.sql, then reload the API schema in Supabase Dashboard → Settings → API.`,
    );
  }
  if (
    msg.includes("post_kind") ||
    msg.includes("post_extra") ||
    msg.includes("community_poll_votes")
  ) {
    return new Error(
      `${msg} Apply migration 20260412120000_community_posts_poll_event_mentions.sql, then reload the API schema in Supabase Dashboard → Settings → API.`,
    );
  }
  if (msg.includes("mention_map") || msg.includes("mentioned_user_ids")) {
    return new Error(
      `${msg} Apply migrations 20260412120000_community_posts_poll_event_mentions.sql and 20260601120000_community_comment_mentions.sql, then reload the API schema in Supabase Dashboard → Settings → API.`,
    );
  }
  if (msg.includes("video_url")) {
    return new Error(
      `${msg} Apply migration 20260621120000_community_post_video.sql, then reload the API schema in Supabase Dashboard → Settings → API.`,
    );
  }
  return new Error(msg);
}

function mapPostKind(raw: unknown): CommunityPostKind {
  const s = String(raw ?? "standard");
  return isCommunityPostKind(s) ? s : "standard";
}

function mapTopic(raw: unknown): CommunityTopicId {
  const s = String(raw ?? "");
  return isCommunityTopicId(s) ? s : DEFAULT_COMMUNITY_TOPIC;
}

function mapContentNote(raw: unknown): CommunityContentNoteId | null {
  if (raw == null || raw === "") return null;
  const s = String(raw);
  return isCommunityContentNoteId(s) ? s : null;
}

function parseImageAltTexts(raw: unknown, imageCount: number): string[] {
  const fromDb: string[] = [];
  if (Array.isArray(raw)) {
    for (const x of raw) fromDb.push(String(x ?? "").trim().slice(0, 500));
  }
  const out: string[] = [];
  for (let i = 0; i < imageCount; i++) {
    out.push(fromDb[i] ?? "");
  }
  return out;
}

function normalizeAltsForCount(raw: string[] | undefined, n: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    out.push(String(raw?.[i] ?? "").trim().slice(0, 500));
  }
  return out;
}

function mapPost(r: Record<string, unknown>): CommunityPostRow {
  const cc = Number(r.comment_count ?? 0);
  const lc = Number(r.like_count ?? 0);
  const ic = Number(r.interested_count ?? 0);
  const imgs = parseImageUrls(r.image_urls);
  const post_kind = mapPostKind(r.post_kind);
  const post_extra = parsePostExtra(post_kind, r.post_extra);
  return {
    id: String(r.id),
    author_id: String(r.author_id),
    body: String(r.body ?? ""),
    topic: mapTopic(r.topic),
    image_urls: imgs,
    image_alt_texts: parseImageAltTexts(r.image_alt_texts, imgs.length),
    video_url:
      typeof r.video_url === "string" && r.video_url.trim().length > 0 ? r.video_url.trim() : null,
    content_note: mapContentNote(r.content_note),
    post_kind,
    post_extra,
    mention_map: parseMentionMap(r.mention_map),
    mentioned_user_ids: parseMentionedUserIds(r.mentioned_user_ids),
    is_reported: Boolean(r.is_reported),
    comment_count: Number.isFinite(cc) ? Math.max(0, Math.floor(cc)) : 0,
    like_count: Number.isFinite(lc) ? Math.max(0, Math.floor(lc)) : 0,
    liked_by_me: Boolean(r.liked_by_me),
    interested_count: Number.isFinite(ic) ? Math.max(0, Math.floor(ic)) : 0,
    interested_by_me: Boolean(r.interested_by_me),
    saved_by_me: Boolean(r.saved_by_me),
    created_at: String(r.created_at ?? ""),
  };
}

async function fetchCommentCountsForPostIds(postIds: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  for (const id of postIds) out.set(id, 0);
  if (postIds.length === 0) return out;
  const supabase = getSupabase();
  if (!supabase) return out;

  // Counts rows visible under RLS (same as expanding comments). Merged with denormalized counts in finalize.
  const { data, error } = await supabase
    .from("community_post_comments")
    .select("post_id")
    .in("post_id", postIds);

  if (error) return out;
  for (const row of (data ?? []) as Array<{ post_id: string }>) {
    const pid = String(row.post_id);
    out.set(pid, (out.get(pid) ?? 0) + 1);
  }
  return out;
}

async function fetchLikeCountsForPostIds(postIds: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  for (const id of postIds) out.set(id, 0);
  if (postIds.length === 0) return out;
  const supabase = getSupabase();
  if (!supabase) return out;

  const { data, error } = await supabase
    .from("community_post_reactions")
    .select("post_id")
    .in("post_id", postIds);

  if (error) return out;
  for (const row of (data ?? []) as Array<{ post_id: string }>) {
    const pid = String(row.post_id);
    out.set(pid, (out.get(pid) ?? 0) + 1);
  }
  return out;
}

async function fetchInterestCountsForPostIds(postIds: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  for (const id of postIds) out.set(id, 0);
  if (postIds.length === 0) return out;
  const supabase = getSupabase();
  if (!supabase) return out;

  const { data, error } = await supabase
    .from("community_post_event_interest")
    .select("post_id")
    .in("post_id", postIds);

  if (error) return out;
  for (const row of (data ?? []) as Array<{ post_id: string }>) {
    const pid = String(row.post_id);
    out.set(pid, (out.get(pid) ?? 0) + 1);
  }
  return out;
}

/** Which event post IDs the current user marked interested in. */
export async function fetchMyInterestForPostIds(postIds: string[]): Promise<Set<string>> {
  if (postIds.length === 0) return new Set();
  const supabase = getSupabase();
  if (!supabase) return new Set();
  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData.session?.user?.id;
  if (!uid) return new Set();

  const { data, error } = await supabase
    .from("community_post_event_interest")
    .select("post_id")
    .eq("user_id", uid)
    .in("post_id", postIds);

  if (error) return new Set();
  return new Set((data ?? []).map((row: { post_id: string }) => String(row.post_id)));
}

function mergeInterestedIntoPosts(posts: CommunityPostRow[], interestedIds: Set<string>): CommunityPostRow[] {
  return posts.map((p) =>
    p.post_kind === "event" ? { ...p, interested_by_me: interestedIds.has(p.id) } : p,
  );
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

function mergeSavedIntoPosts(posts: CommunityPostRow[], savedIds: Set<string>): CommunityPostRow[] {
  return posts.map((p) => ({ ...p, saved_by_me: savedIds.has(p.id) }));
}

async function fetchMySavesForPostIds(postIds: string[]): Promise<Set<string>> {
  if (postIds.length === 0) return new Set();
  const supabase = getSupabase();
  if (!supabase) return new Set();
  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData.session?.user?.id;
  if (!uid) return new Set();

  const { data, error } = await supabase
    .from("community_post_saves")
    .select("post_id")
    .eq("user_id", uid)
    .in("post_id", postIds);

  if (error) return new Set();
  return new Set((data ?? []).map((row: { post_id: string }) => String(row.post_id)));
}

async function attachAuthorPreviews(posts: CommunityPostRow[]): Promise<CommunityPostRow[]> {
  const ids = [...new Set(posts.map((p) => p.author_id).filter(Boolean))];
  if (ids.length === 0) return posts;
  const map = await getProfilesByIds(ids);
  return posts.map((p) => {
    const prof = map.get(p.author_id);
    if (!prof) return { ...p, author_preview: undefined };
    const author_preview: CommunityPostAuthorPreview = {
      full_name: prof.full_name?.trim() ?? null,
      avatar_url: prof.avatar_url ?? null,
      public_handle: prof.public_handle?.trim() ?? null,
    };
    return { ...p, author_preview };
  });
}

/** Merge engagement totals, like flags, and author profile snippets (parallel). */
async function finalizePostRowsForFeed(withCounts: CommunityPostRow[]): Promise<CommunityPostRow[]> {
  if (withCounts.length === 0) return withCounts;
  const postIds = withCounts.map((p) => p.id);
  const eventPostIds = withCounts.filter((p) => p.post_kind === "event").map((p) => p.id);
  const [commentCounts, likeCounts, interestCounts, liked, interested, saved, withAuthors] = await Promise.all([
    fetchCommentCountsForPostIds(postIds),
    fetchLikeCountsForPostIds(postIds),
    fetchInterestCountsForPostIds(eventPostIds),
    fetchMyLikesForPostIds(postIds),
    fetchMyInterestForPostIds(eventPostIds),
    fetchMySavesForPostIds(postIds),
    attachAuthorPreviews(withCounts),
  ]);
  const merged = withAuthors.map((p) => ({
    ...p,
    comment_count: Math.max(p.comment_count, commentCounts.get(p.id) ?? 0),
    like_count: Math.max(p.like_count, likeCounts.get(p.id) ?? 0),
    interested_count:
      p.post_kind === "event" ? Math.max(p.interested_count, interestCounts.get(p.id) ?? 0) : 0,
  }));
  return mergeSavedIntoPosts(mergeInterestedIntoPosts(mergeLikedIntoPosts(merged, liked), interested), saved);
}

async function finalizeSinglePostRow(row: CommunityPostRow): Promise<CommunityPostRow> {
  const out = await finalizePostRowsForFeed([row]);
  return out[0]!;
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

  const gate = await assertProfileCanEngageCommunityFeed(supabase, uid);
  if (!gate.ok) return { error: gate.error };

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

  // Mirror in-app trigger notification with iOS push (when enabled).
  void supabase.functions
    .invoke("notify_feed_push", { body: { kind: "feed_post_like", post_id: postId } })
    .then(({ error: fnErr }) => {
      if (fnErr) logEdgeInvokeFailure("notify_feed_push like", fnErr.message);
    });

  return { error: null };
}

export async function toggleEventInterest(
  postId: string,
  currentlyInterested: boolean,
): Promise<{ error: Error | null }> {
  const supabase = getSupabase();
  if (!supabase) return { error: new Error("Supabase not configured") };

  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData.session?.user?.id;
  if (!uid) return { error: new Error("Not signed in") };

  const gate = await assertProfileCanEngageCommunityFeed(supabase, uid);
  if (!gate.ok) return { error: gate.error };

  if (currentlyInterested) {
    const { error } = await supabase
      .from("community_post_event_interest")
      .delete()
      .eq("post_id", postId)
      .eq("user_id", uid);
    if (error) return { error: new Error(error.message) };
    return { error: null };
  }

  const { error } = await supabase.from("community_post_event_interest").insert({
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
    mention_map: parseMentionMap(r.mention_map),
    mentioned_user_ids: parseMentionedUserIds(r.mentioned_user_ids),
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

function extFromVideoFile(f: File): string {
  const t = f.type.toLowerCase();
  if (t.includes("webm")) return "webm";
  if (t.includes("quicktime") || f.name.toLowerCase().endsWith(".mov")) return "mov";
  return "mp4";
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

function validateVideoFile(file: File | null | undefined): Error | null {
  if (!file) return null;
  if (file.size > MAX_POST_VIDEO_BYTES) {
    return new Error("Video must be 50MB or smaller.");
  }
  const t = file.type.toLowerCase();
  const allowed =
    t === "video/mp4" ||
    t === "video/quicktime" ||
    t === "video/webm" ||
    file.name.toLowerCase().endsWith(".mp4") ||
    file.name.toLowerCase().endsWith(".mov") ||
    file.name.toLowerCase().endsWith(".webm");
  if (!allowed) {
    return new Error("Only MP4, MOV, or WebM videos are allowed.");
  }
  return null;
}

/** Signed URL for a private bucket video (cached; batch-friendly). */
export async function getPostVideoSignedUrl(path: string): Promise<string | null> {
  return getPostMediaSignedUrl(path);
}

/** Signed URLs for displaying private bucket images (cached; batch-friendly). */
export async function getPostImageSignedUrls(paths: string[]): Promise<(string | null)[]> {
  return getPostMediaSignedUrls(paths);
}

export async function fetchCommunityPostsPage(
  limit: number,
  cursor: FeedCursor | null,
  topicFilter?: CommunityTopicId | null,
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
    p_topic: topicFilter ?? null,
  });

  if (error) return { data: null, error: wrapFeedRpcError(error) };
  const raw = (data ?? []) as Record<string, unknown>[];
  const posts = raw.map((row) => mapPost(row));

  const dataOut = await finalizePostRowsForFeed(posts);
  return { data: dataOut, error: null };
}

/** Posts from people you follow plus your own (RLS still applies for blocks). */
export async function fetchCommunityPostsFromFollowingPage(
  limit: number,
  cursor: FeedCursor | null,
  topicFilter?: CommunityTopicId | null,
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
    p_topic: topicFilter ?? null,
  });

  if (error) return { data: null, error: wrapFeedRpcError(error) };
  const raw = (data ?? []) as Record<string, unknown>[];
  const posts = raw.map((row) => mapPost(row));

  const dataOut = await finalizePostRowsForFeed(posts);
  return { data: dataOut, error: null };
}

export async function searchCommunityPostsPage(
  limit: number,
  cursor: FeedCursor | null,
  query: string,
  topicFilter?: CommunityTopicId | null,
  authorIds?: string[] | null,
): Promise<{
  data: CommunityPostRow[] | null;
  error: Error | null;
}> {
  const supabase = getSupabase();
  if (!supabase) return { data: null, error: new Error("Supabase not configured") };

  const q = query.trim();
  if (q.length < 2) return { data: [], error: null };

  const lim = Math.min(Math.max(limit, 1), PAGE_LIMIT_CAP);
  const ids =
    authorIds != null && authorIds.length > 0 ? [...new Set(authorIds.filter(Boolean))] : null;

  const { data, error } = await supabase.rpc("search_community_posts", {
    p_query: q,
    p_limit: lim,
    p_cursor_created_at: cursor?.created_at ?? null,
    p_cursor_id: cursor?.id ?? null,
    p_topic: topicFilter ?? null,
    p_author_ids: ids,
  });

  if (error) return { data: null, error: wrapFeedRpcError(error) };
  const raw = (data ?? []) as Record<string, unknown>[];
  const posts = raw.map((row) => mapPost(row));
  const dataOut = await finalizePostRowsForFeed(posts);
  return { data: dataOut, error: null };
}

export async function togglePostSave(
  postId: string,
  currentlySaved: boolean,
): Promise<{ error: Error | null }> {
  const supabase = getSupabase();
  if (!supabase) return { error: new Error("Supabase not configured") };

  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData.session?.user?.id;
  if (!uid) return { error: new Error("Not signed in") };

  if (currentlySaved) {
    const { error } = await supabase
      .from("community_post_saves")
      .delete()
      .eq("post_id", postId)
      .eq("user_id", uid);
    if (error) return { error: new Error(error.message) };
    return { error: null };
  }

  // Make saves idempotent. If UI state is stale (e.g. saved_by_me false but row exists),
  // inserting would throw a duplicate PK error. Treat that as success.
  const { error } = await supabase
    .from("community_post_saves")
    .upsert(
      {
        post_id: postId,
        user_id: uid,
      },
      { onConflict: "user_id,post_id", ignoreDuplicates: true },
    );
  if (error) {
    const code = (error as { code?: string }).code;
    if (code === "23505" || error.message.toLowerCase().includes("duplicate key")) {
      return { error: null };
    }
    return { error: new Error(error.message) };
  }
  return { error: null };
}

/** Posts for a specific author (RLS applies for blocks). */
export async function fetchCommunityPostsByAuthorPage(
  authorId: string,
  limit: number,
  cursor: FeedCursor | null,
  topicFilter?: CommunityTopicId | null,
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
    p_author_ids: [authorId],
    p_topic: topicFilter ?? null,
  });

  if (error) return { data: null, error: wrapFeedRpcError(error) };
  const raw = (data ?? []) as Record<string, unknown>[];
  const posts = raw.map((row) => mapPost(row));

  const dataOut = await finalizePostRowsForFeed(posts);
  return { data: dataOut, error: null };
}

export type FeedPostMentions = {
  userIds: string[];
  mentionMap: Record<string, string>;
};

export type InsertFeedPostInput =
  | {
      kind: "standard";
      topic: CommunityTopicId;
      body: string;
      imageFiles?: File[];
      videoFile?: File;
      imageAlts?: string[];
      mentions: FeedPostMentions;
    }
  | {
      kind: "poll";
      topic: CommunityTopicId;
      body: string;
      question: string;
      options: string[];
      imageFiles?: File[];
      imageAlts?: string[];
      mentions: FeedPostMentions;
    }
  | {
      kind: "event";
      topic: CommunityTopicId;
      body: string;
      title: string;
      startsAt: string;
      location?: string;
      details?: string;
      imageFiles?: File[];
      imageAlts?: string[];
      mentions: FeedPostMentions;
    };

function normalizeMentionsForInsert(
  authorId: string,
  mentions: FeedPostMentions,
): { mentioned_user_ids: string[]; mention_map: Record<string, string> } {
  const ids = [...new Set(mentions.userIds.filter((x) => x && x !== authorId))].slice(0, 12);
  const map: Record<string, string> = {};
  for (const [h, uid] of Object.entries(mentions.mentionMap)) {
    const k = h.trim().toLowerCase();
    if (!k || !uid || uid === authorId) continue;
    map[k] = uid;
  }
  return { mentioned_user_ids: ids, mention_map: map };
}

type SupabaseNonNull = NonNullable<ReturnType<typeof getSupabase>>;

async function assertProfileCanEngageCommunityFeed(
  supabase: SupabaseNonNull,
  uid: string,
): Promise<{ ok: true } | { ok: false; error: Error }> {
  const { data, error } = await supabase
    .from("profiles")
    .select("full_name, public_handle, is_public")
    .eq("id", uid)
    .maybeSingle();
  if (error) return { ok: false, error: new Error(error.message) };
  if (!canEngageWithCommunityFeed(data)) {
    return { ok: false, error: new Error(COMMUNITY_FEED_ENGAGE_REQUIRED_MESSAGE) };
  }
  return { ok: true };
}

async function insertCommunityPostRowWithOptionalImageUploads(params: {
  supabase: SupabaseNonNull;
  uid: string;
  body: string;
  topic: CommunityTopicId;
  post_kind: "standard" | "poll" | "event";
  post_extra: unknown | null;
  mention_map: Record<string, string>;
  mentioned_user_ids: string[];
  imageFiles: File[];
  videoFile?: File | null;
  imageAlts?: string[];
}): Promise<{ data: CommunityPostRow | null; error: Error | null }> {
  const { supabase, uid, mentioned_user_ids } = params;
  const files = params.imageFiles.filter(Boolean);
  const videoFile = params.videoFile ?? null;
  if (videoFile && files.length > 0) {
    return { data: null, error: new Error("Choose photos or a video, not both.") };
  }
  const vErr = validateVideoFile(videoFile);
  if (vErr) return { data: null, error: vErr };
  const iErr = validateImageFiles(files);
  if (iErr) return { data: null, error: iErr };

  const imageAltsForInsert = normalizeAltsForCount(params.imageAlts, files.length);

  const fireMentionPushes = (postId: string) => {
    for (const mentionId of mentioned_user_ids) {
      void supabase.functions
        .invoke("notify_feed_push", { body: { kind: "feed_post_mention", post_id: postId, mentioned_user_id: mentionId } })
        .then(({ error: fnErr }) => {
          if (fnErr) logEdgeInvokeFailure("notify_feed_push mention", fnErr.message);
        });
    }
  };

  if (files.length === 0 && !videoFile) {
    const insertRow: Record<string, unknown> = {
      author_id: uid,
      body: params.body,
      image_urls: [],
      video_url: null,
      topic: params.topic,
      post_kind: params.post_kind,
      post_extra: params.post_extra,
      mention_map: params.mention_map,
      mentioned_user_ids,
    };
    const { data, error } = await supabase.from("community_posts").insert(insertRow).select("*").single();

    if (error) return { data: null, error: new Error(error.message) };
    if (!data) return { data: null, error: new Error("No row returned") };
    const out = mapPost(data as Record<string, unknown>);
    fireMentionPushes(out.id);
    return { data: await finalizeSinglePostRow(out), error: null };
  }

  const pendingId = crypto.randomUUID();
  const pendingPaths: string[] = [];
  let pendingVideoPath: string | null = null;
  let postId: string | null = null;
  const movedDests: string[] = [];

  try {
    if (videoFile) {
      const ext = extFromVideoFile(videoFile);
      pendingVideoPath = `${uid}/pending/${pendingId}/video.${ext}`;
      const { error: upErr } = await supabase.storage
        .from(COMMUNITY_POST_IMAGES_BUCKET)
        .upload(pendingVideoPath, videoFile, {
          cacheControl: "604800",
          upsert: false,
          contentType: videoFile.type || undefined,
        });
      if (upErr) throw new Error(upErr.message);
    }

    for (let i = 0; i < files.length; i++) {
      const ext = extFromFile(files[i]!);
      const path = `${uid}/pending/${pendingId}/${i}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from(COMMUNITY_POST_IMAGES_BUCKET)
        .upload(path, files[i]!, {
          cacheControl: "604800",
          upsert: false,
          contentType: files[i]!.type || undefined,
        });
      if (upErr) throw new Error(upErr.message);
      pendingPaths.push(path);
    }

    const insertPayload: Record<string, unknown> = {
      author_id: uid,
      body: params.body,
      /* Avoid publishing pending storage paths: we move() those objects away immediately, so any
       * feed/realtime read between move and DB update would sign URLs for paths that no longer exist.
       * Standard media-only posts must reference media at insert time (CHECK constraint). */
      image_urls:
        params.post_kind === "standard" && !params.body.trim() && files.length > 0 ? pendingPaths : [],
      video_url:
        params.post_kind === "standard" && !params.body.trim() && pendingVideoPath ? pendingVideoPath : null,
      topic: params.topic,
      post_kind: params.post_kind,
      post_extra: params.post_extra,
      mention_map: params.mention_map,
      mentioned_user_ids,
    };
    if (imageAltsForInsert.some((s) => s.trim().length > 0)) {
      insertPayload.image_alt_texts = imageAltsForInsert;
    }

    const { data, error } = await supabase.from("community_posts").insert(insertPayload).select("*").single();

    if (error) throw new Error(error.message);
    if (!data) throw new Error("No row returned");

    postId = String((data as Record<string, unknown>).id);
    const finalPaths: string[] = [];
    let finalVideoPath: string | null = null;

    if (pendingVideoPath && videoFile) {
      const ext = extFromVideoFile(videoFile);
      finalVideoPath = `${uid}/${postId}/video.${ext}`;
      const { error: mvErr } = await supabase.storage
        .from(COMMUNITY_POST_IMAGES_BUCKET)
        .move(pendingVideoPath, finalVideoPath);
      if (mvErr) throw new Error(mvErr.message);
      movedDests.push(finalVideoPath);
    }

    for (let i = 0; i < pendingPaths.length; i++) {
      const ext = extFromFile(files[i]!);
      const dest = `${uid}/${postId}/${i}.${ext}`;
      const { error: mvErr } = await supabase.storage.from(COMMUNITY_POST_IMAGES_BUCKET).move(pendingPaths[i]!, dest);
      if (mvErr) throw new Error(mvErr.message);
      finalPaths.push(dest);
      movedDests.push(dest);
    }

    const updatePayload: Record<string, unknown> = { image_urls: finalPaths };
    if (finalVideoPath) {
      updatePayload.video_url = finalVideoPath;
    }
    if (imageAltsForInsert.some((s) => s.trim().length > 0)) {
      updatePayload.image_alt_texts = imageAltsForInsert;
    }

    const { data: updated, error: updErr } = await supabase
      .from("community_posts")
      .update(updatePayload)
      .eq("id", postId)
      .select("*")
      .single();

    if (updErr) throw new Error(updErr.message);
    if (!updated) throw new Error("Update returned no row");
    const out = mapPost(updated as Record<string, unknown>);
    fireMentionPushes(out.id);
    return { data: await finalizeSinglePostRow(out), error: null };
  } catch (e) {
    if (postId) {
      await supabase.from("community_posts").delete().eq("id", postId);
    }
    const uniq = [...new Set([...pendingPaths, ...movedDests, ...(pendingVideoPath ? [pendingVideoPath] : [])])];
    if (uniq.length > 0) {
      await supabase.storage.from(COMMUNITY_POST_IMAGES_BUCKET).remove(uniq);
    }
    const msg = e instanceof Error ? e.message : "Upload failed";
    return { data: null, error: new Error(msg) };
  }
}

export async function insertFeedPost(
  input: InsertFeedPostInput,
): Promise<{ data: CommunityPostRow | null; error: Error | null }> {
  const supabase = getSupabase();
  if (!supabase) return { data: null, error: new Error("Supabase not configured") };

  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData.session?.user?.id;
  if (!uid) return { data: null, error: new Error("Not signed in") };

  const gate = await assertProfileCanEngageCommunityFeed(supabase, uid);
  if (!gate.ok) return { data: null, error: gate.error };

  const { mentioned_user_ids, mention_map } = normalizeMentionsForInsert(uid, input.mentions);

  if (input.kind === "poll") {
    const trimmedBody = input.body.trim();
    const q = input.question.trim();
    const opts = input.options.map((o) => o.trim()).filter(Boolean);
    if (opts.length < 2) {
      return { data: null, error: new Error("Add at least two poll options.") };
    }
    /* Older DBs still enforce community_posts_body_and_images_check (body or images required). */
    const bodyForRow = trimmedBody || q;
    const imageFiles = input.imageFiles?.filter(Boolean) ?? [];
    return insertCommunityPostRowWithOptionalImageUploads({
      supabase,
      uid,
      body: bodyForRow,
      topic: input.topic,
      post_kind: "poll",
      post_extra: { question: q, options: opts },
      mention_map,
      mentioned_user_ids,
      imageFiles,
      imageAlts: input.imageAlts,
    });
  }

  if (input.kind === "event") {
    const trimmedBody = input.body.trim();
    const title = input.title.trim();
    const startsAt = input.startsAt.trim();
    if (!title || !startsAt) {
      return { data: null, error: new Error("Event name and date are required.") };
    }
    const extra: Record<string, string> = { title, starts_at: startsAt };
    const loc = input.location?.trim();
    const det = input.details?.trim();
    if (loc) extra.location = loc;
    if (det) extra.details = det;
    const bodyForRow = trimmedBody || title;
    const imageFiles = input.imageFiles?.filter(Boolean) ?? [];
    return insertCommunityPostRowWithOptionalImageUploads({
      supabase,
      uid,
      body: bodyForRow,
      topic: input.topic,
      post_kind: "event",
      post_extra: extra,
      mention_map,
      mentioned_user_ids,
      imageFiles,
      imageAlts: input.imageAlts,
    });
  }

  const trimmed = input.body.trim();
  const files = input.imageFiles?.filter(Boolean) ?? [];
  const videoFile = input.videoFile ?? null;
  if (videoFile && files.length > 0) {
    return { data: null, error: new Error("Choose photos or a video, not both.") };
  }
  if (!trimmed && files.length === 0 && !videoFile) {
    return { data: null, error: new Error("Add text, a photo, or a video.") };
  }
  return insertCommunityPostRowWithOptionalImageUploads({
    supabase,
    uid,
    body: trimmed,
    topic: input.topic,
    post_kind: "standard",
    post_extra: null,
    mention_map,
    mentioned_user_ids,
    imageFiles: files,
    videoFile,
    imageAlts: input.imageAlts,
  });
}

/** @deprecated Use insertFeedPost with kind standard */
export async function insertCommunityPost(
  body: string,
  imageFiles?: File[],
  topic: CommunityTopicId = DEFAULT_COMMUNITY_TOPIC,
  options?: { imageAlts?: string[] },
): Promise<{ data: CommunityPostRow | null; error: Error | null }> {
  return insertFeedPost({
    kind: "standard",
    topic,
    body,
    imageFiles,
    imageAlts: options?.imageAlts,
    mentions: { userIds: [], mentionMap: {} },
  });
}

export async function fetchCommentsForPost(
  postId: string,
  options?: { limit?: number; order?: "asc" | "desc" },
): Promise<{
  data: CommunityPostCommentRow[] | null;
  error: Error | null;
}> {
  const supabase = getSupabase();
  if (!supabase) return { data: null, error: new Error("Supabase not configured") };

  const ascending = options?.order !== "desc";

  let q = supabase
    .from("community_post_comments")
    .select("*")
    .eq("post_id", postId)
    .order("created_at", { ascending });

  const lim = options?.limit;
  if (typeof lim === "number" && lim > 0) {
    q = q.limit(lim);
  }

  const { data, error } = await q;

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

  const gate = await assertProfileCanEngageCommunityFeed(supabase, uid);
  if (!gate.ok) return { data: null, error: gate.error };

  const trimmed = body.trim();
  if (!trimmed) return { data: null, error: new Error("Comment cannot be empty") };

  const mentions = await buildMentionsForPost(trimmed, uid);
  const mentioned_user_ids = [...new Set(mentions.userIds.filter((x) => x && x !== uid))].slice(0, 12);
  const mention_map = { ...mentions.mentionMap };

  const { data, error } = await supabase
    .from("community_post_comments")
    .insert({
      post_id: postId,
      author_id: uid,
      body: trimmed,
      mention_map,
      mentioned_user_ids,
    })
    .select("*")
    .single();

  if (error) return { data: null, error: wrapFeedRpcError(error) };
  if (!data) return { data: null, error: new Error("No row returned") };
  const out = mapComment(data as Record<string, unknown>);

  void supabase.functions
    .invoke("notify_feed_push", { body: { kind: "feed_post_comment", post_id: postId, comment_id: out.id } })
    .then(({ error: fnErr }) => {
      if (fnErr) logEdgeInvokeFailure("notify_feed_push comment", fnErr.message);
    });

  for (const mentionId of mentioned_user_ids) {
    void supabase.functions
      .invoke("notify_feed_push", {
        body: { kind: "feed_comment_mention", post_id: postId, comment_id: out.id, mentioned_user_id: mentionId },
      })
      .then(({ error: fnErr }) => {
        if (fnErr) logEdgeInvokeFailure("notify_feed_push comment mention", fnErr.message);
      });
  }

  return { data: out, error: null };
}

/** Single post for permalink page (RLS applies). */
export async function fetchCommunityPostById(postId: string): Promise<{
  data: CommunityPostRow | null;
  error: Error | null;
}> {
  const supabase = getSupabase();
  if (!supabase) return { data: null, error: new Error("Supabase not configured") };

  const { data, error } = await supabase
    .from("community_posts")
    .select("*")
    .eq("id", postId)
    .maybeSingle();

  if (error) return { data: null, error: new Error(error.message) };
  if (!data) return { data: null, error: null };

  const row = mapPost(data as Record<string, unknown>);
  const finalized = await finalizePostRowsForFeed([row]);
  return { data: finalized[0] ?? null, error: null };
}

/** Remove post row and storage objects for the author. */
export async function deleteCommunityPost(postId: string): Promise<{ error: Error | null }> {
  const supabase = getSupabase();
  if (!supabase) return { error: new Error("Supabase not configured") };

  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData.session?.user?.id;
  if (!uid) return { error: new Error("Not signed in") };

  const { data: row, error: selErr } = await supabase
    .from("community_posts")
    .select("id, image_urls, video_url, author_id")
    .eq("id", postId)
    .eq("author_id", uid)
    .maybeSingle();

  if (selErr) return { error: new Error(selErr.message) };
  if (!row) return { error: new Error("Post not found or you cannot delete it.") };

  const paths = parseImageUrls((row as Record<string, unknown>).image_urls);
  const videoPath =
    typeof (row as Record<string, unknown>).video_url === "string"
      ? String((row as Record<string, unknown>).video_url).trim()
      : "";
  const storagePaths = [...paths, ...(videoPath ? [videoPath] : [])];
  if (storagePaths.length > 0) {
    const { error: rmErr } = await supabase.storage.from(COMMUNITY_POST_IMAGES_BUCKET).remove(storagePaths);
    if (rmErr) return { error: new Error(rmErr.message) };
  }

  const { error } = await supabase.from("community_posts").delete().eq("id", postId);
  if (error) return { error: new Error(error.message) };
  return { error: null };
}

export type UpdateCommunityPostOptions = {
  imageAltTexts?: string[];
  /** Existing storage paths to keep, in order. Omitted paths are deleted from storage. */
  keepImagePaths?: string[];
  /** New images to upload and append after kept paths. */
  addImageFiles?: File[];
};

/** Update body, topic, and optional images. Standard posts only. */
export async function updateCommunityPost(
  postId: string,
  body: string,
  topic: CommunityTopicId,
  options?: UpdateCommunityPostOptions,
): Promise<{ data: CommunityPostRow | null; error: Error | null }> {
  const supabase = getSupabase();
  if (!supabase) return { data: null, error: new Error("Supabase not configured") };

  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData.session?.user?.id;
  if (!uid) return { data: null, error: new Error("Not signed in") };

  const trimmed = body.trim();

  const { data: existing, error: selErr } = await supabase
    .from("community_posts")
    .select("*")
    .eq("id", postId)
    .eq("author_id", uid)
    .maybeSingle();

  if (selErr) return { data: null, error: new Error(selErr.message) };
  if (!existing) return { data: null, error: new Error("Post not found or you cannot edit it.") };

  const ex = existing as Record<string, unknown>;
  const kind = mapPostKind(ex.post_kind);
  if (kind !== "standard") {
    return { data: null, error: new Error("Only standard posts can be edited.") };
  }

  const existingImgs = parseImageUrls(ex.image_urls);
  const existingVideo =
    typeof ex.video_url === "string" && ex.video_url.trim().length > 0 ? ex.video_url.trim() : null;
  const keepPaths = options?.keepImagePaths ?? existingImgs;
  const addFiles = options?.addImageFiles ?? [];

  if (existingVideo && (addFiles.length > 0 || keepPaths.length > 0)) {
    return { data: null, error: new Error("Video posts cannot include photos.") };
  }

  for (const path of keepPaths) {
    if (!existingImgs.includes(path)) {
      return { data: null, error: new Error("Invalid image reference.") };
    }
  }

  const fileErr = validateImageFiles(addFiles);
  if (fileErr) return { data: null, error: fileErr };

  const finalCount = keepPaths.length + addFiles.length;
  if (finalCount > MAX_POST_IMAGES) {
    return { data: null, error: new Error(`You can attach up to ${MAX_POST_IMAGES} images per post.`) };
  }

  if (trimmed.length === 0 && finalCount === 0 && !existingVideo) {
    return { data: null, error: new Error("Add text or keep at least one photo or video.") };
  }

  const removePaths = existingImgs.filter((p) => !keepPaths.includes(p));
  const uploadedPaths: string[] = [];

  try {
    for (let i = 0; i < addFiles.length; i++) {
      const f = addFiles[i]!;
      const ext = extFromFile(f);
      const dest = `${uid}/${postId}/${Date.now()}-${i}.${ext}`;
      const { error: upErr } = await supabase.storage.from(COMMUNITY_POST_IMAGES_BUCKET).upload(dest, f, {
        cacheControl: "3600",
        upsert: false,
        contentType: f.type || undefined,
      });
      if (upErr) throw new Error(upErr.message);
      uploadedPaths.push(dest);
    }

    const finalPaths = [...keepPaths, ...uploadedPaths];
    const imageAlts =
      options?.imageAltTexts !== undefined
        ? normalizeAltsForCount(options.imageAltTexts, finalPaths.length)
        : parseImageAltTexts(ex.image_alt_texts, finalPaths.length);

    const updatePayload: Record<string, unknown> = {
      body: trimmed,
      topic,
      image_urls: finalPaths,
    };
    if (imageAlts.some((s) => s.trim().length > 0)) {
      updatePayload.image_alt_texts = imageAlts;
    } else if (finalPaths.length === 0) {
      updatePayload.image_alt_texts = [];
    }

    const { data, error } = await supabase
      .from("community_posts")
      .update(updatePayload)
      .eq("id", postId)
      .select("*")
      .single();

    if (error) throw new Error(error.message);
    if (!data) throw new Error("No row returned");

    if (removePaths.length > 0) {
      await supabase.storage.from(COMMUNITY_POST_IMAGES_BUCKET).remove(removePaths);
    }

    return { data: await finalizeSinglePostRow(mapPost(data as Record<string, unknown>)), error: null };
  } catch (e) {
    if (uploadedPaths.length > 0) {
      await supabase.storage.from(COMMUNITY_POST_IMAGES_BUCKET).remove(uploadedPaths);
    }
    const msg = e instanceof Error ? e.message : "Could not update post.";
    return { data: null, error: new Error(msg) };
  }
}

export async function deleteCommunityComment(commentId: string): Promise<{ error: Error | null }> {
  const supabase = getSupabase();
  if (!supabase) return { error: new Error("Supabase not configured") };

  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData.session?.user?.id;
  if (!uid) return { error: new Error("Not signed in") };

  const { error } = await supabase
    .from("community_post_comments")
    .delete()
    .eq("id", commentId)
    .eq("author_id", uid);

  if (error) return { error: new Error(error.message) };
  return { error: null };
}

export async function fetchPollVoteState(
  postId: string,
  optionCount: number,
): Promise<{
  counts: number[];
  myOptionIndex: number | null;
  error: Error | null;
}> {
  const supabase = getSupabase();
  if (!supabase) {
    return {
      counts: Array.from({ length: optionCount }, () => 0),
      myOptionIndex: null,
      error: new Error("Supabase not configured"),
    };
  }
  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData.session?.user?.id ?? null;

  const { data, error } = await supabase
    .from("community_poll_votes")
    .select("user_id, option_index")
    .eq("post_id", postId);

  if (error) {
    return {
      counts: Array.from({ length: optionCount }, () => 0),
      myOptionIndex: null,
      error: new Error(error.message),
    };
  }

  const counts = Array.from({ length: optionCount }, () => 0);
  let myOptionIndex: number | null = null;
  for (const row of data ?? []) {
    const r = row as { user_id: string; option_index: number };
    const idx = Number(r.option_index);
    if (Number.isFinite(idx) && idx >= 0 && idx < optionCount) counts[idx] += 1;
    if (uid && String(r.user_id) === uid) myOptionIndex = idx;
  }
  return { counts, myOptionIndex, error: null };
}

export async function castPollVote(postId: string, optionIndex: number): Promise<{ error: Error | null }> {
  const supabase = getSupabase();
  if (!supabase) return { error: new Error("Supabase not configured") };
  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData.session?.user?.id;
  if (!uid) return { error: new Error("Not signed in") };

  const gate = await assertProfileCanEngageCommunityFeed(supabase, uid);
  if (!gate.ok) return { error: gate.error };

  const { error } = await supabase.from("community_poll_votes").upsert(
    { post_id: postId, user_id: uid, option_index: optionIndex },
    { onConflict: "post_id,user_id" },
  );
  if (error) return { error: new Error(error.message) };
  return { error: null };
}

export type PollVoterDisplay = {
  user_id: string;
  name: string;
  avatar_url: string | null;
  option_index: number;
  created_at: string;
};

function shortPollVoterId(id: string) {
  return id.length > 12 ? `${id.slice(0, 8)}…` : id;
}

/** Poll voters with display names from profiles (RLS applies; blocked users are hidden). */
export async function fetchPollVotersWithProfiles(postId: string): Promise<{
  data: PollVoterDisplay[];
  error: Error | null;
}> {
  const supabase = getSupabase();
  if (!supabase) return { data: [], error: new Error("Supabase not configured") };

  const { data, error } = await supabase
    .from("community_poll_votes")
    .select("user_id, option_index, created_at")
    .eq("post_id", postId)
    .order("created_at", { ascending: true })
    .limit(200);

  if (error) return { data: [], error: new Error(error.message) };
  const rows = (data ?? []) as Array<{ user_id: string; option_index: number; created_at: string }>;
  if (rows.length === 0) return { data: [], error: null };

  const ids = rows.map((r) => String(r.user_id));
  const profiles = await getProfilesByIds(ids);

  const out: PollVoterDisplay[] = rows.map((r) => {
    const uid = String(r.user_id);
    const p = profiles.get(uid);
    return {
      user_id: uid,
      option_index: Number(r.option_index),
      created_at: String(r.created_at),
      name: p?.full_name?.trim() || shortPollVoterId(uid),
      avatar_url: p?.avatar_url ?? null,
    };
  });

  return { data: out, error: null };
}

/**
 * Max rows returned for “who liked” (UI shows a truncation note above this).
 * RLS on `community_post_reactions` hides rows where the viewer is blocked with the
 * post author or with the liker — manual QA: two accounts + block (see docs/sql/community_feed_engagement.sql).
 */
export const POST_LIKERS_QUERY_LIMIT = 100;

export type PostLikerDisplay = {
  user_id: string;
  name: string;
  avatar_url: string | null;
};

function shortLikerId(id: string) {
  return id.length > 12 ? `${id.slice(0, 8)}…` : id;
}

/** User IDs who liked the post, oldest first (RLS applies). */
export async function fetchLikerUserIdsForPost(postId: string): Promise<{
  data: string[];
  error: Error | null;
  truncated: boolean;
}> {
  const supabase = getSupabase();
  if (!supabase) return { data: [], error: new Error("Supabase not configured"), truncated: false };

  const { data, error } = await supabase
    .from("community_post_reactions")
    .select("user_id")
    .eq("post_id", postId)
    .order("created_at", { ascending: true })
    .limit(POST_LIKERS_QUERY_LIMIT);

  if (error) return { data: [], error: new Error(error.message), truncated: false };
  const rows = data ?? [];
  const truncated = rows.length >= POST_LIKERS_QUERY_LIMIT;
  const ids = rows.map((r: { user_id: string }) => String(r.user_id));
  return { data: ids, error: null, truncated };
}

/** Likers with display names from profiles (same order as fetchLikerUserIdsForPost). */
export async function fetchPostLikersWithProfiles(postId: string): Promise<{
  data: PostLikerDisplay[];
  error: Error | null;
  truncated: boolean;
}> {
  const { data: ids, error, truncated } = await fetchLikerUserIdsForPost(postId);
  if (error) return { data: [], error, truncated: false };
  if (ids.length === 0) return { data: [], error: null, truncated };

  const profiles = await getProfilesByIds(ids);
  const data: PostLikerDisplay[] = ids.map((uid) => {
    const p = profiles.get(uid);
    return {
      user_id: uid,
      name: p?.full_name?.trim() || shortLikerId(uid),
      avatar_url: p?.avatar_url ?? null,
    };
  });
  return { data, error: null, truncated };
}

/** User IDs interested in an event post, oldest first (RLS applies). */
export async function fetchInterestedUserIdsForPost(postId: string): Promise<{
  data: string[];
  error: Error | null;
  truncated: boolean;
}> {
  const supabase = getSupabase();
  if (!supabase) return { data: [], error: new Error("Supabase not configured"), truncated: false };

  const { data, error } = await supabase
    .from("community_post_event_interest")
    .select("user_id")
    .eq("post_id", postId)
    .order("created_at", { ascending: true })
    .limit(POST_LIKERS_QUERY_LIMIT);

  if (error) return { data: [], error: new Error(error.message), truncated: false };
  const rows = data ?? [];
  const truncated = rows.length >= POST_LIKERS_QUERY_LIMIT;
  const ids = rows.map((r: { user_id: string }) => String(r.user_id));
  return { data: ids, error: null, truncated };
}

/** Interested users with display names (event posts). */
export async function fetchPostInterestedWithProfiles(postId: string): Promise<{
  data: PostLikerDisplay[];
  error: Error | null;
  truncated: boolean;
}> {
  const { data: ids, error, truncated } = await fetchInterestedUserIdsForPost(postId);
  if (error) return { data: [], error, truncated: false };
  if (ids.length === 0) return { data: [], error: null, truncated };

  const profiles = await getProfilesByIds(ids);
  const data: PostLikerDisplay[] = ids.map((uid) => {
    const p = profiles.get(uid);
    return {
      user_id: uid,
      name: p?.full_name?.trim() || shortLikerId(uid),
      avatar_url: p?.avatar_url ?? null,
    };
  });
  return { data, error: null, truncated };
}

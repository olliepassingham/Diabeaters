/**
 * Ephemeral 24h community stories (video or image).
 * Media stored in `community_post_images` at `{author_id}/stories/{story_id}.{ext}`.
 */
import { getSupabase } from "@/lib/supabase";
import { COMMUNITY_POST_IMAGES_BUCKET, MAX_POST_VIDEO_BYTES } from "./posts-supabase";

export const STORY_TTL_MS = 24 * 60 * 60 * 1000;
export const MAX_STORY_BYTES = MAX_POST_VIDEO_BYTES;

export type CommunityStoryMediaKind = "video" | "image";

export type CommunityStoryRow = {
  id: string;
  author_id: string;
  media_path: string;
  media_kind: CommunityStoryMediaKind;
  created_at: string;
  expires_at: string;
  viewed_by_me: boolean;
};

function mapStory(r: Record<string, unknown>, viewedByMe = false): CommunityStoryRow {
  const kind = String(r.media_kind ?? "video");
  return {
    id: String(r.id),
    author_id: String(r.author_id),
    media_path: String(r.media_path ?? ""),
    media_kind: kind === "image" ? "image" : "video",
    created_at: String(r.created_at ?? ""),
    expires_at: String(r.expires_at ?? ""),
    viewed_by_me: viewedByMe,
  };
}

function extFromStoryFile(f: File): string {
  const t = f.type.toLowerCase();
  if (t.startsWith("image/")) {
    if (t.includes("png")) return "png";
    if (t.includes("webp")) return "webp";
    return "jpg";
  }
  if (t.includes("webm")) return "webm";
  if (t.includes("quicktime") || f.name.toLowerCase().endsWith(".mov")) return "mov";
  return "mp4";
}

function mediaKindFromFile(f: File): CommunityStoryMediaKind {
  return f.type.startsWith("image/") ? "image" : "video";
}

function validateStoryFile(file: File): Error | null {
  if (file.size > MAX_STORY_BYTES) {
    return new Error("Story must be 50MB or smaller.");
  }
  const t = file.type.toLowerCase();
  const ok =
    t.startsWith("image/") ||
    t === "video/mp4" ||
    t === "video/quicktime" ||
    t === "video/webm" ||
    /\.(mp4|mov|webm|jpe?g|png|webp)$/i.test(file.name);
  if (!ok) {
    return new Error("Use a photo (JPG/PNG) or short video (MP4/MOV/WebM).");
  }
  return null;
}

export async function getStoryMediaSignedUrl(path: string): Promise<string | null> {
  const supabase = getSupabase();
  const trimmed = String(path ?? "").trim();
  if (!supabase || !trimmed) return null;
  const { data, error } = await supabase.storage.from(COMMUNITY_POST_IMAGES_BUCKET).createSignedUrl(trimmed, 3600);
  return !error && data?.signedUrl ? data.signedUrl : null;
}

async function deleteStoryMediaPaths(supabase: NonNullable<ReturnType<typeof getSupabase>>, paths: string[]) {
  const uniq = [...new Set(paths.filter(Boolean))];
  if (uniq.length === 0) return;
  await supabase.storage.from(COMMUNITY_POST_IMAGES_BUCKET).remove(uniq);
}

export async function fetchActiveStoryForAuthor(authorId: string): Promise<{
  data: CommunityStoryRow | null;
  error: Error | null;
}> {
  const supabase = getSupabase();
  if (!supabase) return { data: null, error: new Error("Supabase not configured") };

  const now = new Date().toISOString();
  const { data: sessionData } = await supabase.auth.getSession();
  const viewerId = sessionData.session?.user?.id;

  const { data, error } = await supabase
    .from("community_stories")
    .select("*")
    .eq("author_id", authorId)
    .gt("expires_at", now)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return { data: null, error: new Error(error.message) };
  if (!data) return { data: null, error: null };

  let viewed = false;
  if (viewerId) {
    const { data: viewRow } = await supabase
      .from("community_story_views")
      .select("story_id")
      .eq("story_id", String((data as Record<string, unknown>).id))
      .eq("viewer_id", viewerId)
      .maybeSingle();
    viewed = Boolean(viewRow);
  }

  return { data: mapStory(data as Record<string, unknown>, viewed), error: null };
}

export async function fetchActiveStoriesForAuthors(authorIds: string[]): Promise<{
  data: CommunityStoryRow[];
  error: Error | null;
}> {
  const supabase = getSupabase();
  if (!supabase) return { data: [], error: new Error("Supabase not configured") };

  const ids = [...new Set(authorIds.filter(Boolean))];
  if (ids.length === 0) return { data: [], error: null };

  const now = new Date().toISOString();
  const { data: sessionData } = await supabase.auth.getSession();
  const viewerId = sessionData.session?.user?.id;

  const { data, error } = await supabase
    .from("community_stories")
    .select("*")
    .in("author_id", ids)
    .gt("expires_at", now)
    .order("created_at", { ascending: false });

  if (error) return { data: [], error: new Error(error.message) };

  const rows = (data ?? []) as Record<string, unknown>[];
  const latestByAuthor = new Map<string, Record<string, unknown>>();
  for (const row of rows) {
    const aid = String(row.author_id);
    if (!latestByAuthor.has(aid)) latestByAuthor.set(aid, row);
  }

  const storyIds = [...latestByAuthor.values()].map((r) => String(r.id));
  const viewedIds = new Set<string>();
  if (viewerId && storyIds.length > 0) {
    const { data: views } = await supabase
      .from("community_story_views")
      .select("story_id")
      .eq("viewer_id", viewerId)
      .in("story_id", storyIds);
    for (const v of views ?? []) {
      viewedIds.add(String((v as { story_id: string }).story_id));
    }
  }

  const out = [...latestByAuthor.values()].map((r) => mapStory(r, viewedIds.has(String(r.id))));
  return { data: out, error: null };
}

export async function markStoryViewed(storyId: string): Promise<{ error: Error | null }> {
  const supabase = getSupabase();
  if (!supabase) return { error: new Error("Supabase not configured") };

  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData.session?.user?.id;
  if (!uid) return { error: new Error("Not signed in") };

  const { error } = await supabase.from("community_story_views").upsert(
    { story_id: storyId, viewer_id: uid, viewed_at: new Date().toISOString() },
    { onConflict: "story_id,viewer_id" },
  );

  if (error) return { error: new Error(error.message) };
  return { error: null };
}

export async function insertCommunityStory(file: File): Promise<{
  data: CommunityStoryRow | null;
  error: Error | null;
}> {
  const supabase = getSupabase();
  if (!supabase) return { data: null, error: new Error("Supabase not configured") };

  const vErr = validateStoryFile(file);
  if (vErr) return { data: null, error: vErr };

  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData.session?.user?.id;
  if (!uid) return { data: null, error: new Error("Not signed in") };

  const now = new Date().toISOString();
  const { data: existing } = await supabase
    .from("community_stories")
    .select("id, media_path")
    .eq("author_id", uid)
    .gt("expires_at", now);

  const oldPaths = (existing ?? []).map((r) => String((r as { media_path: string }).media_path)).filter(Boolean);
  const oldIds = (existing ?? []).map((r) => String((r as { id: string }).id));

  const storyId = crypto.randomUUID();
  const ext = extFromStoryFile(file);
  const mediaKind = mediaKindFromFile(file);
  const dest = `${uid}/stories/${storyId}.${ext}`;
  const expiresAt = new Date(Date.now() + STORY_TTL_MS).toISOString();

  const { error: upErr } = await supabase.storage.from(COMMUNITY_POST_IMAGES_BUCKET).upload(dest, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || undefined,
  });
  if (upErr) return { data: null, error: new Error(upErr.message) };

  if (oldIds.length > 0) {
    await supabase.from("community_stories").delete().in("id", oldIds);
    await deleteStoryMediaPaths(supabase, oldPaths);
  }

  const { data, error } = await supabase
    .from("community_stories")
    .insert({
      id: storyId,
      author_id: uid,
      media_path: dest,
      media_kind: mediaKind,
      expires_at: expiresAt,
    })
    .select("*")
    .single();

  if (error) {
    await supabase.storage.from(COMMUNITY_POST_IMAGES_BUCKET).remove([dest]);
    return { data: null, error: new Error(error.message) };
  }

  return { data: mapStory(data as Record<string, unknown>, false), error: null };
}

export type StoryRingState = "none" | "unseen" | "seen";

export function storyRingStateForRow(story: CommunityStoryRow | null | undefined): StoryRingState {
  if (!story) return "none";
  return story.viewed_by_me ? "seen" : "unseen";
}

/**
 * Ephemeral 24h community stories (video or image).
 * Media stored in `community_post_images` at `{author_id}/stories/{story_id}.{ext}`.
 */
import { getSupabase } from "@/lib/supabase";
import { getProfilesByIds } from "@/lib/profile";
import { COMMUNITY_POST_IMAGES_BUCKET, MAX_POST_VIDEO_BYTES } from "./posts-supabase";

export const STORY_TTL_MS = 24 * 60 * 60 * 1000;
export const MAX_STORY_BYTES = MAX_POST_VIDEO_BYTES;
export const MAX_STORY_CAPTION_LENGTH = 200;
export const MAX_STORY_OVERLAY_TEXT_LENGTH = 100;
export const MAX_STORY_OVERLAYS = 1;

export type CommunityStoryMediaKind = "video" | "image";
export type StoryOverlayStyle = "shadow" | "pill";
export type StoryReactionKind = "heart" | "support" | "celebrate";

export type StoryOverlay = {
  id: string;
  text: string;
  /** Normalized horizontal position (0–1). */
  x: number;
  /** Normalized vertical position (0–1). */
  y: number;
  style: StoryOverlayStyle;
};

export type CommunityStoryRow = {
  id: string;
  author_id: string;
  media_path: string;
  media_kind: CommunityStoryMediaKind;
  caption: string | null;
  overlays: StoryOverlay[];
  created_at: string;
  expires_at: string;
  viewed_by_me: boolean;
};

export type StoryReactionSummary = {
  heart: number;
  support: number;
  celebrate: number;
  my_reaction: StoryReactionKind | null;
};

export type StoryViewerRow = {
  viewer_id: string;
  viewed_at: string;
};

export type StoryViewerProfile = {
  viewer_id: string;
  viewed_at: string;
  name: string;
  avatar_url: string | null;
  public_handle: string | null;
};

export const STORY_REACTION_OPTIONS: { kind: StoryReactionKind; emoji: string; label: string }[] = [
  { kind: "heart", emoji: "❤️", label: "Love" },
  { kind: "support", emoji: "💪", label: "Support" },
  { kind: "celebrate", emoji: "🙌", label: "Celebrate" },
];

export function storyReactionEmoji(kind: StoryReactionKind): string {
  return STORY_REACTION_OPTIONS.find((o) => o.kind === kind)?.emoji ?? "❤️";
}

export type StoryReactionProfile = {
  user_id: string;
  reaction_kind: StoryReactionKind;
  created_at: string;
  name: string;
  avatar_url: string | null;
  public_handle: string | null;
};

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

export function parseStoryOverlays(raw: unknown): StoryOverlay[] {
  if (!Array.isArray(raw)) return [];
  const out: StoryOverlay[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const text = String(o.text ?? "").trim();
    if (!text) continue;
    const style = o.style === "pill" ? "pill" : "shadow";
    out.push({
      id: String(o.id ?? crypto.randomUUID()),
      text: text.slice(0, MAX_STORY_OVERLAY_TEXT_LENGTH),
      x: clamp01(Number(o.x ?? 0.5)),
      y: clamp01(Number(o.y ?? 0.5)),
      style,
    });
    if (out.length >= MAX_STORY_OVERLAYS) break;
  }
  return out;
}

function mapStory(r: Record<string, unknown>, viewedByMe = false): CommunityStoryRow {
  const kind = String(r.media_kind ?? "video");
  const captionRaw = r.caption;
  return {
    id: String(r.id),
    author_id: String(r.author_id),
    media_path: String(r.media_path ?? ""),
    media_kind: kind === "image" ? "image" : "video",
    caption: captionRaw == null || String(captionRaw).trim() === "" ? null : String(captionRaw).trim(),
    overlays: parseStoryOverlays(r.overlays),
    created_at: String(r.created_at ?? ""),
    expires_at: String(r.expires_at ?? ""),
    viewed_by_me: viewedByMe,
  };
}

function validateStoryOverlays(overlays: StoryOverlay[]): Error | null {
  if (overlays.length > MAX_STORY_OVERLAYS) {
    return new Error(`Add up to ${MAX_STORY_OVERLAYS} text overlay.`);
  }
  for (const o of overlays) {
    if (!o.text.trim()) return new Error("Text overlay cannot be empty.");
    if (o.text.length > MAX_STORY_OVERLAY_TEXT_LENGTH) {
      return new Error(`Overlay text must be ${MAX_STORY_OVERLAY_TEXT_LENGTH} characters or fewer.`);
    }
  }
  return null;
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

export async function fetchStoryById(storyId: string): Promise<{
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
    .eq("id", storyId)
    .gt("expires_at", now)
    .maybeSingle();

  if (error) return { data: null, error: new Error(error.message) };
  if (!data) return { data: null, error: null };

  let viewed = false;
  if (viewerId) {
    const { data: viewRow } = await supabase
      .from("community_story_views")
      .select("story_id")
      .eq("story_id", storyId)
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

export async function fetchStoryReactionSummary(storyId: string): Promise<{
  data: StoryReactionSummary | null;
  error: Error | null;
}> {
  const supabase = getSupabase();
  if (!supabase) return { data: null, error: new Error("Supabase not configured") };

  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData.session?.user?.id;

  const { data, error } = await supabase
    .from("community_story_reactions")
    .select("reaction_kind, user_id")
    .eq("story_id", storyId);

  if (error) return { data: null, error: new Error(error.message) };

  const summary: StoryReactionSummary = {
    heart: 0,
    support: 0,
    celebrate: 0,
    my_reaction: null,
  };

  for (const row of data ?? []) {
    const kind = String((row as { reaction_kind: string }).reaction_kind) as StoryReactionKind;
    if (kind === "heart") summary.heart += 1;
    else if (kind === "support") summary.support += 1;
    else if (kind === "celebrate") summary.celebrate += 1;
    if (uid && String((row as { user_id: string }).user_id) === uid) {
      summary.my_reaction = kind;
    }
  }

  return { data: summary, error: null };
}

export async function fetchStoryReactionProfiles(storyId: string): Promise<{
  data: StoryReactionProfile[];
  error: Error | null;
}> {
  const supabase = getSupabase();
  if (!supabase) return { data: [], error: new Error("Supabase not configured") };

  const { data, error } = await supabase
    .from("community_story_reactions")
    .select("user_id, reaction_kind, created_at")
    .eq("story_id", storyId)
    .order("created_at", { ascending: false });

  if (error) return { data: [], error: new Error(error.message) };

  const rows = (data ?? []) as { user_id: string; reaction_kind: string; created_at: string }[];
  if (rows.length === 0) return { data: [], error: null };

  const profilesRes = await getProfilesByIds(rows.map((r) => r.user_id));
  return {
    data: rows.map((r) => {
      const kind = String(r.reaction_kind) as StoryReactionKind;
      const p = profilesRes.get(r.user_id);
      return {
        user_id: r.user_id,
        reaction_kind: kind === "support" || kind === "celebrate" ? kind : "heart",
        created_at: String(r.created_at),
        name: p?.full_name?.trim() || "Member",
        avatar_url: p?.avatar_url ?? null,
        public_handle: p?.public_handle ?? null,
      };
    }),
    error: null,
  };
}

export async function setStoryReaction(
  storyId: string,
  kind: StoryReactionKind | null,
): Promise<{ error: Error | null }> {
  const supabase = getSupabase();
  if (!supabase) return { error: new Error("Supabase not configured") };

  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData.session?.user?.id;
  if (!uid) return { error: new Error("Not signed in") };

  if (kind == null) {
    const { error } = await supabase
      .from("community_story_reactions")
      .delete()
      .eq("story_id", storyId)
      .eq("user_id", uid);
    return { error: error ? new Error(error.message) : null };
  }

  const { error } = await supabase.from("community_story_reactions").upsert(
    { story_id: storyId, user_id: uid, reaction_kind: kind },
    { onConflict: "story_id,user_id" },
  );

  return { error: error ? new Error(error.message) : null };
}

export async function fetchStoryViewers(storyId: string): Promise<{
  data: StoryViewerRow[];
  error: Error | null;
}> {
  const supabase = getSupabase();
  if (!supabase) return { data: [], error: new Error("Supabase not configured") };

  const { data, error } = await supabase
    .from("community_story_views")
    .select("viewer_id, viewed_at")
    .eq("story_id", storyId)
    .order("viewed_at", { ascending: false });

  if (error) return { data: [], error: new Error(error.message) };

  return {
    data: (data ?? []).map((r) => ({
      viewer_id: String((r as { viewer_id: string }).viewer_id),
      viewed_at: String((r as { viewed_at: string }).viewed_at),
    })),
    error: null,
  };
}

export async function fetchStoryViewerProfiles(
  storyId: string,
  options?: { excludeUserId?: string },
): Promise<{
  data: StoryViewerProfile[];
  error: Error | null;
}> {
  const res = await fetchStoryViewers(storyId);
  if (res.error) return { data: [], error: res.error };

  const exclude = options?.excludeUserId;
  const rows = exclude ? res.data.filter((v) => v.viewer_id !== exclude) : res.data;
  if (rows.length === 0) return { data: [], error: null };

  const profilesRes = await getProfilesByIds(rows.map((v) => v.viewer_id));
  return {
    data: rows.map((v) => {
      const p = profilesRes.get(v.viewer_id);
      return {
        viewer_id: v.viewer_id,
        viewed_at: v.viewed_at,
        name: p?.full_name?.trim() || "Member",
        avatar_url: p?.avatar_url ?? null,
        public_handle: p?.public_handle ?? null,
      };
    }),
    error: null,
  };
}

export async function insertCommunityStory(
  file: File,
  options?: { caption?: string; overlays?: StoryOverlay[] },
): Promise<{
  data: CommunityStoryRow | null;
  error: Error | null;
}> {
  const supabase = getSupabase();
  if (!supabase) return { data: null, error: new Error("Supabase not configured") };

  const vErr = validateStoryFile(file);
  if (vErr) return { data: null, error: vErr };

  const caption = options?.caption?.trim().slice(0, MAX_STORY_CAPTION_LENGTH) || null;
  const overlays = options?.overlays ?? [];
  const overlayErr = validateStoryOverlays(overlays);
  if (overlayErr) return { data: null, error: overlayErr };

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
      caption,
      overlays: overlays.length > 0 ? overlays : null,
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

export function totalStoryReactions(summary: StoryReactionSummary | null | undefined): number {
  if (!summary) return 0;
  return summary.heart + summary.support + summary.celebrate;
}

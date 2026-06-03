import type { CommunityPostAuthorPreview, CommunityPostRow } from "@/lib/community/types";
import { AI_ASSISTANT_NAME } from "@/lib/ai-coach/persona";
import { getProfilesByIds, type ProfileRow } from "@/lib/profile";

export type FeedAuthorMeta = {
  name: string;
  avatar_url: string | null;
  public_handle: string | null;
  loading?: boolean;
};

export const COMMUNITY_MEMBER_DISPLAY_NAME = "Community member";

function shortId(id: string) {
  return id.length > 12 ? `${id.slice(0, 8)}…` : id;
}

export function authorMetaFromPreviewFields(
  authorId: string,
  prev: CommunityPostAuthorPreview,
): FeedAuthorMeta {
  const name =
    prev.full_name?.trim() ||
    (prev.public_handle?.trim() ? `@${prev.public_handle.trim()}` : "") ||
    COMMUNITY_MEMBER_DISPLAY_NAME;
  return {
    name,
    avatar_url: prev.avatar_url ?? null,
    public_handle: prev.public_handle?.trim() ? prev.public_handle.trim() : null,
  };
}

export function authorMetaFromPostPreview(post: CommunityPostRow): FeedAuthorMeta | null {
  const prev = post.author_preview;
  if (!prev) return null;
  return authorMetaFromPreviewFields(post.author_id, prev);
}

export function authorMetaFromProfile(
  authorId: string,
  prof: ProfileRow | undefined,
  beatieFeedBotUserId?: string | null,
): FeedAuthorMeta {
  if (beatieFeedBotUserId && authorId === beatieFeedBotUserId) {
    return {
      name: AI_ASSISTANT_NAME,
      avatar_url: prof?.avatar_url ?? null,
      public_handle: prof?.public_handle?.trim() ? prof.public_handle.trim() : null,
    };
  }
  const full = prof?.full_name?.trim();
  const handle = prof?.public_handle?.trim();
  const name = full || (handle ? `@${handle}` : "") || COMMUNITY_MEMBER_DISPLAY_NAME;
  return {
    name,
    avatar_url: prof?.avatar_url ?? null,
    public_handle: handle ? handle : null,
  };
}

/** User-visible label — never a raw user id. */
export function displayAuthorName(meta: FeedAuthorMeta, authorId: string, beatieFeedBotUserId?: string | null): string {
  if (beatieFeedBotUserId && authorId === beatieFeedBotUserId) return AI_ASSISTANT_NAME;
  if (meta.loading) return "";
  const name = meta.name?.trim();
  if (name && !looksLikeRawId(name)) return name;
  if (meta.public_handle?.trim()) return `@${meta.public_handle.trim()}`;
  return COMMUNITY_MEMBER_DISPLAY_NAME;
}

function looksLikeRawId(name: string): boolean {
  return /^[0-9a-f]{8}/i.test(name) && name.includes("…");
}

export function authorIdsNeedingProfileFetch(
  authorIds: Iterable<string>,
  posts: CommunityPostRow[],
  beatieFeedBotUserId?: string | null,
): string[] {
  const out: string[] = [];
  for (const id of authorIds) {
    if (!id) continue;
    if (beatieFeedBotUserId && id === beatieFeedBotUserId) continue;
    const post = posts.find((p) => p.author_id === id);
    const prev = post?.author_preview;
    if (prev && (prev.full_name?.trim() || prev.public_handle?.trim())) continue;
    out.push(id);
  }
  return [...new Set(out)];
}

export async function fetchAuthorMetaMap(
  authorIds: string[],
  posts: CommunityPostRow[],
  beatieFeedBotUserId?: string | null,
): Promise<Record<string, FeedAuthorMeta>> {
  const list = authorIdsNeedingProfileFetch(authorIds, posts, beatieFeedBotUserId);
  const next: Record<string, FeedAuthorMeta> = {};

  if (beatieFeedBotUserId && authorIds.includes(beatieFeedBotUserId)) {
    next[beatieFeedBotUserId] = {
      name: AI_ASSISTANT_NAME,
      avatar_url: null,
      public_handle: null,
    };
  }

  if (list.length === 0) return next;

  const map = await getProfilesByIds(list);
  for (const id of list) {
    const postPreview = posts.find((p) => p.author_id === id)?.author_preview;
    next[id] = postPreview
      ? authorMetaFromPreviewFields(id, postPreview)
      : authorMetaFromProfile(id, map.get(id), beatieFeedBotUserId);
  }
  return next;
}

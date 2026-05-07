import type { CommunityContentNoteId } from "./content-notes";
import type { CommunityEventExtra, CommunityPollExtra, CommunityPostKind } from "./post-kinds";
import type { CommunityTopicId } from "./topics";

/** Public profile fields merged into feed rows so headers can render without a second round-trip. */
export type CommunityPostAuthorPreview = {
  full_name: string | null;
  avatar_url: string | null;
  public_handle: string | null;
};

/** Rows from public.community_posts / community_post_comments. */
export type CommunityPostRow = {
  id: string;
  author_id: string;
  body: string;
  /** Fixed feed category (see `COMMUNITY_TOPICS`). */
  topic: CommunityTopicId;
  image_urls: string[];
  /** Parallel to `image_urls` (short descriptions for screen readers). */
  image_alt_texts: string[];
  /** Self-labeled sensitive-topic hint for readers (optional, legacy). */
  content_note: CommunityContentNoteId | null;
  post_kind: CommunityPostKind;
  post_extra: CommunityPollExtra | CommunityEventExtra | null;
  /** Lowercase handle -> mentioned user id (for rendering @mentions in body). */
  mention_map: Record<string, string>;
  mentioned_user_ids: string[];
  is_reported: boolean;
  comment_count: number;
  like_count: number;
  /** Whether the current user has liked this post (client merges from reactions). */
  liked_by_me: boolean;
  /** Whether the current user saved/bookmarked this post (community_post_saves). */
  saved_by_me: boolean;
  created_at: string;
  /** Set by feed fetchers together with `liked_by_me` so avatars/names load with the post payload. */
  author_preview?: CommunityPostAuthorPreview;
};

export type CommunityPostCommentRow = {
  id: string;
  post_id: string;
  author_id: string;
  body: string;
  is_reported: boolean;
  created_at: string;
};

export type DmThreadRow = {
  id: string;
  created_at: string;
  updated_at: string;
};

export type DmThreadMemberRow = {
  thread_id: string;
  user_id: string;
  joined_at: string;
};

export type DmMessageRow = {
  id: string;
  thread_id: string;
  sender_id: string;
  body: string;
  /** Path in `community_post_images` bucket (`{sender_id}/dm/{thread_id}/…`). */
  image_storage_path: string | null;
  created_at: string;
  read_at: string | null;
  /** Client-enriched after fetch. */
  image_signed_url?: string | null;
  like_count?: number;
  liked_by_me?: boolean;
};

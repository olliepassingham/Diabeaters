/** Rows from public.community_posts / community_post_comments. */
export type CommunityPostRow = {
  id: string;
  author_id: string;
  body: string;
  image_urls: string[];
  is_reported: boolean;
  created_at: string;
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
  created_at: string;
  read_at: string | null;
};
